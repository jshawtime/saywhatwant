/**
 * LoadMoreButton Component
 * 
 * Button to load more messages from IndexedDB
 * Shows loading state when fetching
 */

import React from 'react';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';

interface LoadMoreButtonProps {
  /**
   * Whether currently loading more messages
   */
  isLoading: boolean;
  
  /**
   * Number of messages that will be loaded
   */
  messageCount: number;
  
  /**
   * User's color in RGB format for styling
   */
  userColorRgb: string;
  
  /**
   * Callback when button is clicked
   */
  onClick: () => void;
}

/**
 * LoadMoreButton Component
 * 
 * Displays a button to load more historical messages.
 * Shows loading state with text, or clickable button with message count.
 * 
 * @example
 * <LoadMoreButton
 *   isLoading={isLoadingMore}
 *   messageCount={50}
 *   userColorRgb="rgb(255, 165, 0)"
 *   onClick={handleLoadMore}
 * />
 */
export const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  isLoading,
  messageCount,
  userColorRgb,
  onClick
}) => {
  return (
    <div className="flex justify-center py-2 mb-2">
      {isLoading ? (
        <div className="text-gray-500 text-sm">
          Loading more messages...
        </div>
      ) : (
        <button
          onClick={onClick}
          className="px-4 py-1 text-sm rounded-lg transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST),
            color: userColorRgb,
            border: `1px solid ${getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK)}`
          }}
        >
          Load {messageCount} more messages
        </button>
      )}
    </div>
  );
};

export default LoadMoreButton;

