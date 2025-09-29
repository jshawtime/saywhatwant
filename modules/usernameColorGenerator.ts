/**
 * Username Color Module
 * Colors are ALWAYS paired with usernames - they are never generated
 * Username+Color is treated as a permanent unique identifier
 */

import { nineDigitToRgb } from '@/modules/colorSystem';

/**
 * Get color for comment - converts 9-digit to RGB for CSS display
 * Colors are permanently paired with usernames and should never be generated
 */
export function getCommentColor(comment: { color?: string; username?: string }): string {
  if (!comment.color) {
    // If no color exists, return a default gray (this shouldn't happen in normal flow)
    return '156163175'; // 9-digit format
  }
  
  // Convert 9-digit format to RGB for CSS
  if (/^\d{9}$/.test(comment.color)) {
    return nineDigitToRgb(comment.color);
  }
  
  // Return as-is if already RGB (backwards compatibility)
  return comment.color;
}
