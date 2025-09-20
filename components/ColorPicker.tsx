'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, Palette } from 'lucide-react';
import {
  COLOR_PALETTE,
  generateColorTheme,
  saveUserColor,
  loadUserColor,
  getRandomColor,
  getColorHistory,
  applyCSSColorTheme,
} from '@/modules/colorSystem';

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  className?: string;
}

/**
 * ColorPicker Component
 * A reusable color picker that integrates with the color system module
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({ 
  currentColor, 
  onColorChange,
  className = ''
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load color history on mount
  useEffect(() => {
    setRecentColors(getColorHistory());
  }, []);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  // Handle color selection
  const handleColorSelect = (color: string) => {
    onColorChange(color);
    saveUserColor(color);
    const theme = generateColorTheme(color);
    applyCSSColorTheme(theme);
    setRecentColors(getColorHistory());
    setShowPicker(false);
  };

  // Handle random color
  const handleRandomColor = () => {
    const newColor = getRandomColor();
    handleColorSelect(newColor);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Color picker trigger button */}
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="w-full h-full flex items-center justify-center hover:opacity-80 transition-opacity"
        style={{ color: currentColor }}
        title="Choose color (Press R for random)"
        tabIndex={-1}
      >
        <User className="w-5 h-5" />
      </button>

      {/* Color picker popup */}
      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full left-0 mb-2 p-3 bg-black/90 rounded-lg shadow-lg z-50 min-w-[200px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
            <span className="text-xs text-white/60 font-medium">Choose Color</span>
            <button
              onClick={handleRandomColor}
              className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors text-white/80"
              title="Random color (R key)"
            >
              <Palette className="w-3 h-3 inline mr-1" />
              Random
            </button>
          </div>

          {/* Recent colors (if any) */}
          {recentColors.length > 0 && (
            <>
              <div className="text-xs text-white/40 mb-2">Recent</div>
              <div className="grid grid-cols-5 gap-1 mb-3">
                {recentColors.map((color, index) => (
                  <button
                    key={`recent-${color}-${index}`}
                    onClick={() => handleColorSelect(color)}
                    className={`w-8 h-8 rounded-md transition-all ${
                      color === currentColor 
                        ? 'ring-2 ring-white/60 scale-110' 
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </>
          )}

          {/* Main color palette */}
          <div className="text-xs text-white/40 mb-2">Palette</div>
          <div className="grid grid-cols-4 gap-1">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className={`w-10 h-10 rounded-md transition-all ${
                  color === currentColor 
                    ? 'ring-2 ring-white/60 scale-110' 
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          {/* Current color display */}
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/40">Current</span>
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded border border-white/20"
                style={{ backgroundColor: currentColor }}
              />
              <span className="text-xs text-white/60 font-mono">
                {currentColor}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Custom hook for using the color picker with the color system
 */
export const useColorPicker = (initialColor?: string) => {
  const [color, setColor] = useState(() => initialColor || loadUserColor());
  const [theme, setTheme] = useState(() => generateColorTheme(color));

  useEffect(() => {
    // Apply theme on mount
    applyCSSColorTheme(theme);
  }, []);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    const newTheme = generateColorTheme(newColor);
    setTheme(newTheme);
    saveUserColor(newColor);
    applyCSSColorTheme(newTheme);
  };

  const randomize = () => {
    const newColor = getRandomColor();
    handleColorChange(newColor);
    return newColor;
  };

  return {
    color,
    theme,
    setColor: handleColorChange,
    randomize,
  };
};

export default ColorPicker;
