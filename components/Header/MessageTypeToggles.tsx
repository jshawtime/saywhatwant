/**
 * MessageTypeToggles Component
 * 
 * Toggle buttons for filtering by message type (Humans vs AI Entities)
 * Pure presentation component with icon-based toggles
 */

import React from 'react';
import { Users, Sparkles } from 'lucide-react';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';

interface MessageTypeTogglesProps {
  /**
   * Whether human messages are shown
   */
  showHumans: boolean;
  
  /**
   * Whether AI entity messages are shown
   */
  showEntities: boolean;
  
  /**
   * User's color in RGB format for styling
   */
  userColorRgb: string;
  
  /**
   * Callback when humans toggle is clicked
   */
  onToggleHumans: () => void;
  
  /**
   * Callback when entities toggle is clicked
   */
  onToggleEntities: () => void;
}

/**
 * MessageTypeToggles Component
 * 
 * Displays two toggle buttons for filtering messages by type:
 * - Humans (Users icon) - Regular user messages
 * - Entities (Sparkles icon) - AI-generated messages
 * 
 * Active state: 60% opacity with background
 * Inactive state: 40% opacity, no background
 * 
 * @example
 * <MessageTypeToggles
 *   showHumans={true}
 *   showEntities={true}
 *   userColorRgb="rgb(255, 165, 0)"
 *   onToggleHumans={() => setShowHumans(!showHumans)}
 *   onToggleEntities={() => setShowEntities(!showEntities)}
 * />
 */
export const MessageTypeToggles: React.FC<MessageTypeTogglesProps> = ({
  showHumans,
  showEntities,
  userColorRgb,
  onToggleHumans,
  onToggleEntities
}) => {
  return (
    <div className="flex gap-1.5">
      {/* Humans Button */}
      <button
        onClick={onToggleHumans}
        className={`px-2.5 py-1.5 rounded-full transition-all ${
          showHumans ? 'bg-black/40' : 'hover:bg-black/20'
        }`}
        title={showHumans ? "Hide human messages" : "Show human messages"}
      >
        <Users 
          className="w-3.5 h-3.5"
          style={{ 
            color: getDarkerColor(userColorRgb, showHumans 
              ? OPACITY_LEVELS.LIGHT  // Active: 60% opacity
              : OPACITY_LEVELS.DARK   // Inactive: 40% opacity
            )
          }}
        />
      </button>
      
      {/* Entities Button */}
      <button
        onClick={onToggleEntities}
        className={`px-2.5 py-1.5 rounded-full transition-all ${
          showEntities ? 'bg-black/40' : 'hover:bg-black/20'
        }`}
        title={showEntities ? "Hide entity messages" : "Show entity messages"}
      >
        <Sparkles 
          className="w-3.5 h-3.5"
          style={{ 
            color: getDarkerColor(userColorRgb, showEntities 
              ? OPACITY_LEVELS.LIGHT  // Active: 60% opacity
              : OPACITY_LEVELS.DARK   // Inactive: 40% opacity
            )
          }}
        />
      </button>
    </div>
  );
};

export default MessageTypeToggles;

