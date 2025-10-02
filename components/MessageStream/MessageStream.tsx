/**
 * MessageStream Component
 * 
 * Scrollable container for messages with lazy loading support
 * Handles scroll behavior, load more, empty states, and message rendering
 */

import React from 'react';
import { Comment } from '@/types';
import { MessageItem } from '@/components/MessageList/MessageItem';
import { EmptyState } from '@/components/MessageList/EmptyState';
import { LoadMoreButton } from './LoadMoreButton';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';

interface MessageStreamProps {
  /**
   * Messages to display
   */
  messages: Comment[];
  
  /**
   * Whether initial load is in progress
   */
  isLoading: boolean;
  
  /**
   * Whether more messages are available in IndexedDB
   */
  hasMore: boolean;
  
  /**
   * Whether currently loading more messages
   */
  isLoadingMore: boolean;
  
  /**
   * Number of messages to load in next batch
   */
  loadMoreCount: number;
  
  /**
   * Current search term (for empty state display)
   */
  searchTerm: string;
  
  /**
   * Whether filters are enabled (for empty state display)
   */
  isFilterEnabled: boolean;
  
  /**
   * User's color in RGB format for styling
   */
  userColorRgb: string;
  
  /**
   * Callback when username is clicked
   */
  onUsernameClick: (username: string, color: string) => void;
  
  /**
   * Callback when message receives context menu
   */
  onContextMenu: (e: React.MouseEvent, comment: Comment, isUsername: boolean) => void;
  
  /**
   * Callback when message is touch-started (mobile)
   */
  onTouchStart: (e: React.TouchEvent, comment: Comment, isUsername: boolean) => void;
  
  /**
   * Callback when touch ends (mobile)
   */
  onTouchEnd: () => void;
  
  /**
   * Callback when load more is triggered
   */
  onLoadMore: () => void;
  
  /**
   * Callback when filter toggle is requested (from empty state)
   */
  onToggleFilter: () => void;
  
  /**
   * Function to parse message text into React nodes
   */
  parseText: (text: string) => React.ReactNode[];
  
  /**
   * Function to format timestamp
   */
  formatTimestamp: (timestamp: number) => string;
  
  /**
   * Function to get comment color
   */
  getCommentColor: (comment: Comment) => string;
  
  /**
   * Ref for scroll container
   */
  streamRef: React.RefObject<HTMLDivElement>;
  
  /**
   * Scroll threshold for lazy loading trigger (pixels from top)
   * @default 100
   */
  lazyLoadThreshold?: number;
}

/**
 * MessageStream Component
 * 
 * Main scrollable container for displaying messages with:
 * - Lazy loading when scrolling to top
 * - Load more button
 * - Loading state with animated indicator
 * - Empty state when no messages
 * - Automatic lazy load trigger at scroll position
 * 
 * @example
 * <MessageStream
 *   messages={filteredMessages}
 *   isLoading={isLoading}
 *   hasMore={hasMoreInIndexedDb}
 *   isLoadingMore={isLoadingMoreFromIndexedDb}
 *   loadMoreCount={50}
 *   searchTerm={searchTerm}
 *   isFilterEnabled={isFilterEnabled}
 *   userColorRgb={userColorRgb}
 *   onUsernameClick={addToFilter}
 *   onLoadMore={loadMoreFromIndexedDb}
 *   streamRef={streamRef}
 *   // ... other props
 * />
 */
export const MessageStream: React.FC<MessageStreamProps> = ({
  messages,
  isLoading,
  hasMore,
  isLoadingMore,
  loadMoreCount,
  searchTerm,
  isFilterEnabled,
  userColorRgb,
  onUsernameClick,
  onContextMenu,
  onTouchStart,
  onTouchEnd,
  onLoadMore,
  onToggleFilter,
  parseText,
  formatTimestamp,
  getCommentColor,
  streamRef,
  lazyLoadThreshold = 100
}) => {
  /**
   * Handle scroll event for lazy loading trigger
   */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    // Check if scrolled near the top for lazy loading
    if (element.scrollTop < lazyLoadThreshold && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  };
  
  return (
    <div 
      ref={streamRef}
      className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 space-y-1 min-h-0"
      style={{
        ['--scrollbar-color' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK),
        ['--scrollbar-bg' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST * 0.5),
      } as React.CSSProperties}
      onScroll={handleScroll}
    >
      {/* Load More Button at Top */}
      {hasMore && (
        <LoadMoreButton
          isLoading={isLoadingMore}
          messageCount={Math.min(loadMoreCount, 999)} // Cap display at reasonable number
          userColorRgb={userColorRgb}
          onClick={onLoadMore}
        />
      )}
      
      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      ) : messages.length === 0 ? (
        /* Empty State */
        <EmptyState
          searchTerm={searchTerm}
          isFilterEnabled={isFilterEnabled}
          userColor={userColorRgb}
          onToggleFilter={onToggleFilter}
        />
      ) : (
        /* Message List */
        messages.map((comment) => (
          <MessageItem
            key={comment.id} 
            comment={comment}
            onUsernameClick={onUsernameClick}
            onContextMenu={onContextMenu}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            parseText={parseText}
            formatTimestamp={formatTimestamp}
            getCommentColor={getCommentColor}
          />
        ))
      )}
    </div>
  );
};

export default MessageStream;

