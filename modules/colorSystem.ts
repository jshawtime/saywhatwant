/**
 * Color System Module
 * Centralized color management for the application
 */

// ==========================================
// CONSTANTS
// ==========================================

// RGB-based color generation ranges (brightened for better visibility)
export const RGB_RANGES = {
  MAIN: { min: 150, max: 230 },      // 81 possible values
  SECONDARY: { min: 150, max: 230 }, // 81 possible values  
  THIRD: { min: 80, max: 80 },       // Fixed at 80
} as const;

// Total unique colors: 81 × 81 × 6 permutations = 39,366 unique colors
// (6 permutations because we can assign these ranges to R,G,B in 6 different ways)

// Legacy palette for backwards compatibility
export const COLOR_PALETTE = [
  'rgb(96, 165, 250)',  // blue-400
  'rgb(52, 211, 153)',  // emerald-400
  'rgb(251, 191, 36)',  // amber-400
  'rgb(248, 113, 113)', // red-400
  'rgb(167, 139, 250)', // violet-400
  'rgb(251, 146, 60)',  // orange-400
  'rgb(74, 222, 128)',  // green-400
  'rgb(244, 114, 182)', // pink-400
  'rgb(56, 189, 248)',  // sky-400
  'rgb(163, 230, 53)',  // lime-400
  'rgb(232, 121, 249)', // fuchsia-400
  'rgb(148, 163, 184)', // slate-400
] as const;

export const DEFAULT_COLOR = 'rgb(96, 165, 250)'; // blue-400 in RGB

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
 * @param color - Hex or RGB color string
 * @param factor - Brightness factor (0-1)
 * @returns RGB color string for CSS
 */
export const adjustColorBrightness = (color: string, factor: number = 1): string => {
  let r, g, b;
  
  // Handle both hex and RGB formats
  if (color.startsWith('rgb')) {
    const parsed = parseRgbString(color);
    if (!parsed) return color;
    ({ r, g, b } = parsed);
  } else {
    ({ r, g, b } = hexToRgb(color));
  }
  
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
 * Gets a random RGB color using sophisticated range-based generation
 * Creates bright, visible colors with good contrast on dark backgrounds
 * Total possible colors: 81 × 81 × 6 = 39,366 unique combinations
 */
export const getRandomColor = (): string => {
  // Get random values for each range
  const mainValue = Math.floor(Math.random() * (RGB_RANGES.MAIN.max - RGB_RANGES.MAIN.min + 1)) + RGB_RANGES.MAIN.min;
  const secondaryValue = Math.floor(Math.random() * (RGB_RANGES.SECONDARY.max - RGB_RANGES.SECONDARY.min + 1)) + RGB_RANGES.SECONDARY.min;
  const thirdValue = RGB_RANGES.THIRD.min; // Fixed at 80
  
  // Randomly assign these values to R, G, B channels
  // This creates 6 different color families
  const permutation = Math.floor(Math.random() * 6);
  let r, g, b;
  
  switch (permutation) {
    case 0: // Main=R, Secondary=G, Third=B (Warm colors)
      r = mainValue;
      g = secondaryValue;
      b = thirdValue;
      break;
    case 1: // Main=R, Secondary=B, Third=G (Magenta-ish)
      r = mainValue;
      g = thirdValue;
      b = secondaryValue;
      break;
    case 2: // Main=G, Secondary=R, Third=B (Yellow-green)
      r = secondaryValue;
      g = mainValue;
      b = thirdValue;
      break;
    case 3: // Main=G, Secondary=B, Third=R (Cyan-ish)
      r = thirdValue;
      g = mainValue;
      b = secondaryValue;
      break;
    case 4: // Main=B, Secondary=R, Third=G (Purple-ish)
      r = secondaryValue;
      g = thirdValue;
      b = mainValue;
      break;
    case 5: // Main=B, Secondary=G, Third=R (Blue-cyan)
    default:
      r = thirdValue;
      g = secondaryValue;
      b = mainValue;
      break;
  }
  
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Gets a random color from the old palette (legacy function)
 */
export const getRandomColorFromPalette = (): string => {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
};

/**
 * Validates if a string is a valid hex color
 */
export const isValidHexColor = (color: string): boolean => {
  return /^#[0-9A-F]{6}$/i.test(color);
};

/**
 * Validates if a string is a valid RGB color
 */
export const isValidRgbColor = (color: string): boolean => {
  return /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/i.test(color);
};

/**
 * Parses RGB string to values
 */
export const parseRgbString = (rgb: string): { r: number; g: number; b: number } | null => {
  const match = rgb.match(/^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
  };
};

/**
 * Converts RGB string to hex
 */
export const rgbStringToHex = (rgb: string): string => {
  const parsed = parseRgbString(rgb);
  if (!parsed) return '#000000';
  return rgbToHex(parsed.r, parsed.g, parsed.b);
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
    if (saved) {
      // Support both hex and RGB formats
      if (isValidHexColor(saved)) {
        // Convert old hex colors to RGB
        const { r, g, b } = hexToRgb(saved);
        const rgbColor = `rgb(${r}, ${g}, ${b})`;
        // Update storage to new format
        localStorage.setItem(STORAGE_KEYS.USER_COLOR, rgbColor);
        return rgbColor;
      } else if (isValidRgbColor(saved)) {
        return saved;
      }
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
  RGB_RANGES,
  
  // Functions
  hexToRgb,
  rgbToHex,
  adjustColorBrightness,
  getDarkerColor,
  getRandomColor,
  getRandomColorFromPalette,
  isValidHexColor,
  isValidRgbColor,
  parseRgbString,
  rgbStringToHex,
  generateColorTheme,
  saveUserColor,
  loadUserColor,
  getColorHistory,
  applyCSSColorTheme,
  
  // Logic for hooks
  useColorSystemLogic,
};
