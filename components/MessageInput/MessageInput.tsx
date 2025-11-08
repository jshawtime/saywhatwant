/**
 * MessageInput Component
 * 
 * Form for submitting new messages with character counter, error display, and mobile keyboard support
 * Handles Enter key submission, Tab navigation, and video link integration
 */

import React from 'react';
import { Send, ChevronDown } from 'lucide-react';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { CharacterCounter } from './CharacterCounter';
import { ErrorMessage } from './ErrorMessage';

interface MessageInputProps {
  /**
   * Current input text value
   */
  inputText: string;
  
  /**
   * User's color in 9-digit format
   */
  userColor: string;
  
  /**
   * User's color in RGB format for CSS
   */
  userColorRgb: string;
  
  /**
   * Whether form is currently submitting
   */
  isSubmitting: boolean;
  
  /**
   * Error message to display (null = no error)
   */
  error: string | null;
  
  /**
   * Pending video key if video link was inserted
   */
  pendingVideoKey: string | null;
  
  /**
   * Whether user has any video currently shown
   */
  showVideo: boolean;
  
  /**
   * Maximum character length
   */
  maxLength: number;
  
  /**
   * Callback when input text changes
   */
  onInputChange: (text: string) => void;
  
  /**
   * Callback when form is submitted
   */
  onSubmit: (e: React.FormEvent) => void;
  
  /**
   * Callback when video link in input is clicked
   */
  onVideoLinkClick: () => void;
  
  /**
   * Function to get cursor style based on input content
   */
  getInputCursorStyle: (text: string) => React.CSSProperties;
  
  /**
   * Callback to scroll messages to bottom
   */
  scrollToBottom: (smooth?: boolean) => void;
  
  /**
   * Whether there are new messages to show
   */
  hasNewMessages: boolean;
  
  /**
   * Callback to clear new messages indicator
   */
  clearNewMessages: () => void;
  
  /**
   * Ref for textarea element
   */
  inputRef: React.RefObject<HTMLTextAreaElement>;
  
  /**
   * Ref for username input (for Tab navigation)
   */
  usernameRef: React.RefObject<HTMLInputElement>;
}

/**
 * MessageInput Component
 * 
 * Complete message input form with:
 * - Auto-expanding textarea
 * - Character counter
 * - Send button
 * - Error display
 * - Enter key submission
 * - Tab navigation
 * - Video link handling
 * - Mobile keyboard optimizations
 * 
 * @example
 * <MessageInput
 *   inputText={inputText}
 *   userColor={userColor}
 *   userColorRgb={userColorRgb}
 *   isSubmitting={isSubmitting}
 *   error={error}
 *   maxLength={240}
 *   onInputChange={setInputText}
 *   onSubmit={handleSubmit}
 *   inputRef={inputRef}
 *   usernameRef={usernameRef}
 *   // ... other props
 * />
 */
export const MessageInput: React.FC<MessageInputProps> = ({
  inputText,
  userColor,
  userColorRgb,
  isSubmitting,
  error,
  pendingVideoKey,
  showVideo,
  maxLength,
  onInputChange,
  onSubmit,
  onVideoLinkClick,
  getInputCursorStyle,
  scrollToBottom,
  hasNewMessages,
  clearNewMessages,
  inputRef,
  usernameRef
}) => {
  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to submit (Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as any);
    } 
    // Shift+Tab to username field
    else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      usernameRef.current?.focus();
    } 
    // Tab cycles back to username
    else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      usernameRef.current?.focus();
    }
  };
  
  /**
   * Handle input change with video placeholder handling
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value.substring(0, maxLength);
    onInputChange(newText);
  };
  
  /**
   * Handle clicking on input (for video link detection)
   */
  const handleClick = () => {
    if (inputText.includes('<-- video')) {
      onVideoLinkClick();
    }
  };
  
  /**
   * Handle focus (prevent zoom on mobile)
   */
  const handleFocus = () => {
    window.scrollTo(0, 0);
  };
  
  return (
    <>
      {/* Error Message */}
      <ErrorMessage error={error} />
      
      <form onSubmit={onSubmit} className="w-full">
        <div className="relative w-full max-w-full">
          {/* Character Counter */}
          <CharacterCounter 
            current={inputText.length}
            max={maxLength}
            userColor={userColorRgb}
          />
          
          {/* Send Button */}
          <button
            type="submit"
            disabled={isSubmitting || !inputText.trim()}
            className={`absolute bottom-2 right-2 p-1 rounded transition-all z-10 ${
              isSubmitting || !inputText.trim()
                ? 'cursor-not-allowed'
                : 'hover:opacity-80 cursor-pointer'
            }`}
            style={{ 
              color: userColorRgb,
              opacity: (isSubmitting || !inputText.trim()) ? OPACITY_LEVELS.DARK : OPACITY_LEVELS.LIGHT
            }}
            tabIndex={-1}
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
          
          {/* Scroll to Bottom Button */}
          <button
            type="button"
            onClick={() => {
              scrollToBottom(false);
              clearNewMessages();
            }}
            className="absolute top-2 right-12 p-0 rounded transition-all hover:opacity-80 cursor-pointer z-10"
            style={{ 
              color: getDarkerColor(userColorRgb, OPACITY_LEVELS.MEDIUM)
            }}
            tabIndex={-1}
            aria-label="Scroll to bottom"
            title="Jump to latest messages"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {/* Textarea Input */}
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleChange}
            onClick={handleClick}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Say what you want..."
            className="w-full px-4 pt-7 pb-3 pr-12 bg-white/5 border rounded-lg resize-none focus:outline-none min-h-[64px] max-h-[138px] custom-scrollbar touch-manipulation box-border"
            style={{
              ['--placeholder-color' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKER),
              ['--scrollbar-color' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT),
              ['--scrollbar-bg' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST),
              fontSize: '16.1px',  // 15% larger (was 14px from text-sm)
              color: userColorRgb,
              backgroundColor: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST * 0.5),
              borderColor: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK),  // userColor, no fallback
              ...getInputCursorStyle(inputText),
            } as React.CSSProperties}
            maxLength={maxLength}
          />
        </div>
      </form>
    </>
  );
};

export default MessageInput;

