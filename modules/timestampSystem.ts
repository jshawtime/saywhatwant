/**
 * Timestamp System Module
 * Handles all timestamp formatting and relative time calculations
 * Part of Phase 1 modularization - extracted from CommentsStream.tsx
 */

/**
 * Format a timestamp to a human-readable relative time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted string like "now", "5m", "2h", "3d", or date
 */
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than 1 minute
  if (diff < 60000) return 'now';
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d`;
  }
  
  // Default to date
  return date.toLocaleDateString();
};

/**
 * Get a more detailed relative time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns String like "just now", "5 minutes ago", "2 hours ago"
 */
export const getRelativeTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 10000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)} seconds ago`;
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
  
  return date.toLocaleDateString();
};

/**
 * Format a date range for display
 * @param start - Start date
 * @param end - End date
 * @returns Formatted string like "Jan 1 - Jan 7" or "Dec 28 2024 - Jan 3 2025"
 */
export const formatDateRange = (start: Date, end: Date): string => {
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  
  // Same year
  if (startYear === endYear) {
    // Same month
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
    }
    // Different months
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  }
  
  // Different years
  return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
};

/**
 * Get a timestamp for a specific time ago
 * @param amount - Amount of time
 * @param unit - Time unit ('minutes' | 'hours' | 'days' | 'weeks')
 * @returns Unix timestamp in milliseconds
 */
export const getTimestampAgo = (amount: number, unit: 'minutes' | 'hours' | 'days' | 'weeks'): number => {
  const now = Date.now();
  const multipliers = {
    minutes: 60000,
    hours: 3600000,
    days: 86400000,
    weeks: 604800000
  };
  
  return now - (amount * multipliers[unit]);
};

/**
 * Check if a timestamp is within a date range
 * @param timestamp - Unix timestamp to check
 * @param start - Start of range (optional)
 * @param end - End of range (optional)
 * @returns true if within range
 */
export const isWithinRange = (timestamp: number, start?: number, end?: number): boolean => {
  if (start && timestamp < start) return false;
  if (end && timestamp > end) return false;
  return true;
};

/**
 * Format timestamp for display in different contexts
 * @param timestamp - Unix timestamp in milliseconds
 * @param format - Format type ('short' | 'long' | 'full' | 'time' | 'date')
 * @returns Formatted string
 */
export const formatTimestampDisplay = (timestamp: number, format: 'short' | 'long' | 'full' | 'time' | 'date' = 'short'): string => {
  const date = new Date(timestamp);
  
  switch (format) {
    case 'short':
      return formatTimestamp(timestamp); // Our existing short format
    
    case 'long':
      return getRelativeTime(timestamp); // More verbose format
    
    case 'full':
      return date.toLocaleString(); // Full date and time
    
    case 'time':
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    
    case 'date':
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    
    default:
      return formatTimestamp(timestamp);
  }
};

/**
 * Parse a timestamp from various input formats
 * @param input - String, number, or Date to parse
 * @returns Unix timestamp in milliseconds
 */
export const parseTimestamp = (input: string | number | Date): number => {
  if (typeof input === 'number') return input;
  if (input instanceof Date) return input.getTime();
  
  const parsed = Date.parse(input);
  if (isNaN(parsed)) {
    console.error('[TimestampSystem] Invalid timestamp input:', input);
    return Date.now();
  }
  
  return parsed;
};

// Time constants for easy reference
export const TIME = {
  SECOND: 1000,
  MINUTE: 60000,
  HOUR: 3600000,
  DAY: 86400000,
  WEEK: 604800000,
  MONTH: 2592000000, // Approximate (30 days)
  YEAR: 31536000000  // Approximate (365 days)
} as const;

// Export all functions as a namespace for convenience
export const TimestampSystem = {
  format: formatTimestamp,
  relative: getRelativeTime,
  range: formatDateRange,
  ago: getTimestampAgo,
  isWithin: isWithinRange,
  display: formatTimestampDisplay,
  parse: parseTimestamp,
  TIME
};
