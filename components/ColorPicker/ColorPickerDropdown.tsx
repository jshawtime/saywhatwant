/**
 * ColorPickerDropdown Component
 * 
 * Displays a grid of randomized colors for user selection
 * Pure presentational component - no state management
 */

import React from 'react';
import { StyledUserIcon } from '@/components/UIElements';
import { nineDigitToRgb } from '@/modules/colorSystem';

interface ColorPickerDropdownProps {
  colors: string[]; // Array of 9-digit color codes
  onSelectColor: (color: string) => void;
  isVisible: boolean;
}

export const ColorPickerDropdown: React.FC<ColorPickerDropdownProps> = ({
  colors,
  onSelectColor,
  isVisible,
}) => {
  if (!isVisible) return null;
  
  return (
    <div className="absolute top-full left-0 mt-1 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-2 grid grid-cols-6 gap-1 z-20 shadow-xl">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onSelectColor(color)}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          aria-label={`Select color ${color}`}
        >
          <StyledUserIcon userColor={nineDigitToRgb(color)} />
        </button>
      ))}
    </div>
  );
};

