/**
 * HTTP Server for Queue Monitoring Dashboard
 * Exposes queue stats and operations via REST API
 */

import express, { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';
import type { QueueService } from './queueService.js';

export class QueueHTTPServer {
  private app: express.Application;
  private server: any;
  private queueService: QueueService;
  private port: number;
  private lastSuccessTime: number | null = null;
  private throughputTracker: number[] = [];

  constructor(queueService: QueueService, port: number = 4001) {
    this.queueService = queueService;
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes() {
    // Enable CORS
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Get queue stats
    this.app.get('/queue-stats', (_req: Request, res: Response) => {
      const stats = this.queueService.getStats();
      const items = this.queueService.getAllItems();
      
      // Calculate rolling hour average
      const now = Date.now();
      this.throughputTracker = this.throughputTracker.filter(t => now - t < 3600000);
      const throughputHour = this.throughputTracker.length > 0 
        ? Math.round((this.throughputTracker.length / (3600000 / 60000)))  // Convert to per-minute
        : 0;
      
      res.json({
        items: items.map(item => ({
          id: item.id,
          priority: item.priority,
          entity: item.entity,
          message: item.message,
          claimedBy: item.claimedBy,
          timestamp: item.timestamp,
          routerReason: item.routerReason
        })),
        stats: {
          ...stats,
          throughputHour,
          lastSuccess: this.lastSuccessTime,
          avgWait: stats.averageWaitTime
        }
      });
    });

    // Delete specific item
    this.app.post('/queue-delete/:id', async (req: Request, res: Response) => {
      const itemId = req.params.id;
      await this.queueService.remove(itemId);
      console.log(chalk.yellow('[HTTP]'), `Deleted item: ${itemId}`);
      res.json({ success: true });
    });

    // Clear entire queue
    this.app.post('/queue-clear', async (_req: Request, res: Response) => {
      const items = this.queueService.getAllItems();
      for (const item of items) {
        await this.queueService.remove(item.id);
      }
      console.log(chalk.red('[HTTP]'), `Cleared ${items.length} items from queue`);
      res.json({ success: true, cleared: items.length });
    });

    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ 
        status: 'ok', 
        queueSize: this.queueService.size(),
        timestamp: Date.now()
      });
    });
  }

  /**
   * Record successful post (for last success tracking)
   */
  recordSuccess() {
    this.lastSuccessTime = Date.now();
    this.throughputTracker.push(Date.now());
  }

  /**
   * Start HTTP server
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(chalk.green('[HTTP]'), `Queue dashboard server: http://localhost:${this.port}`);
        console.log(chalk.green('[HTTP]'), `Stats endpoint: http://localhost:${this.port}/queue-stats`);
        resolve();
      });
    });
  }

  /**
   * Stop HTTP server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(chalk.yellow('[HTTP]'), 'Queue dashboard server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
