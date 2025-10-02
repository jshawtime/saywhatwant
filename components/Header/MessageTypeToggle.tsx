/**
 * MessageTypeToggle Component
 * 
 * Exclusive toggle switch between Human and AI channels (Ham Radio concept)
 * User can only view ONE channel at a time - forces focus and engagement
 */

import React from 'react';
import { Users, Sparkles } from 'lucide-react';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';

interface MessageTypeToggleProps {
  /**
   * Currently active channel ('human' or 'AI')
   */
  activeChannel: 'human' | 'AI';
  
  /**
   * User's color in RGB format for styling
   */
  userColorRgb: string;
  
  /**
   * Callback when channel changes
   */
  onChannelChange: (channel: 'human' | 'AI') => void;
}

/**
 * MessageTypeToggle Component
 * 
 * Slider toggle switch that allows user to select ONE message channel:
 * - Human: Regular user messages
 * - AI: AI-generated entity messages
 * 
 * **Ham Radio Concept**: Tune to ONE frequency at a time.
 * Want both? Open two tabs! Each tab contributes to shared IndexedDB.
 * 
 * @example
 * <MessageTypeToggle
 *   activeChannel="human"
 *   userColorRgb="rgb(255, 165, 0)"
 *   onChannelChange={(channel) => setMessageType(channel)}
 * />
 */
export const MessageTypeToggle: React.FC<MessageTypeToggleProps> = ({
  activeChannel,
  userColorRgb,
  onChannelChange
}) => {
  const isHumanActive = activeChannel === 'human';
  
  // Debug: Log the active channel on mount and changes
  React.useEffect(() => {
    console.log('[MessageTypeToggle] Active channel:', activeChannel, 'isHumanActive:', isHumanActive);
  }, [activeChannel, isHumanActive]);
  
  return (
    <div className="flex items-center gap-1.5">
      {/* Human Icon Button */}
      <button
        onClick={() => onChannelChange('human')}
        className={`p-2 rounded-full transition-all ${
          isHumanActive ? 'bg-black/40' : 'hover:bg-black/20'
        }`}
        title={isHumanActive ? "Viewing Human channel" : "Switch to Human channel"}
      >
        <Users 
          className="w-3.5 h-3.5"
          style={{ 
            color: getDarkerColor(userColorRgb, isHumanActive 
              ? OPACITY_LEVELS.FULL    // Active: 100% opacity
              : OPACITY_LEVELS.DARK    // Inactive: 40% opacity
            )
          }}
        />
      </button>
      
      {/* Slider Track */}
      <div 
        className="relative w-12 h-6 rounded-full cursor-pointer transition-all"
        style={{
          backgroundColor: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST * 0.5),
          border: `1px solid ${getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK)}`
        }}
        onClick={() => onChannelChange(isHumanActive ? 'AI' : 'human')}
      >
        {/* Slider Thumb */}
        <div 
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 ease-out"
          style={{
            left: isHumanActive ? '2px' : 'calc(100% - 22px)',
            backgroundColor: getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT),
            boxShadow: `0 2px 4px ${getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST)}`
          }}
        />
      </div>
      
      {/* AI Icon Button */}
      <button
        onClick={() => onChannelChange('AI')}
        className={`p-2 rounded-full transition-all ${
          !isHumanActive ? 'bg-black/40' : 'hover:bg-black/20'
        }`}
        title={!isHumanActive ? "Viewing AI channel" : "Switch to AI channel"}
      >
        <Sparkles 
          className="w-3.5 h-3.5"
          style={{ 
            color: getDarkerColor(userColorRgb, !isHumanActive 
              ? OPACITY_LEVELS.FULL    // Active: 100% opacity
              : OPACITY_LEVELS.DARK    // Inactive: 40% opacity
            )
          }}
        />
      </button>
    </div>
  );
};

export default MessageTypeToggle;

