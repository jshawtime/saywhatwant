/**
 * ErrorMessage Component
 * 
 * Displays error messages above the message input form
 * Only renders when error exists
 */

import React from 'react';

interface ErrorMessageProps {
  /**
   * Error message to display (null or empty string = no error)
   */
  error: string | null;
}

/**
 * ErrorMessage Component
 * 
 * Shows error in red-tinted box when present.
 * Returns null when no error.
 * 
 * @example
 * <ErrorMessage error="Failed to post message" />
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  if (!error) return null;
  
  return (
    <div className="mb-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
      {error}
    </div>
  );
};

export default ErrorMessage;

