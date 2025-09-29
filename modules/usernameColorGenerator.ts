/**
 * Username Color Module
 * Colors are ALWAYS paired with usernames - they are never generated
 * Username+Color is treated as a permanent unique identifier
 */

/**
 * Get color for comment - ONLY uses the comment's actual color
 * Colors are permanently paired with usernames and should never be generated
 */
export function getCommentColor(comment: { color?: string; username?: string }): string {
  // Comments must have their original color - never generate one
  // If no color exists, return a default gray (this shouldn't happen in normal flow)
  return comment.color || 'rgb(156, 163, 175)';
}
