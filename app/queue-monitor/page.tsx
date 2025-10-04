'use client';

import { useState, useEffect } from 'react';

interface QueueItem {
  id: string;
  priority: number;
  timestamp: number;
  entity: string;
  model: string;
  username: string;
  messagePreview: string;
  claimedBy: string | null;
  claimedAt: number | null;
  attempts: number;
}

interface ServerStatus {
  ip: string;
  status: 'online' | 'offline' | 'busy';
  loadedModels: string[];
  currentRequest: string | null;
  requestsProcessed: number;
  averageResponseTime: number;
}

interface QueueStats {
  totalItems: number;
  unclaimedItems: number;
  claimedItems: number;
  priorityBands: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    background: number;
  };
  averageWaitTime: number;
  throughput: number;
}

export default function QueueMonitor() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sww-queue-auth');
    if (saved === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'saywhatwant') {
      setIsAuthenticated(true);
      localStorage.setItem('sww-queue-auth', 'authenticated');
    } else {
      alert('Incorrect password');
    }
  };

  // Initialize mock data (will be replaced with real queue connection)
  useEffect(() => {
    if (!isAuthenticated) return;

    // Mock servers for testing
    const mockServerData: ServerStatus[] = [
      {
        ip: '10.0.0.102',
        status: 'online',
        loadedModels: ['highermind_the-eternal-1', 'router-model-fast'],
        currentRequest: null,
        requestsProcessed: 0,
        averageResponseTime: 0
      },
      {
        ip: '10.0.0.100',
        status: 'online',
        loadedModels: ['fear_and_loathing'],
        currentRequest: null,
        requestsProcessed: 0,
        averageResponseTime: 0
      }
    ];

    setServers(mockServerData);
    
    // Mock stats
    const mockStats: QueueStats = {
      totalItems: 0,
      unclaimedItems: 0,
      claimedItems: 0,
      priorityBands: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        background: 0
      },
      averageWaitTime: 0,
      throughput: 0
    };
    
    setStats(mockStats);
    
    // TODO: Connect to actual queue service when implemented
    // This will poll the queue on 10.0.0.102 for real data
  }, [isAuthenticated]);

  const getPriorityColor = (priority: number) => {
    if (priority <= 10) return 'text-red-400 border-red-400';
    if (priority <= 30) return 'text-orange-400 border-orange-400';
    if (priority <= 60) return 'text-yellow-400 border-yellow-400';
    if (priority <= 90) return 'text-blue-400 border-blue-400';
    return 'text-gray-400 border-gray-400';
  };

  const getPriorityBand = (priority: number) => {
    if (priority <= 10) return 'CRITICAL';
    if (priority <= 30) return 'HIGH';
    if (priority <= 60) return 'MEDIUM';
    if (priority <= 90) return 'LOW';
    return 'BACKGROUND';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <form onSubmit={handleAuth} className="bg-gray-900 p-8 rounded-lg border border-gray-700">
          <h1 className="text-2xl font-bold text-cyan-400 mb-4">🚀 Queue Monitor</h1>
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
            className="w-full px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
          >
            Access Monitor
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border-b-2 border-cyan-600">
        <h1 className="text-2xl font-bold text-cyan-400">🚀 LM Studio Queue Monitor</h1>
        {stats && (
          <div className="mt-2 flex gap-6 text-sm">
            <div><span className="text-gray-500">Total:</span> <span className="text-cyan-400 font-bold">{stats.totalItems}</span></div>
            <div><span className="text-gray-500">Unclaimed:</span> <span className="text-yellow-400 font-bold">{stats.unclaimedItems}</span></div>
            <div><span className="text-gray-500">Processing:</span> <span className="text-green-400 font-bold">{stats.claimedItems}</span></div>
            <div><span className="text-gray-500">Throughput:</span> <span className="text-cyan-400 font-bold">{stats.throughput} req/min</span></div>
            <div><span className="text-gray-500">Avg Wait:</span> <span className="text-cyan-400 font-bold">{Math.round(stats.averageWaitTime)}ms</span></div>
          </div>
        )}
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Queue View (Left) */}
        <div className="flex-1 flex flex-col border-r border-gray-700">
          <div className="bg-gray-900 p-3 border-b border-gray-700">
            <h2 className="font-bold text-gray-400 uppercase text-sm">Priority Queue ({queueItems.length})</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {queueItems.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Queue is empty</div>
            ) : (
              queueItems.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded border-l-4 ${getPriorityColor(item.priority)} ${
                    item.claimedBy ? 'bg-green-900/20' : 'bg-gray-900/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </span>
                      <span className="text-xs text-gray-500">{getPriorityBand(item.priority)}</span>
                    </div>
                    <span className="text-xs text-gray-600">
                      {Math.round((Date.now() - item.timestamp) / 1000)}s ago
                    </span>
                  </div>
                  
                  <div className="text-sm mb-1">
                    <span className="text-gray-500">Entity:</span> <span className="text-cyan-400">{item.entity}</span>
                    <span className="text-gray-700 mx-2">|</span>
                    <span className="text-gray-500">Model:</span> <span className="text-blue-400">{item.model}</span>
                  </div>
                  
                  <div className="text-sm mb-1">
                    <span className="text-gray-500">User:</span> <span className="text-purple-400">{item.username}</span>
                  </div>
                  
                  <div className="text-sm text-gray-400 italic">
                    "{item.messagePreview}"
                  </div>
                  
                  {item.claimedBy && (
                    <div className="mt-2 text-xs text-green-400">
                      ⚡ Processing on {item.claimedBy} (attempt {item.attempts})
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Server Status (Right) */}
        <div className="w-96 flex flex-col">
          <div className="bg-gray-900 p-3 border-b border-gray-700">
            <h2 className="font-bold text-gray-400 uppercase text-sm">LM Studio Servers ({servers.length})</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {servers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No servers connected</div>
            ) : (
              servers.map(server => (
                <div
                  key={server.ip}
                  className={`p-3 rounded border ${
                    server.status === 'online' ? 'border-green-600 bg-green-900/10' :
                    server.status === 'busy' ? 'border-yellow-600 bg-yellow-900/10' :
                    'border-red-600 bg-red-900/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${
                      server.status === 'online' ? 'bg-green-400 animate-pulse' :
                      server.status === 'busy' ? 'bg-yellow-400 animate-pulse' :
                      'bg-red-400'
                    }`} />
                    <span className="font-bold text-white">{server.ip}</span>
                    <span className="text-xs text-gray-500 uppercase">{server.status}</span>
                  </div>
                  
                  {server.loadedModels.length > 0 && (
                    <div className="text-xs mb-2">
                      <div className="text-gray-500 mb-1">Loaded Models:</div>
                      {server.loadedModels.map(model => (
                        <div key={model} className="text-blue-400 ml-2">• {model}</div>
                      ))}
                    </div>
                  )}
                  
                  {server.currentRequest && (
                    <div className="text-xs text-yellow-400 mb-2">
                      🔄 Processing: {server.currentRequest}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Processed: {server.requestsProcessed}</div>
                    <div>Avg Response: {Math.round(server.averageResponseTime)}ms</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Priority Stats */}
          {stats && (
            <div className="bg-gray-900 p-4 border-t border-gray-700">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Priority Distribution</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-red-400">Critical (0-10):</span>
                  <span className="text-white font-bold">{stats.priorityBands.critical}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-400">High (11-30):</span>
                  <span className="text-white font-bold">{stats.priorityBands.high}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-400">Medium (31-60):</span>
                  <span className="text-white font-bold">{stats.priorityBands.medium}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-400">Low (61-90):</span>
                  <span className="text-white font-bold">{stats.priorityBands.low}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Background (91-99):</span>
                  <span className="text-white font-bold">{stats.priorityBands.background}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
