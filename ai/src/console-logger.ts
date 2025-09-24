/**
 * Console Logger for AI Bot Monitoring
 * Sends logs to the monitoring console server
 */

import chalk from 'chalk';
import { CONFIG } from './config';

interface LogData {
  botId: string;
  level: 'debug' | 'info' | 'success' | 'warn' | 'error' | 'message' | 'response';
  message: string;
  data?: any;
  timestamp: number;
}

class ConsoleLogger {
  private consoleUrl: string;
  private botId: string;
  private isRegistered = false;
  private logQueue: LogData[] = [];
  private isProcessing = false;
  
  constructor() {
    // Default to localhost for console logging during development
    this.consoleUrl = process.env.CONSOLE_URL || 'http://localhost:3000/api/ai-console';
    this.botId = process.env.BOT_ID || `bot-${Date.now()}`;
  }
  
  async register() {
    if (this.isRegistered) return;
    
    try {
      const response = await fetch(this.consoleUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-console-password': 'saywhatwant'
        },
        body: JSON.stringify({
          action: 'register',
          botId: this.botId,
          model: CONFIG.LM_STUDIO.model,
          baseURL: CONFIG.LM_STUDIO.baseURL
        })
      });
      
      if (response.ok) {
        this.isRegistered = true;
        console.log(chalk.green(`[LOGGER] Registered with console: ${this.botId} at ${this.consoleUrl}`));
        // Process any queued logs
        this.processQueue();
      } else {
        console.log(chalk.red(`[LOGGER] Failed to register: ${response.status} ${response.statusText}`));
      }
    } catch (error) {
      // Log the actual error
      console.log(chalk.red(`[LOGGER] Console connection failed: ${error}`));
      console.log(chalk.gray(`[LOGGER] URL was: ${this.consoleUrl}`));
    }
  }
  
  private async sendLog(log: LogData) {
    if (!this.isRegistered) {
      this.logQueue.push(log);
      this.register(); // Try to register
      return;
    }
    
    try {
      await fetch(this.consoleUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-console-password': 'saywhatwant'
        },
        body: JSON.stringify({
          action: 'log',
          ...log
        })
      });
    } catch (error) {
      // Silent fail - don't break the bot if console is down
    }
  }
  
  private async processQueue() {
    if (this.isProcessing || !this.isRegistered) return;
    
    this.isProcessing = true;
    while (this.logQueue.length > 0) {
      const log = this.logQueue.shift();
      if (log) {
        await this.sendLog(log);
      }
    }
    this.isProcessing = false;
  }
  
  // Logging methods
  debug(message: string, data?: any) {
    this.log('debug', message, data);
    console.log(chalk.gray(`[${this.botId}] ${message}`));
  }
  
  info(message: string, data?: any) {
    this.log('info', message, data);
    console.log(chalk.blue(`[${this.botId}] ${message}`));
  }
  
  success(message: string, data?: any) {
    this.log('success', message, data);
    console.log(chalk.green(`[${this.botId}] ${message}`));
  }
  
  warn(message: string, data?: any) {
    this.log('warn', message, data);
    console.log(chalk.yellow(`[${this.botId}] ${message}`));
  }
  
  error(message: string, data?: any) {
    this.log('error', message, data);
    console.log(chalk.red(`[${this.botId}] ${message}`));
  }
  
  // Special log types for messages
  message(username: string, text: string, color?: string) {
    const data = { username, text, color, type: 'received' };
    this.log('message', `📥 ${username}: ${text.substring(0, 50)}...`, data);
    console.log(chalk.cyan(`[${this.botId}] 📥 ${username}: ${text.substring(0, 50)}...`));
  }
  
  response(username: string, text: string, color?: string, confidence?: number) {
    const data = { username, text, color, confidence, type: 'sent' };
    this.log('response', `📤 ${username}: ${text.substring(0, 50)}...`, data);
    console.log(chalk.magenta(`[${this.botId}] 📤 ${username}: ${text.substring(0, 50)}...`));
  }
  
  private log(level: LogData['level'], message: string, data?: any) {
    const logData: LogData = {
      botId: this.botId,
      level,
      message,
      data,
      timestamp: Date.now()
    };
    
    this.sendLog(logData);
  }
}

// Export singleton instance
export const logger = new ConsoleLogger();

// Register on startup
logger.register();
