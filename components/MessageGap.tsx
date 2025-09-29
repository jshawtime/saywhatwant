/**
 * MessageGap Component
 * Displays a visual indicator when there's a time gap between messages
 */

import React from 'react';

interface MessageGapProps {
  duration: number;  // Gap duration in milliseconds
  userColor: string; // User's color for styling
}

export function MessageGap({ duration, userColor }: MessageGapProps) {
  // Format duration into human-readable string
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      const remainingHours = hours % 24;
      if (remainingHours > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
      }
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      if (remainingMinutes > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}, ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
      }
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  };
  
  return (
    <div 
      className="message-gap flex items-center justify-center my-4 px-4"
      style={{
        opacity: 0.6
      }}
    >
      <div className="flex items-center gap-2">
        <div 
          className="h-px flex-1" 
          style={{ 
            backgroundColor: userColor,
            minWidth: '50px'
          }} 
        />
        <span 
          className="text-xs font-medium px-2 whitespace-nowrap"
          style={{ color: userColor }}
        >
          Gap: {formatDuration(duration)}
        </span>
        <div 
          className="h-px flex-1" 
          style={{ 
            backgroundColor: userColor,
            minWidth: '50px'
          }} 
        />
      </div>
    </div>
  );
}

// Memoized version for performance
export default React.memo(MessageGap);
