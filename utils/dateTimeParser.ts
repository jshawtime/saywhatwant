/**
 * Date/Time Parser Utility
 * Handles parsing of various date/time formats for filtering
 */

export interface ParsedDateTime {
  timestamp: number;  // Unix timestamp in milliseconds
  isValid: boolean;
  originalValue: string;
}

/**
 * Parse a date/time string into a timestamp
 * Supports multiple formats:
 * - YYYY-MM-DD
 * - YYYY-MM-DDTHH:MM
 * - T[minutes] (relative time)
 * - Keywords: now, today, yesterday, week, month
 */
export function parseDateTime(value: string | null): ParsedDateTime | null {
  if (!value) return null;
  
  const result: ParsedDateTime = {
    timestamp: Date.now(),
    isValid: false,
    originalValue: value
  };
  
  // Handle keywords
  const lowerValue = value.toLowerCase();
  switch (lowerValue) {
    case 'now':
    case 't0':
      result.timestamp = Date.now();
      result.isValid = true;
      return result;
      
    case 'today':
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      result.timestamp = today.getTime();
      result.isValid = true;
      return result;
      
    case 'yesterday':
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      result.timestamp = yesterday.getTime();
      result.isValid = true;
      return result;
      
    case 'week':
      result.timestamp = Date.now() - (7 * 24 * 60 * 60 * 1000);
      result.isValid = true;
      return result;
      
    case 'month':
      result.timestamp = Date.now() - (30 * 24 * 60 * 60 * 1000);
      result.isValid = true;
      return result;
  }
  
  // Handle T[minutes] format (relative time)
  if (value.startsWith('T') || value.startsWith('t')) {
    const minutes = parseInt(value.substring(1), 10);
    if (!isNaN(minutes) && minutes >= 0) {
      result.timestamp = Date.now() - (minutes * 60 * 1000);
      result.isValid = true;
      return result;
    }
  }
  
  // Handle absolute dates with optional time
  // Check for time component (presence of colon)
  if (value.includes(':')) {
    // Format: YYYY-MM-DDTHH:MM or YYYY-MM-DD HH:MM
    const dateTimeStr = value.replace(' ', 'T'); // Normalize space to T
    const parsedDate = new Date(dateTimeStr);
    
    if (!isNaN(parsedDate.getTime())) {
      result.timestamp = parsedDate.getTime();
      result.isValid = true;
      return result;
    }
  } else if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Format: YYYY-MM-DD (date only)
    const parsedDate = new Date(value);
    
    if (!isNaN(parsedDate.getTime())) {
      result.timestamp = parsedDate.getTime();
      result.isValid = true;
      return result;
    }
  }
  
  // If nothing matched, return invalid result
  return result;
}

/**
 * Parse timeFrom/timeTo (simple minute values)
 */
export function parseMinutesAgo(minutes: number | null): number | null {
  if (minutes === null || minutes === undefined) return null;
  if (minutes < 0) return Date.now(); // Negative values treated as "now"
  
  return Date.now() - (minutes * 60 * 1000);
}

/**
 * Auto-correct backwards date ranges
 */
export function correctDateRange(
  fromTimestamp: number | null, 
  toTimestamp: number | null
): { from: number | null; to: number | null } {
  // If both are null, return as is
  if (fromTimestamp === null && toTimestamp === null) {
    return { from: null, to: null };
  }
  
  // If only one is set, use it correctly
  if (fromTimestamp === null) {
    return { from: null, to: toTimestamp };
  }
  if (toTimestamp === null) {
    // If only 'from' is set, 'to' defaults to now
    return { from: fromTimestamp, to: Date.now() };
  }
  
  // If from is after to, swap them
  if (fromTimestamp > toTimestamp) {
    return { from: toTimestamp, to: fromTimestamp };
  }
  
  return { from: fromTimestamp, to: toTimestamp };
}

/**
 * Check if a timestamp falls within a date range
 */
export function isWithinDateRange(
  timestamp: number,
  from: number | null,
  to: number | null
): boolean {
  // No date filter
  if (from === null && to === null) return true;
  
  // Only 'from' is set
  if (from !== null && to === null) {
    return timestamp >= from;
  }
  
  // Only 'to' is set
  if (from === null && to !== null) {
    return timestamp <= to;
  }
  
  // Both are set
  if (from !== null && to !== null) {
    return timestamp >= from && timestamp <= to;
  }
  
  return true;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  // If today, show time only
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  // If this year, show date without year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  // Otherwise show full date
  return date.toLocaleDateString('en-US', { 
    year: 'numeric',
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get human-readable description of date filter
 */
export function describeDateRange(
  from: string | null,
  to: string | null,
  timeFrom: number | null,
  timeTo: number | null
): string {
  // Prefer from/to over timeFrom/timeTo
  if (from || to) {
    const parts: string[] = [];
    
    if (from) {
      if (from.startsWith('T') || from.startsWith('t')) {
        const minutes = parseInt(from.substring(1), 10);
        if (minutes === 0) {
          parts.push('From now');
        } else if (minutes < 60) {
          parts.push(`From ${minutes} min ago`);
        } else if (minutes < 1440) {
          const hours = Math.floor(minutes / 60);
          parts.push(`From ${hours} hour${hours > 1 ? 's' : ''} ago`);
        } else {
          const days = Math.floor(minutes / 1440);
          parts.push(`From ${days} day${days > 1 ? 's' : ''} ago`);
        }
      } else {
        parts.push(`From ${from}`);
      }
    }
    
    if (to) {
      if (to === 'now' || to === 'T0' || to === 't0') {
        parts.push('to now');
      } else if (to.startsWith('T') || to.startsWith('t')) {
        const minutes = parseInt(to.substring(1), 10);
        if (minutes === 0) {
          parts.push('to now');
        } else if (minutes < 60) {
          parts.push(`to ${minutes} min ago`);
        } else if (minutes < 1440) {
          const hours = Math.floor(minutes / 60);
          parts.push(`to ${hours} hour${hours > 1 ? 's' : ''} ago`);
        } else {
          const days = Math.floor(minutes / 1440);
          parts.push(`to ${days} day${days > 1 ? 's' : ''} ago`);
        }
      } else {
        parts.push(`to ${to}`);
      }
    }
    
    return parts.join(' ') || 'All time';
  }
  
  // Handle timeFrom/timeTo
  if (timeFrom !== null || timeTo !== null) {
    const parts: string[] = [];
    
    if (timeFrom !== null) {
      if (timeFrom === 0) {
        parts.push('From now');
      } else if (timeFrom < 60) {
        parts.push(`From ${timeFrom} min ago`);
      } else if (timeFrom < 1440) {
        const hours = Math.floor(timeFrom / 60);
        parts.push(`From ${hours} hour${hours > 1 ? 's' : ''} ago`);
      } else {
        const days = Math.floor(timeFrom / 1440);
        parts.push(`From ${days} day${days > 1 ? 's' : ''} ago`);
      }
    }
    
    if (timeTo !== null) {
      if (timeTo === 0) {
        parts.push('to now');
      } else if (timeTo < 60) {
        parts.push(`to ${timeTo} min ago`);
      } else if (timeTo < 1440) {
        const hours = Math.floor(timeTo / 60);
        parts.push(`to ${hours} hour${hours > 1 ? 's' : ''} ago`);
      } else {
        const days = Math.floor(timeTo / 1440);
        parts.push(`to ${days} day${days > 1 ? 's' : ''} ago`);
      }
    }
    
    return parts.join(' ') || 'All time';
  }
  
  return 'All time';
}
