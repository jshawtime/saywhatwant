/**
 * Username Color Generator
 * Generates consistent colors for usernames that don't have assigned colors
 */

/**
 * Generate a deterministic color based on username
 * Same username always gets the same color
 */
export function generateColorForUsername(username: string): string {
  if (!username) return 'rgb(156, 163, 175)'; // Gray for anonymous
  
  // Simple hash function for username
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    const char = username.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use hash to generate RGB values in pleasant ranges
  // Avoiding very dark or very light colors
  const hue = Math.abs(hash % 360);
  const saturation = 40 + (Math.abs(hash >> 8) % 30); // 40-70%
  const lightness = 45 + (Math.abs(hash >> 16) % 20); // 45-65%
  
  // Convert HSL to RGB
  return hslToRgb(hue, saturation, lightness);
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): string {
  s = s / 100;
  l = l / 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get color for comment - uses actual color or generates from username
 */
export function getCommentColor(comment: { color?: string; username?: string }): string {
  // If comment has a color, use it
  if (comment.color) return comment.color;
  
  // Otherwise generate based on username
  return generateColorForUsername(comment.username || 'anonymous');
}
