import { NextResponse } from 'next/server';

// Store logs in memory (will reset on server restart)
// In production, you might want to use KV storage
const logs: any[] = [];
const bots = new Map();
const MAX_LOGS = 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;
    
    // Simple password check
    const password = request.headers.get('x-console-password');
    if (password !== 'saywhatwant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    switch (action) {
      case 'register':
        bots.set(data.botId, {
          id: data.botId,
          model: data.model,
          baseURL: data.baseURL,
          status: 'active',
          lastSeen: Date.now(),
        });
        return NextResponse.json({ success: true });
        
      case 'log':
        logs.push({
          botId: data.botId,
          level: data.level,
          message: data.message,
          data: data.data,
          timestamp: data.timestamp || Date.now(),
        });
        
        // Keep only last MAX_LOGS entries
        if (logs.length > MAX_LOGS) {
          logs.shift();
        }
        
        // Update bot last seen
        if (bots.has(data.botId)) {
          const bot = bots.get(data.botId);
          bot.lastSeen = Date.now();
        }
        
        return NextResponse.json({ success: true });
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Simple password check
  const url = new URL(request.url);
  const password = url.searchParams.get('password');
  
  if (password !== 'saywhatwant') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check bot health
  const now = Date.now();
  bots.forEach((bot) => {
    if (now - bot.lastSeen > 30000) {
      bot.status = 'inactive';
    }
  });
  
  return NextResponse.json({
    logs: logs.slice(-100),
    bots: Array.from(bots.values()),
  });
}
