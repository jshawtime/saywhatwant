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

// Color palette in 9-digit format (RRRGGGBBB)
export const COLOR_PALETTE = [
  '096165250',  // blue-400
  '052211153',  // emerald-400
  '251191036',  // amber-400
  '248113113',  // red-400
  '167139250',  // violet-400
  '251146060',  // orange-400
  '074222128',  // green-400
  '244114182',  // pink-400
  '056189248',  // sky-400
  '163230053',  // lime-400
  '232121249',  // fuchsia-400
  '148163184',  // slate-400
] as const;

export const DEFAULT_COLOR = '096165250'; // blue-400 in 9-digit format

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

// ==========================================
// FORMAT CONVERSION FUNCTIONS
// ==========================================

/**
 * Convert 9-digit format (RRRGGGBBB) to rgb(r, g, b) string for CSS
 * 
 * This is the PRIMARY conversion function for displaying colors in the UI.
 * 
 * @param digits - 9-digit color string (e.g., "255165000")
 * @returns RGB color string for CSS (e.g., "rgb(255, 165, 0)")
 * 
 * @example
 * nineDigitToRgb("255165000") // Returns: "rgb(255, 165, 0)"
 * nineDigitToRgb("096165250") // Returns: "rgb(96, 165, 250)"
 */
export const nineDigitToRgb = (digits: string): string => {
  if (!/^\d{9}$/.test(digits)) {
    // If already RGB format, return as-is (backwards compatibility)
    if (digits.startsWith('rgb(')) return digits;
    console.warn('[ColorSystem] Invalid 9-digit format, using default:', digits);
    // Default fallback - blue-400
    return 'rgb(96, 165, 250)';
  }
  
  const r = parseInt(digits.slice(0, 3), 10);
  const g = parseInt(digits.slice(3, 6), 10);
  const b = parseInt(digits.slice(6, 9), 10);
  
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Convert RGB format to 9-digit format (RRRGGGBBB) for storage/URLs
 * 
 * This is the PRIMARY conversion function for storing colors in databases and URLs.
 * 
 * @param color - RGB color string (e.g., "rgb(255, 165, 0)") or 9-digit string
 * @returns 9-digit color string (e.g., "255165000")
 * 
 * @example
 * rgbToNineDigit("rgb(255, 165, 0)") // Returns: "255165000"
 * rgbToNineDigit("255165000")        // Returns: "255165000" (already 9-digit)
 */
export const rgbToNineDigit = (color: string): string => {
  // Already in 9-digit format - return as-is
  if (/^\d{9}$/.test(color)) {
    return color;
  }
  
  // Parse rgb(r, g, b) format
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) {
    console.warn('[ColorSystem] Invalid RGB format, using default:', color);
    return '096165250'; // Default blue-400
  }
  
  const [, r, g, b] = match;
  const rStr = r.padStart(3, '0');
  const gStr = g.padStart(3, '0');
  const bStr = b.padStart(3, '0');
  
  return `${rStr}${gStr}${bStr}`;
};

/**
 * Gets a random color in 9-digit format (RRRGGGBBB)
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
  
  // Return 9-digit format (RRRGGGBBB) instead of RGB string
  const rStr = r.toString().padStart(3, '0');
  const gStr = g.toString().padStart(3, '0');
  const bStr = b.toString().padStart(3, '0');
  
  return `${rStr}${gStr}${bStr}`;
};

/**
 * Gets a random color from the old palette (legacy function)
 */
export const getRandomColorFromPalette = (): string => {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
};

// ==========================================
// TYPE GUARDS & VALIDATORS
// ==========================================

/**
 * Check if a string is in 9-digit format (RRRGGGBBB)
 * 
 * @param color - Color string to check
 * @returns true if the color is in 9-digit format
 * 
 * @example
 * isNineDigitFormat("255165000")          // true
 * isNineDigitFormat("rgb(255, 165, 0)")   // false
 * isNineDigitFormat("25516500")           // false (only 8 digits)
 */
export const isNineDigitFormat = (color: string): boolean => {
  return /^\d{9}$/.test(color);
};

/**
 * Check if a string is in RGB format (rgb(r, g, b))
 * 
 * @param color - Color string to check
 * @returns true if the color is in RGB format
 * 
 * @example
 * isRgbFormat("rgb(255, 165, 0)")   // true
 * isRgbFormat("255165000")          // false
 * isRgbFormat("rgb(255,165,0)")     // true (spaces optional)
 */
