/**
 * NotificationBanner Component
 * 
 * Displays a clickable notification banner (e.g., "New Messages")
 * Pure presentation component - state and callbacks handled by parent
 */

import React from 'react';

interface NotificationBannerProps {
  /**
   * Whether to show the notification
   */
  show: boolean;
  
  /**
   * User's color in RGB format for CSS styling
   */
  userColorRgb: string;
  
  /**
   * Callback when banner is clicked
   */
  onClick: () => void;
  
  /**
   * Message to display in the banner
   */
  message: string;
  
  /**
   * Optional custom positioning
   * @default { right: '4rem' }
   */
  position?: React.CSSProperties;
  
  /**
   * Optional aria label for accessibility
   */
  ariaLabel?: string;
}

/**
 * NotificationBanner Component
 * 
 * A reusable notification banner that appears at the top of content areas.
 * Commonly used for "New Messages", "New Activity", etc.
 * 
 * @example
 * <NotificationBanner
 *   show={hasNewMessages}
 *   userColorRgb="rgb(255, 165, 0)"
 *   message="New Messages"
 *   onClick={handleScrollToBottom}
 *   ariaLabel="Jump to latest messages"
 * />
 */
export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  show,
  userColorRgb,
  onClick,
  message,
  position = { right: '4rem' },
  ariaLabel
}) => {
  if (!show) return null;
  
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-2 text-xs z-20 font-medium pr-2 hover:opacity-80 cursor-pointer"
      style={{ 
        color: userColorRgb,
        ...position
      }}
      aria-label={ariaLabel || message}
    >
      {message}
    </button>
  );
};

export default NotificationBanner;

