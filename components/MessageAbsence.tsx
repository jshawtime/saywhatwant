/**
 * MessageAbsence Component
 * Displays a visual indicator when user has been away and may have missed messages
 */

import React from 'react';

interface MessageAbsenceProps {
  duration: number;  // Absence duration in milliseconds
  userColor: string; // User's color for styling
}

export function MessageAbsence({ duration, userColor }: MessageAbsenceProps) {
  // Format duration into human-readable string
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    
    return 'a moment';
  };
  
  return (
    <div 
      className="message-absence flex items-center justify-center my-4 px-4"
      style={{
        opacity: 0.5
      }}
    >
      <div className="flex items-center gap-2">
        <div 
          className="h-px flex-1" 
          style={{ 
            backgroundColor: userColor,
            minWidth: '30px'
          }} 
        />
        <span 
          className="text-xs font-medium px-2 whitespace-nowrap"
          style={{ color: userColor }}
        >
          You were away for {formatDuration(duration)} and may have missed messages
        </span>
        <div 
          className="h-px flex-1" 
          style={{ 
            backgroundColor: userColor,
            minWidth: '30px'
          }} 
        />
      </div>
    </div>
  );
}

// Memoized version for performance
export default React.memo(MessageAbsence);