export const isRgbFormat = (color: string): boolean => {
  return /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/.test(color);
};

// ==========================================
// SAFE CONVERTERS
// ==========================================

/**
 * Ensure a color string is in 9-digit format, converting if necessary
 * 
 * This function ALWAYS returns a valid 9-digit color, even if input is invalid.
 * Use this when you need guaranteed 9-digit format (storage, URLs, filtering).
 * 
 * @param color - Color string in any format
 * @returns Color in 9-digit format, guaranteed
 * 
 * @example
 * ensureNineDigit("255165000")          // "255165000" (already 9-digit)
 * ensureNineDigit("rgb(255, 165, 0)")   // "255165000" (converted)
 * ensureNineDigit("invalid")            // "096165250" (default blue)
 */
export const ensureNineDigit = (color: string): string => {
  if (isNineDigitFormat(color)) {
    return color;
  }
  
  if (isRgbFormat(color)) {
    return rgbToNineDigit(color);
  }
  
  console.warn('[ColorSystem] Unknown color format, using default blue:', color);
  return DEFAULT_COLOR; // Default blue-400 in 9-digit format
};

/**
 * Ensure a color string is in RGB format, converting if necessary
 * 
 * This function ALWAYS returns a valid RGB color, even if input is invalid.
 * Use this when you need guaranteed RGB format (CSS, styling, display).
 * 
 * @param color - Color string in any format
 * @returns Color in RGB format, guaranteed
 * 
 * @example
 * ensureRgb("rgb(255, 165, 0)")   // "rgb(255, 165, 0)" (already RGB)
 * ensureRgb("255165000")          // "rgb(255, 165, 0)" (converted)
 * ensureRgb("invalid")            // "rgb(96, 165, 250)" (default blue)
 */
export const ensureRgb = (color: string): string => {
  if (isRgbFormat(color)) {
    return color;
  }
  
  if (isNineDigitFormat(color)) {
    return nineDigitToRgb(color);
  }
  
  console.warn('[ColorSystem] Unknown color format, using default blue:', color);
  return nineDigitToRgb(DEFAULT_COLOR); // Default blue-400 in RGB format
};

// ==========================================
// COMMENT COLOR HANDLING
// ==========================================

/**
 * Get the display color for a comment (converts 9-digit → RGB for CSS)
 * 
 * This is the MAIN function for getting comment colors for rendering.
 * It handles the conversion from stored format (9-digit) to display format (RGB).
 * 
 * REPLACES: usernameColorGenerator.ts getCommentColor()
 * 
 * @param comment - Comment object with optional color field
 * @returns RGB color string for CSS styling
 * 
 * @example
 * getCommentColor({ color: "255165000" })     // "rgb(255, 165, 0)"
 * getCommentColor({ color: "rgb(96,165,250)"}) // "rgb(96, 165, 250)"
 * getCommentColor({})                          // "rgb(156, 163, 175)" (gray fallback)
 */
export const getCommentColor = (comment: { color?: string; username?: string }): string => {
  // If no color exists, return gray fallback
  if (!comment.color) {
    console.warn('[ColorSystem] Comment has no color, using gray fallback:', comment.username || 'Anonymous');
    return 'rgb(156, 163, 175)'; // Gray fallback for messages without colors
  }
  
  // Convert to RGB for CSS display
  return ensureRgb(comment.color);
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
  
  // Core Conversion Functions (PRIMARY)
  nineDigitToRgb,
  rgbToNineDigit,
  
  // Type Guards & Validators (NEW)
  isNineDigitFormat,
  isRgbFormat,
  
  // Safe Converters (NEW)
  ensureNineDigit,
  ensureRgb,
  
  // Comment Color Handling (NEW)
  getCommentColor,
  
  // Color Manipulation
  hexToRgb,
  rgbToHex,
  adjustColorBrightness,
  getDarkerColor,
  
  // Color Generation
  getRandomColor,
  getRandomColorFromPalette,
  
  // Legacy Validators
  isValidHexColor,
  isValidRgbColor,
  parseRgbString,
  rgbStringToHex,
  
  // Theme System
  generateColorTheme,
  applyCSSColorTheme,
  
  // Storage Functions
  saveUserColor,
  loadUserColor,
  getColorHistory,
  
  // Logic for hooks
  useColorSystemLogic,
};
