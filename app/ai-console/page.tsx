'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  botId: string;
  level: 'debug' | 'info' | 'success' | 'warn' | 'error' | 'message' | 'response';
  message: string;
  data?: any;
  timestamp: number;
}

interface Bot {
  id: string;
  model: string;
  baseURL: string;
  status: 'active' | 'inactive';
  lastSeen: number;
}

export default function AIConsole() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bots, setBots] = useState<Map<string, Bot>>(new Map());
  const [messageRate, setMessageRate] = useState(0);
  const consoleRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [autoScrollConsole, setAutoScrollConsole] = useState(true);
  const [autoScrollChat, setAutoScrollChat] = useState(true);
  const messageTimestamps = useRef<number[]>([]);

  // Check authentication
  useEffect(() => {
    const saved = localStorage.getItem('sww-ai-console-auth');
    if (saved === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  // Handle password submission
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'saywhatwant') {
      setIsAuthenticated(true);
      localStorage.setItem('sww-ai-console-auth', 'authenticated');
    } else {
      alert('Incorrect password');
    }
  };

  // Polling for updates (using HTTP since WebSocket not supported in Next.js API routes)
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      try {
        const response = await fetch('/api/ai-console?password=saywhatwant');
        if (response.ok) {
          const data = await response.json();
          
          // Update bots
          data.bots?.forEach((bot: Bot) => {
            setBots(prev => new Map(prev).set(bot.id, bot));
          });
          
          // Update logs (deduplicate by timestamp)
          const existingTimestamps = new Set(logs.map(l => l.timestamp));
          const newLogs = data.logs?.filter((log: LogEntry) => 
            !existingTimestamps.has(log.timestamp)
          ) || [];
          
          if (newLogs.length > 0) {
            setLogs(prev => [...prev, ...newLogs].slice(-500));
            
            // Track message rate
            newLogs.forEach((log: LogEntry) => {
              messageTimestamps.current.push(log.timestamp);
            });
            messageTimestamps.current = messageTimestamps.current.filter(
              t => Date.now() - t < 60000
            );
            setMessageRate(messageTimestamps.current.length);
            
            // Auto-scroll if enabled
            if (autoScrollConsole && consoleRef.current) {
              consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
            }
            if (autoScrollChat && chatRef.current) {
              chatRef.current.scrollTop = chatRef.current.scrollHeight;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch console data:', error);
      }
    };

    // Initial fetch
    fetchData();

    // Poll every 2 seconds
    const interval = setInterval(fetchData, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated, logs]);


  const getLogColor = (level: string) => {
    switch (level) {
      case 'debug': return 'text-gray-500';
      case 'info': return 'text-blue-400';
      case 'success': return 'text-green-400';
      case 'warn': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'message': return 'text-cyan-400';
      case 'response': return 'text-pink-400';
      default: return 'text-gray-300';
    }
  };

  const getBotColor = (botId: string) => {
    const colors = [
      '#4fc3f7', '#4caf50', '#ff9800', '#e91e63', 
      '#9c27b0', '#00bcd4', '#8bc34a', '#ffc107'
    ];
    const index = Array.from(bots.keys()).indexOf(botId);
    return colors[index % colors.length];
  };

  // Update message rate every second
  useEffect(() => {
    const interval = setInterval(() => {
      messageTimestamps.current = messageTimestamps.current.filter(
        t => Date.now() - t < 60000
      );
      setMessageRate(messageTimestamps.current.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <form onSubmit={handleAuth} className="bg-gray-900 p-8 rounded-lg border border-gray-700">
          <h1 className="text-2xl font-bold text-blue-400 mb-4">AI Console Access</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded mb-4"
            autoFocus
          />
          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Access Console
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-300 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border-b-2 border-gray-700">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-400">🤖 AI Bot Monitoring Console</h1>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">Active Bots:</span>{' '}
              <span className="text-blue-400 font-bold">
                {Array.from(bots.values()).filter(b => b.status === 'active').length}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Total Logs:</span>{' '}
              <span className="text-blue-400 font-bold">{logs.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Messages/Min:</span>{' '}
              <span className="text-blue-400 font-bold">{messageRate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bot Status Bar */}
      <div className="bg-gray-900 p-3 border-b border-gray-700 flex gap-3 flex-wrap">
        {Array.from(bots.values()).map(bot => (
          <div
            key={bot.id}
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
              bot.status === 'active' 
                ? 'bg-blue-900/50 border border-blue-400' 
                : 'bg-red-900/50 border border-red-400 opacity-70'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${
              bot.status === 'active' ? 'bg-blue-400 animate-pulse' : 'bg-red-400'
            }`} />
            <span>{bot.id}</span>
            <span className="text-gray-500">{bot.model}</span>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-px bg-gray-700 overflow-hidden">
        {/* Console Output */}
        <div className="flex-1 bg-gray-950 flex flex-col">
          <div className="bg-gray-900 p-3 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Console Output (Raw)
            </h2>
            <button
              onClick={() => setLogs([])}
              className="px-3 py-1 bg-gray-800 text-gray-400 text-xs border border-gray-600 rounded hover:bg-gray-700 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div
            ref={consoleRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-xs"
            onScroll={(e) => {
              const el = e.currentTarget;
              setAutoScrollConsole(
                el.scrollHeight - el.scrollTop - el.clientHeight < 100
              );
            }}
          >
            {logs.map((log, i) => (
              <div
                key={i}
                className={`mb-2 p-2 bg-gray-900/50 border-l-2 ${getLogColor(log.level)} hover:bg-gray-900/80`}
                style={{ borderColor: 'currentColor' }}
              >
                <div className="flex gap-2">
                  <span className="text-gray-600">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className="text-gray-500">[{log.botId}]</span>
                  <span>{log.message}</span>
                </div>
                {log.data && (
                  <pre className="mt-1 ml-4 text-gray-600 text-xs">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat View */}
        <div className="flex-1 bg-gray-950 flex flex-col">
          <div className="bg-gray-900 p-3 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Conversation View
            </h2>
            <button
              onClick={() => setLogs([])}
              className="px-3 py-1 bg-gray-800 text-gray-400 text-xs border border-gray-600 rounded hover:bg-gray-700 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto p-4"
            onScroll={(e) => {
              const el = e.currentTarget;
              setAutoScrollChat(
                el.scrollHeight - el.scrollTop - el.clientHeight < 100
              );
            }}
          >
            {logs
              .filter(log => log.level === 'message' || log.level === 'response')
              .map((log, i) => (
                <div key={i} className="mb-3 flex gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                    style={{ backgroundColor: getBotColor(log.botId) }}
                  >
                    {(log.data?.username || log.botId).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex gap-2 mb-1 items-center">
                      <span 
                        className="font-bold text-sm"
                        style={{ color: getBotColor(log.botId) }}
                      >
                        {log.data?.username || log.botId}
                      </span>
                      {log.level === 'response' && (
                        <span className="px-2 py-0.5 bg-blue-600 text-black text-xs font-bold rounded">
                          BOT
                        </span>
                      )}
                      <span className="text-gray-600 text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-300">
                      {log.data?.text || log.message}
                    </div>
                    {log.level === 'response' && log.data?.confidence && (
                      <div className="text-gray-500 text-xs mt-1 italic">
                        Confidence: {log.data.confidence}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
