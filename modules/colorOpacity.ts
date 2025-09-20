/**
 * Color Opacity Module - Standardized Opacity Levels
 * 
 * CRITICAL: ONLY USE THESE 6 OPACITY LEVELS - DO NOT ADD NEW ONES
 * 
 * This module defines exactly 6 opacity levels for UI consistency.
 * When implementing UI elements, choose from these predefined levels only.
 * No custom opacity values should be used elsewhere in the codebase.
 * 
 * @author AI Agent
 * @version 1.0.0
 */

import { getDarkerColor } from './colorSystem';

/**
 * Standard opacity levels from lightest to darkest
 * NEVER add new levels - only use these 6
 */
export const OPACITY_LEVELS = {
  LIGHTEST: 0.1,  // 10% - Very faint backgrounds
  LIGHTER: 0.2,   // 20% - Faint backgrounds, inactive states
  LIGHT: 0.4,     // 40% - Placeholder text, very subtle elements  
  MEDIUM: 0.5,    // 50% - Borders, inactive filters
  DARK: 0.6,      // 60% - Icons, usernames, secondary text
  FULL: 1.0,      // 100% - Primary text, active elements
} as const;

/**
 * Apply standard opacity to a color
 * 
 * @param color - The base color (hex or rgb)
 * @param level - One of the 6 standard opacity levels
 * @returns Color with applied opacity
 * 
 * @example
 * applyOpacity(userColor, OPACITY_LEVELS.DARK) // 60% opacity
 * applyOpacity(userColor, OPACITY_LEVELS.LIGHT) // 40% opacity
 */
export function applyOpacity(color: string, level: number): string {
  if (!Object.values(OPACITY_LEVELS).includes(level)) {
    console.warn(`[ColorOpacity] Invalid opacity level: ${level}. Using FULL (1.0)`);
    return color;
  }
  
  return level === 1.0 ? color : getDarkerColor(color, level);
}

/**
 * UI Element Color Mapping - Standard assignments
 * These are the ONLY approved opacity assignments for UI elements
 * DO NOT create custom opacity values
 */
export const UI_ELEMENT_OPACITY = {
  // FULL (100%)
  MESSAGE_TEXT: OPACITY_LEVELS.FULL,
  ACTIVE_FILTER: OPACITY_LEVELS.FULL,
  ACTIVE_DOMAIN_LED: OPACITY_LEVELS.FULL,
  
  // DARK (60%)
  USERNAME: OPACITY_LEVELS.DARK,
  FILTER_ICON: OPACITY_LEVELS.DARK,
  SEARCH_ICON: OPACITY_LEVELS.DARK,
  CLEAR_BUTTON: OPACITY_LEVELS.DARK,
  CHARACTER_COUNTER: OPACITY_LEVELS.DARK,
  
  // MEDIUM (50%)
  BORDER_ACTIVE: OPACITY_LEVELS.MEDIUM,
  INACTIVE_FILTER: OPACITY_LEVELS.MEDIUM,
  
  // LIGHT (40%)
  PLACEHOLDER_TEXT: OPACITY_LEVELS.LIGHT,
  SEARCH_PLACEHOLDER: OPACITY_LEVELS.LIGHT,
  
  // LIGHTER (20%)
  INACTIVE_DOMAIN_LED: OPACITY_LEVELS.LIGHTER,
  FAINT_BACKGROUND: OPACITY_LEVELS.LIGHTER,
  
  // LIGHTEST (10%)
  VERY_FAINT_BACKGROUND: OPACITY_LEVELS.LIGHTEST,
  HOVER_BACKGROUND: OPACITY_LEVELS.LIGHTEST,
} as const;

/**
 * Get the opacity level name for debugging
 */
export function getOpacityLevelName(level: number): string {
  const entry = Object.entries(OPACITY_LEVELS).find(([_, value]) => value === level);
  return entry ? entry[0] : 'UNKNOWN';
}

/**
 * Quick reference for AI agents:
 * 
 * When user says:
 * - "Make it lightest" → OPACITY_LEVELS.LIGHTEST (10%)
 * - "Make it lighter" → OPACITY_LEVELS.LIGHTER (20%)
 * - "Make it light" → OPACITY_LEVELS.LIGHT (40%)
 * - "Make it medium" → OPACITY_LEVELS.MEDIUM (50%)
 * - "Make it dark" → OPACITY_LEVELS.DARK (60%)
 * - "Make it full/darkest" → OPACITY_LEVELS.FULL (100%)
 * 
 * Example usage in components:
 * ```
 * import { applyOpacity, OPACITY_LEVELS } from '@/modules/colorOpacity';
 * 
 * style={{ color: applyOpacity(userColor, OPACITY_LEVELS.DARK) }}
 * ```
 */

export default {
  OPACITY_LEVELS,
  UI_ELEMENT_OPACITY,
  applyOpacity,
  getOpacityLevelName,
};
