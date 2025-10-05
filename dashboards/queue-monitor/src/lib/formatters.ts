export function timeAgo(timestamp: number | null): string {
  if (!timestamp) return 'NEVER';
  
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', { hour12: false });
}
