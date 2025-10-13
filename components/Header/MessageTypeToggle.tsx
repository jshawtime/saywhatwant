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
   * Currently active channel ('human', 'AI', or 'ALL')
   */
  activeChannel: 'human' | 'AI' | 'ALL';
  
  /**
   * User's color in RGB format for styling
   */
  userColorRgb: string;
  
  /**
   * Callback when channel changes
   */
  onChannelChange: (channel: 'human' | 'AI' | 'ALL') => void;
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
  // When activeChannel is 'ALL', show as neither fully active
  const isHumanActive = activeChannel === 'human';
  const isAIActive = activeChannel === 'AI';
  const isALLActive = activeChannel === 'ALL';
  
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
          (isHumanActive || isALLActive) ? 'bg-black/40' : 'hover:bg-black/20'
        }`}
        title={isHumanActive ? "Viewing Human channel" : isALLActive ? "Viewing All channels" : "Switch to Human channel"}
      >
        <Users 
          className="w-3.5 h-3.5"
          style={{ 
            color: getDarkerColor(userColorRgb, 
              (isHumanActive || isALLActive) ? OPACITY_LEVELS.FULL : OPACITY_LEVELS.DARK
            )
          }}
        />
      </button>
      
      {/* AI Icon Button */}
      <button
        onClick={() => onChannelChange('AI')}
        className={`p-2 rounded-full transition-all ${
          (isAIActive || isALLActive) ? 'bg-black/40' : 'hover:bg-black/20'
        }`}
        title={isAIActive ? "Viewing AI channel" : isALLActive ? "Viewing All channels" : "Switch to AI channel"}
      >
        <Sparkles 
          className="w-3.5 h-3.5"
          style={{ 
            color: getDarkerColor(userColorRgb, 
              (isAIActive || isALLActive) ? OPACITY_LEVELS.FULL : OPACITY_LEVELS.DARK
            )
          }}
        />
      </button>
    </div>
  );
};

export default MessageTypeToggle;

