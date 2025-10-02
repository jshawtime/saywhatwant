/**
 * CharacterCounter Component
 * 
 * Displays character count for textarea input
 * Shows current/max characters remaining
 */

import React from 'react';

interface CharacterCounterProps {
  /**
   * Current character count
   */
  current: number;
  
  /**
   * Maximum allowed characters
   */
  max: number;
  
  /**
   * User's color in RGB format for styling
   */
  userColor: string;
}

/**
 * CharacterCounter Component
 * 
 * Displays as "current/max" in the top-right of textarea
 * 
 * @example
 * <CharacterCounter
 *   current={50}
 *   max={201}
 *   userColor="rgb(255, 165, 0)"
 * />
 */
export const CharacterCounter: React.FC<CharacterCounterProps> = ({
  current,
  max,
  userColor
}) => {
  return (
    <div
      className="absolute top-2 right-2 text-xs pointer-events-none z-10"
      style={{ color: userColor }}
    >
      {current}/{max}
    </div>
  );
};

export default CharacterCounter;

