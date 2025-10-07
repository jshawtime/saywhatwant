export interface QueueItem {
  id: string;
  priority: number;
  entity: { id: string; username: string };
  message: { text: string; username: string };
  claimedBy: string | null;
  timestamp: number;
  routerReason: string;
}

export interface QueueStats {
  totalItems: number;
  unclaimedItems: number;
  claimedItems: number;
  throughputHour: number;
  avgWait: number;
  lastSuccess: number | null;
  priorityBands: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    background: number;
  };
}

export interface WebSocketMessage {
  type: 'snapshot' | 'queued' | 'claimed' | 'completed' | 'deleted' | 'stats' | 'log';
  data: any;
  timestamp: number;
}
