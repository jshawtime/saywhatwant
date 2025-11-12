/**
 * MessageItem Component
 * 
 * Renders a single message in the chat stream
 * Pure presentational component - no business logic
 */

import React from 'react';
import { Comment } from '@/types';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';

interface MessageItemProps {
  comment: Comment;
  onUsernameClick: (username: string, color: string, messageType: string) => void;
  onContextMenu: (e: React.MouseEvent, comment: Comment, isUsername: boolean) => void;
  onTouchStart: (e: React.TouchEvent, comment: Comment, isUsername: boolean) => void;
  onTouchEnd: () => void;
  parseText: (text: string) => React.ReactNode[];
  formatTimestamp: (timestamp: number) => string;
  getCommentColor: (comment: Comment) => string;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  comment,
  onUsernameClick,
  onContextMenu,
  onTouchStart,
  onTouchEnd,
  parseText,
  formatTimestamp,
  getCommentColor,
}) => {
  const commentColor = getCommentColor(comment);
  
  return (
    <div 
      className="comment-enter bg-white/5 rounded-lg px-3 py-2 hover:bg-white/[0.07] transition-colors"
    >
      <div className="flex items-start relative" style={{ gap: 'var(--comment-username-gap)' }}>
        {/* Username - vertically centered with first line of message */}
        <button 
          onClick={() => comment.username && onUsernameClick(comment.username, comment.color, comment['message-type'])}
          onContextMenu={(e) => onContextMenu(e, comment, true)}
          onTouchStart={(e) => onTouchStart(e, comment, true)}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchEnd}
          className="font-medium flex-shrink-0 hover:underline cursor-pointer select-none" 
          style={{ 
            fontSize: '13.8px',  // 15% larger (was 12px from text-xs)
            lineHeight: '23px',  // 15% larger (was 20px)
            color: getDarkerColor(commentColor, OPACITY_LEVELS.LIGHT)
          }}
          tabIndex={-1}
        >
          {comment.username || 'Anonymous'}:
        </button>
        
        {/* Message with right margin for timestamp */}
        <div className="flex-1 pr-12">
          <div 
            onContextMenu={(e) => onContextMenu(e, comment, false)}
            onTouchStart={(e) => onTouchStart(e, comment, false)}
            onTouchEnd={onTouchEnd}
            onTouchMove={onTouchEnd}
            className="leading-snug break-all overflow-wrap-anywhere" 
            style={{ 
              fontSize: '16.1px',  // 15% larger (was 14px from text-sm)
              lineHeight: '23px',  // 15% larger (was 20px)
              color: commentColor
            }}
          >
            {parseText(comment.text)}
          </div>
        </div>
        
        {/* Timestamp - positioned absolute on right */}
        <span 
          className="absolute top-0 right-0 border px-2 py-1 rounded"
          style={{ 
            fontSize: '11.5px',  // 15% larger (was 10px)
            color: getDarkerColor(commentColor, 0.7),
            borderColor: getDarkerColor(commentColor, OPACITY_LEVELS.DARK),
            backgroundColor: getDarkerColor(commentColor, OPACITY_LEVELS.DARKEST)
          }}
        >
          {formatTimestamp(comment.timestamp)}
        </span>
      </div>
    </div>
  );
};

