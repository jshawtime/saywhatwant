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
  onUsernameClick: (username: string, color: string) => void;
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
          onClick={() => comment.username && onUsernameClick(comment.username, commentColor)}
          onContextMenu={(e) => onContextMenu(e, comment, true)}
          onTouchStart={(e) => onTouchStart(e, comment, true)}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchEnd}
          className="text-xs font-medium flex-shrink-0 hover:underline cursor-pointer select-none" 
          title={`Click to filter by ${comment.username || 'Anonymous'} | Right click more options`}
          style={{ 
            lineHeight: '20px',
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
            className="text-sm leading-snug break-all overflow-wrap-anywhere" 
            style={{ 
              lineHeight: '20px',
              color: commentColor
            }}
          >
            {parseText(comment.text)}
          </div>
        </div>
        
        {/* Timestamp - positioned absolute on right */}
        <span 
          className="absolute top-0 right-0 text-[10px] border px-1.5 py-0.5 rounded"
          style={{ 
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

