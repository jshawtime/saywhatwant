/**
 * Color System Module
 * Centralized color management for the application
 */

// ==========================================
// CONSTANTS
// ==========================================

export const COLOR_PALETTE = [
  '#60A5FA', // blue-400
  '#34D399', // emerald-400
  '#FBBF24', // amber-400
  '#F87171', // red-400
  '#A78BFA', // violet-400
  '#FB923C', // orange-400
  '#4ADE80', // green-400
  '#F472B6', // pink-400
  '#38BDF8', // sky-400
  '#A3E635', // lime-400
  '#E879F9', // fuchsia-400
  '#94A3B8', // slate-400
] as const;

export const DEFAULT_COLOR = '#60A5FA'; // blue-400

// Color brightness levels for different UI elements
export const COLOR_BRIGHTNESS = {
  FULL: 1.0,      // 100% - Message text, icons
  BRIGHT: 0.7,    // 70% - Time tags
  MEDIUM: 0.6,    // 60% - Usernames, buttons
  SUBTLE: 0.3,    // 30% - Borders
  FAINT: 0.08,    // 8% - Backgrounds
} as const;

// Special colors
export const SPECIAL_COLORS = {
  NEGATIVE_FILTER: '#8B0000', // Dark red for exclude filters
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
  USER_COLOR: 'sww-userColor',
  COLOR_HISTORY: 'sww-colorHistory',
} as const;

// ==========================================
// COLOR MANIPULATION FUNCTIONS
// ==========================================

/**
 * Converts hex color to RGB values
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return { r, g, b };
};

/**
 * Converts RGB values to hex color
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Gets a color with adjusted brightness
 * @param color - Hex color string
 * @param factor - Brightness factor (0-1)
 * @returns RGB color string for CSS
 */
export const adjustColorBrightness = (color: string, factor: number = 1): string => {
  const { r, g, b } = hexToRgb(color);
  const adjustedR = Math.floor(r * factor);
  const adjustedG = Math.floor(g * factor);
  const adjustedB = Math.floor(b * factor);
  return `rgb(${adjustedR}, ${adjustedG}, ${adjustedB})`;
};

/**
 * Legacy function for backwards compatibility
 * @deprecated Use adjustColorBrightness instead
 */
export const getDarkerColor = adjustColorBrightness;

/**
 * Gets a random color from the palette
 */
export const getRandomColor = (): string => {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
};

/**
 * Validates if a string is a valid hex color
 */
export const isValidHexColor = (color: string): boolean => {
  return /^#[0-9A-F]{6}$/i.test(color);
};

// ==========================================
// COLOR THEME GENERATION
// ==========================================

/**
 * Generates a complete color theme based on a single base color
 */
export interface ColorTheme {
  base: string;           // 100% - Original color
  text: string;           // 100% - Message text
  username: string;       // 60% - Username display
  buttonBg: string;       // 60% - Button background
  buttonIcon: string;     // 100% - Button icon
  timeTag: string;        // 70% - Time tag text
  border: string;         // 30% - Borders
  bgSubtle: string;       // 8% - Subtle backgrounds
  placeholder: string;    // 60% - Placeholder text
}

export const generateColorTheme = (baseColor: string = DEFAULT_COLOR): ColorTheme => {
  return {
    base: baseColor,
    text: baseColor,
    username: adjustColorBrightness(baseColor, COLOR_BRIGHTNESS.MEDIUM),
    buttonBg: adjustColorBrightness(baseColor, COLOR_BRIGHTNESS.MEDIUM),
    buttonIcon: baseColor,
    timeTag: adjustColorBrightness(baseColor, COLOR_BRIGHTNESS.BRIGHT),
    border: adjustColorBrightness(baseColor, COLOR_BRIGHTNESS.SUBTLE),
    bgSubtle: adjustColorBrightness(baseColor, COLOR_BRIGHTNESS.FAINT),
    placeholder: adjustColorBrightness(baseColor, COLOR_BRIGHTNESS.MEDIUM),
  };
};

// ==========================================
// STORAGE FUNCTIONS
// ==========================================

/**
 * Saves user color to localStorage
 */
export const saveUserColor = (color: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.USER_COLOR, color);
    
    // Also save to color history (last 5 colors)
    const history = getColorHistory();
    const newHistory = [color, ...history.filter(c => c !== color)].slice(0, 5);
    localStorage.setItem(STORAGE_KEYS.COLOR_HISTORY, JSON.stringify(newHistory));
  } catch (error) {
    console.error('[ColorSystem] Failed to save color:', error);
  }
};

/**
 * Loads user color from localStorage
 */
export const loadUserColor = (): string => {
  if (typeof window === 'undefined') return DEFAULT_COLOR;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_COLOR);
    if (saved && isValidHexColor(saved)) {
      return saved;
    }
  } catch (error) {
    console.error('[ColorSystem] Failed to load color:', error);
  }
  
  return DEFAULT_COLOR;
};

/**
 * Gets color history from localStorage
 */
export const getColorHistory = (): string[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.COLOR_HISTORY);
    if (saved) {
      const history = JSON.parse(saved);
      if (Array.isArray(history)) {
        return history.filter(isValidHexColor);
      }
    }
  } catch (error) {
    console.error('[ColorSystem] Failed to load color history:', error);
  }
  
  return [];
};

// ==========================================
// CSS VARIABLE MANAGEMENT
// ==========================================

/**
 * Updates CSS variables with color theme
 */
export const applyCSSColorTheme = (theme: ColorTheme): void => {
  if (typeof window === 'undefined') return;
  
  const root = document.documentElement;
  root.style.setProperty('--user-color-base', theme.base);
  root.style.setProperty('--user-color-text', theme.text);
  root.style.setProperty('--user-color-username', theme.username);
  root.style.setProperty('--user-color-button-bg', theme.buttonBg);
  root.style.setProperty('--user-color-button-icon', theme.buttonIcon);
  root.style.setProperty('--user-color-time-tag', theme.timeTag);
  root.style.setProperty('--user-color-border', theme.border);
  root.style.setProperty('--user-color-bg-subtle', theme.bgSubtle);
  root.style.setProperty('--user-color-placeholder', theme.placeholder);
};

// ==========================================
// REACT HOOKS
// ==========================================

/**
 * Custom hook for using the color system
 * Note: This is just the logic, the actual React hook would be in a .tsx file
 */
export const useColorSystemLogic = () => {
  const loadColor = () => loadUserColor();
  
  const saveColor = (color: string) => {
    saveUserColor(color);
    const theme = generateColorTheme(color);
    applyCSSColorTheme(theme);
    return theme;
  };
  
  const randomizeColor = () => {
    const newColor = getRandomColor();
    return saveColor(newColor);
  };
  
  const getTheme = (color?: string) => {
    return generateColorTheme(color || loadColor());
  };
  
  return {
    loadColor,
    saveColor,
    randomizeColor,
    getTheme,
    palette: COLOR_PALETTE,
    history: getColorHistory,
  };
};

// ==========================================
// EXPORTS SUMMARY
// ==========================================

export default {
  // Constants
  COLOR_PALETTE,
  DEFAULT_COLOR,
  COLOR_BRIGHTNESS,
  SPECIAL_COLORS,
  STORAGE_KEYS,
  
  // Functions
  hexToRgb,
  rgbToHex,
  adjustColorBrightness,
  getDarkerColor,
  getRandomColor,
  isValidHexColor,
  generateColorTheme,
  saveUserColor,
  loadUserColor,
  getColorHistory,
  applyCSSColorTheme,
  
  // Logic for hooks
  useColorSystemLogic,
};
