/**
 * useColorPicker Hook
 * 
 * Manages user color selection and color picker state
 * Handles random color generation, localStorage persistence, and picker visibility
 */

import { useState, useMemo, useLayoutEffect } from 'react';
import { getRandomColor, nineDigitToRgb, DEFAULT_COLOR } from '@/modules/colorSystem';
import { rgbToNineDigit } from '@/lib/url-filter-simple';

interface UseColorPickerReturn {
  userColor: string;           // 9-digit color format
  userColorRgb: string;        // RGB format for CSS
  showColorPicker: boolean;
  randomizedColors: string[];  // 12 random colors for picker grid
  toggleColorPicker: () => void;
  selectColor: (color: string) => void;
  setUserColor: (color: string) => void;
  setShowColorPicker: (show: boolean) => void; // For external close (click outside)
}

export function useColorPicker(initialColor?: string): UseColorPickerReturn {
  // Server has no value, client sets in useLayoutEffect (100% client-side)
  const [userColor, setUserColor] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [randomizedColors, setRandomizedColors] = useState<string[]>([]);
  
  // Set client color - runs BEFORE paint (client-only)
  useLayoutEffect(() => {
    const saved = localStorage.getItem('sww-color');
    if (saved) {
      setUserColor(saved);
    } else {
      const newColor = getRandomColor();
      setUserColor(newColor);
      localStorage.setItem('sww-color', newColor);
    }
  }, []);
  
  // Convert to RGB for CSS
  const userColorRgb = useMemo(() => nineDigitToRgb(userColor), [userColor]);
  
  // Shuffle colors array
  const shuffleColors = () => {
    // Generate 12 unique random colors for the color picker
    const colors: string[] = [];
    const usedColors = new Set<string>();
    
    while (colors.length < 12) {
      const color = getRandomColor();
      // Ensure we don't have duplicates
      if (!usedColors.has(color)) {
        colors.push(color);
        usedColors.add(color);
      }
    }
    
    setRandomizedColors(colors);
  };
  
  // Toggle color picker with randomization
  const toggleColorPicker = () => {
    if (!showColorPicker) {
      shuffleColors();
    }
    setShowColorPicker(!showColorPicker);
  };
  
  // Handle color selection
  const selectColor = (color: string) => {
    setUserColor(color);
    localStorage.setItem('sww-color', color);
    window.dispatchEvent(new Event('colorChanged'));
    setShowColorPicker(false);
  };
  
  return {
    userColor,
    userColorRgb,
    showColorPicker,
    randomizedColors,
    toggleColorPicker,
    selectColor,
    setUserColor,
    setShowColorPicker,
  };
}

