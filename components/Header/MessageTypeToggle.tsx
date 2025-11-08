/**
 * MessageTypeToggle Component
 * 
 * Independent toggle buttons for Human and AI message types
 * User can view both, one, or neither
 */

import React from 'react';
import { Users, Sparkles } from 'lucide-react';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';

interface MessageTypeToggleProps {
  /**
   * Currently active channel ('human', 'AI', 'ALL', or null for neither)
   */
  activeChannel: 'human' | 'AI' | 'ALL' | null;
  
  /**
   * User's color in RGB format for styling
   */
  userColorRgb: string;
  
  /**
   * Callback when channel changes
   */
  onChannelChange: (channel: 'human' | 'AI' | 'ALL' | null) => void;
}

/**
 * MessageTypeToggle Component
 * 
 * Independent toggle buttons allowing flexible viewing:
 * - Both ON: View all messages (mt=ALL)
 * - Human only: View human messages (mt=human)
 * - AI only: View AI messages (mt=AI)  
 * - Neither: EmptyState (no mt parameter)
 * 
 * @example
 * <MessageTypeToggle
 *   activeChannel="ALL"
 *   userColorRgb="rgb(255, 165, 0)"
 *   onChannelChange={(channel) => setMessageType(channel)}
 * />
 */
export const MessageTypeToggle: React.FC<MessageTypeToggleProps> = ({
  activeChannel,
  userColorRgb,
  onChannelChange
}) => {
  // Derive individual button states from activeChannel
  const isHumanActive = activeChannel === 'human' || activeChannel === 'ALL';
  const isAIActive = activeChannel === 'AI' || activeChannel === 'ALL';
  
  // Independent toggle handlers
  const toggleHuman = () => {
    if (isHumanActive && isAIActive) {
      // Both ON → turn off Human → AI only
      onChannelChange('AI');
    } else if (isHumanActive && !isAIActive) {
      // Human only → turn off Human → neither
      onChannelChange(null);
    } else if (!isHumanActive && isAIActive) {
      // AI only → turn on Human → both
      onChannelChange('ALL');
    } else {
      // Neither → turn on Human → Human only
      onChannelChange('human');
    }
  };
  
  const toggleAI = () => {
    if (isHumanActive && isAIActive) {
      // Both ON → turn off AI → Human only
      onChannelChange('human');
    } else if (!isHumanActive && isAIActive) {
      // AI only → turn off AI → neither
      onChannelChange(null);
    } else if (isHumanActive && !isAIActive) {
      // Human only → turn on AI → both
      onChannelChange('ALL');
    } else {
      // Neither → turn on AI → AI only
      onChannelChange('AI');
    }
  };
  
  return (
    <div className="flex items-center gap-1.5">
      {/* Human Icon Button */}
      <button
        onClick={toggleHuman}
        className={`p-2 rounded-full transition-all ${
          isHumanActive ? 'bg-black/40' : 'hover:bg-black/20'
        }`}
        title={isHumanActive ? "Hide human messages" : "Show human messages"}
      >
        <Users 
          className="w-5 h-5"
          style={{ 
            color: getDarkerColor(userColorRgb, 
              isHumanActive ? OPACITY_LEVELS.FULL : OPACITY_LEVELS.DARK
            )
          }}
        />
      </button>
      
      {/* AI Icon Button */}
      <button
        onClick={toggleAI}
        className={`p-2 rounded-full transition-all ${
          isAIActive ? 'bg-black/40' : 'hover:bg-black/20'
        }`}
        title={isAIActive ? "Hide AI messages" : "Show AI messages"}
      >
        <Sparkles 
          className="w-5 h-5"
          style={{ 
            color: getDarkerColor(userColorRgb, 
              isAIActive ? OPACITY_LEVELS.FULL : OPACITY_LEVELS.DARK
            )
          }}
        />
      </button>
    </div>
  );
};

export default MessageTypeToggle;

