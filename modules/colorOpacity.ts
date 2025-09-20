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
 * Standard opacity levels - CORRECTLY NAMED
 * 
 * IMPORTANT: Lower percentage = MORE TRANSPARENT (darker/fainter)
 * Higher percentage = LESS TRANSPARENT (brighter/fuller)
 * 
 * NEVER add new levels - only use these 6
 */
export const OPACITY_LEVELS = {
  DARKEST: 0.2,   // 20% opacity - Most transparent, visible on black
  DARKER: 0.3,    // 30% opacity - Faint backgrounds, inactive states
  DARK: 0.4,      // 40% opacity - Placeholder text, subtle elements  
  MEDIUM: 0.5,    // 50% opacity - Borders, inactive filters
  LIGHT: 0.6,     // 60% opacity - Icons, usernames, secondary text
  FULL: 1.0,      // 100% opacity - Primary text, fully visible
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
  if (!Object.values(OPACITY_LEVELS).includes(level as any)) {
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
  // FULL (100% opacity - fully visible)
  MESSAGE_TEXT: OPACITY_LEVELS.FULL,
  ACTIVE_FILTER: OPACITY_LEVELS.FULL,
  ACTIVE_DOMAIN_LED: OPACITY_LEVELS.FULL,
  
  // LIGHT (60% opacity - slightly transparent)
  USERNAME: OPACITY_LEVELS.LIGHT,
  FILTER_ICON: OPACITY_LEVELS.LIGHT,
  SEARCH_ICON: OPACITY_LEVELS.LIGHT,
  CLEAR_BUTTON: OPACITY_LEVELS.LIGHT,
  CHARACTER_COUNTER: OPACITY_LEVELS.LIGHT,
  
  // MEDIUM (50% opacity - half transparent)
  BORDER_ACTIVE: OPACITY_LEVELS.MEDIUM,
  INACTIVE_FILTER: OPACITY_LEVELS.MEDIUM,
  
  // DARK (40% opacity - more transparent)
  PLACEHOLDER_TEXT: OPACITY_LEVELS.DARK,
  SEARCH_PLACEHOLDER: OPACITY_LEVELS.DARK,
  
  // DARKER (30% opacity - subtle but visible)
  INACTIVE_DOMAIN_LED: OPACITY_LEVELS.DARKER,
  FAINT_BACKGROUND: OPACITY_LEVELS.DARKER,
  
  // DARKEST (20% opacity - faint but visible on black)
  VERY_FAINT_BACKGROUND: OPACITY_LEVELS.DARKEST,
  HOVER_BACKGROUND: OPACITY_LEVELS.DARKEST,
  INACTIVE_FILTER_SWITCH_BG: OPACITY_LEVELS.DARKEST,
} as const;

/**
 * Get the opacity level name for debugging
 */
export function getOpacityLevelName(level: number): string {
  const entry = Object.entries(OPACITY_LEVELS).find(([_, value]) => value === level);
  return entry ? entry[0] : 'UNKNOWN';
}

/**
 * Quick reference for AI agents - CORRECTED:
 * 
 * When user says:
 * - "Make it darkest/faintest" → OPACITY_LEVELS.DARKEST (20% opacity - most transparent)
 * - "Make it darker" → OPACITY_LEVELS.DARKER (30% opacity)
 * - "Make it dark" → OPACITY_LEVELS.DARK (40% opacity)
 * - "Make it medium" → OPACITY_LEVELS.MEDIUM (50% opacity)
 * - "Make it light/lighter" → OPACITY_LEVELS.LIGHT (60% opacity)
 * - "Make it full/brightest" → OPACITY_LEVELS.FULL (100% opacity - no transparency)
 * 
 * REMEMBER: Lower % = MORE transparent (darker/fainter)
 *           Higher % = LESS transparent (brighter/more visible)
 * 
 * Example usage in components:
 * ```
 * import { applyOpacity, OPACITY_LEVELS } from '@/modules/colorOpacity';
 * 
 * style={{ color: applyOpacity(userColor, OPACITY_LEVELS.LIGHT) }} // 60% opacity
 * ```
 */

export default {
  OPACITY_LEVELS,
  UI_ELEMENT_OPACITY,
  applyOpacity,
  getOpacityLevelName,
};
