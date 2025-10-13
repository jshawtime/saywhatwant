/**
 * WebSocket Server for Real-Time Dashboard
 * Pushes queue updates instantly to connected clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { QueueService } from './queueService.js';
import { getConfig } from './configLoader.js';

const execAsync = promisify(exec);

interface WebSocketMessage {
  type: 'snapshot' | 'queued' | 'claimed' | 'completed' | 'deleted' | 'stats' | 'log' | 'llm_request' | 'pm2_logs';
  data: any;
  timestamp: number;
}

export class QueueWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private queueService: QueueService;
  private port: number;
  private lastSuccessTime: number | null = null;
  private throughputTracker: number[] = [];

  constructor(queueService: QueueService, port: number = 4002) {
    this.queueService = queueService;
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log(chalk.green('[WebSocket]'), 'Dashboard connected');
      this.clients.add(ws);

      // Send initial snapshot
      this.sendSnapshot(ws);

      // Handle commands from dashboard
      ws.on('message', (data: Buffer) => {
        try {
          const command = JSON.parse(data.toString());
          this.handleCommand(command, ws);
        } catch (error) {
          console.error(chalk.red('[WebSocket]'), 'Invalid command:', error);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(chalk.yellow('[WebSocket]'), 'Dashboard disconnected');
      });

      ws.on('error', (error) => {
        console.error(chalk.red('[WebSocket]'), 'Error:', error);
      });
    });

    console.log(chalk.green('[WebSocket]'), `Server started on port ${this.port}`);
  }

  private sendSnapshot(ws: WebSocket) {
    const stats = this.queueService.getStats();
    const items = this.queueService.getAllItems();
    
    // Get config version for dashboard display
    let configVersion = 'unknown';
    try {
      const config = getConfig();
      configVersion = config.version || 'v1.0';
    } catch (error) {
      console.error('[WebSocket] Failed to read config version:', error);
    }

    // Calculate rolling hour average
    const now = Date.now();
    this.throughputTracker = this.throughputTracker.filter(t => now - t < 3600000);
    const throughputHour = this.throughputTracker.length > 0
      ? Math.round(this.throughputTracker.length / 60)
      : 0;

    const message: WebSocketMessage = {
      type: 'snapshot',
      data: {
        items,
        stats: {
          ...stats,
          throughputHour,
          lastSuccess: this.lastSuccessTime,
          configVersion  // Add version to stats
        }
      },
      timestamp: Date.now()
    };

    ws.send(JSON.stringify(message));
  }

  private async handleCommand(command: any, _ws: WebSocket) {
    console.log(chalk.blue('[WebSocket]'), 'Command received:', command.action);

    switch (command.action) {
      case 'delete':
        await this.queueService.remove(command.itemId);
        this.broadcast({
          type: 'deleted',
          data: { itemId: command.itemId },
          timestamp: Date.now()
        });
        break;

      case 'clear':
        const items = this.queueService.getAllItems();
        for (const item of items) {
          await this.queueService.remove(item.id);
        }
        this.broadcast({
          type: 'snapshot',
          data: {
            items: [],
            stats: this.queueService.getStats()
          },
          timestamp: Date.now()
        });
        console.log(chalk.red('[WebSocket]'), `Cleared ${items.length} items`);
        break;
        
      case 'get_pm2_logs':
        try {
          const lines = command.lines || 200;
          const { stdout } = await execAsync(`pm2 logs ai-bot --lines ${lines} --nostream`);
          _ws.send(JSON.stringify({
            type: 'pm2_logs',
            data: { logs: stdout },
            timestamp: Date.now()
          }));
        } catch (error: any) {
          _ws.send(JSON.stringify({
            type: 'pm2_logs',
            data: { logs: `Error fetching PM2 logs: ${error.message}` },
            timestamp: Date.now()
          }));
        }
        break;

      default:
        console.warn(chalk.yellow('[WebSocket]'), 'Unknown command:', command.action);
    }
  }

  /**
   * Broadcast event to all connected dashboards
   */
  private broadcast(message: WebSocketMessage) {
    console.log(chalk.cyan('[WebSocket]'), `Broadcasting: ${message.type} to ${this.clients.size} clients`);
    const data = JSON.stringify(message);
    let sent = 0;
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
        sent++;
      }
    });
    console.log(chalk.cyan('[WebSocket]'), `Sent to ${sent} clients`);
  }

  /**
   * Event: Item queued
   */
  onQueued(item: any) {
    this.broadcast({
      type: 'queued',
      data: { item },
      timestamp: Date.now()
    });
  }

  /**
   * Event: Item claimed
   */
  onClaimed(itemId: string, serverId: string) {
    this.broadcast({
      type: 'claimed',
      data: { itemId, serverId },
      timestamp: Date.now()
    });
  }

  /**
   * Event: Item completed
   */
  onCompleted(itemId: string, success: boolean) {
    this.broadcast({
      type: 'completed',
      data: { itemId, success },
      timestamp: Date.now()
    });
  }

  /**
   * Record successful post
   */
  recordSuccess() {
    this.lastSuccessTime = Date.now();
    this.throughputTracker.push(Date.now());
  }

  /**
   * Push stats update
   */
  pushStats() {
    const stats = this.queueService.getStats();
    const now = Date.now();
    this.throughputTracker = this.throughputTracker.filter(t => now - t < 3600000);

    this.broadcast({
      type: 'stats',
      data: {
        ...stats,
        throughputHour: Math.round(this.throughputTracker.length / 60),
        lastSuccess: this.lastSuccessTime
      },
      timestamp: Date.now()
    });
  }

  /**
   * Send log message to dashboard
   */
  sendLog(message: string) {
    this.broadcast({
      type: 'log',
      data: { message },
      timestamp: Date.now()
    });
  }

  /**
   * Send LLM request to dashboard for debugging
   */
  sendLLMRequest(request: any) {
    this.broadcast({
      type: 'llm_request',
      data: request,
      timestamp: Date.now()
    });
  }

  /**
   * Stop WebSocket server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log(chalk.yellow('[WebSocket]'), 'Server stopped');
        resolve();
      });
    });
  }
}
