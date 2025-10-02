/**
 * Scroll Behavior Utilities
 * 
 * Global, reusable scroll behavior functions for consistent UX across the application.
 * Use these EVERYWHERE to ensure consistent scroll behavior.
 * 
 * Philosophy:
 * - "Anchored to bottom" = user intent to view newest messages
 * - Preserve this intent across view changes (filter toggle, search, etc.)
 * - Pixel position is secondary to user intent
 */

/**
 * Check if user is anchored to bottom (viewing newest messages)
 * 
 * @param element - Scrollable element to check
 * @param threshold - Distance from bottom in pixels (default: 100)
 * @returns true if user is near bottom (viewing newest)
 * 
 * @example
 * const isAtBottom = isAnchoredToBottom(streamRef.current, 100);
 * if (isAtBottom) {
 *   // User wants to see newest - keep them at bottom after content change
 * }
 */
export function isAnchoredToBottom(
  element: HTMLElement | null,
  threshold: number = 100
): boolean {
  if (!element) return false;
  
  const { scrollHeight, scrollTop, clientHeight } = element;
  const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
  
  return distanceFromBottom < threshold;
}

/**
 * Scroll element to bottom (newest messages visible)
 * 
 * @param element - Element to scroll
 * @param smooth - Whether to use smooth scrolling (default: true)
 * 
 * @example
 * scrollToBottom(streamRef.current, false); // Instant
 * scrollToBottom(streamRef.current, true);  // Smooth
 */
export function scrollToBottom(
  element: HTMLElement | null,
  smooth: boolean = true
): void {
  if (!element) return;
  
  if (smooth) {
    element.scrollTo({
      top: element.scrollHeight,
      behavior: 'smooth'
    });
  } else {
    element.scrollTop = element.scrollHeight;
  }
}

/**
 * Scroll element to specific position
 * 
 * @param element - Element to scroll
 * @param position - Pixel position to scroll to
 * @param smooth - Whether to use smooth scrolling (default: false)
 */
export function scrollToPosition(
  element: HTMLElement | null,
  position: number,
  smooth: boolean = false
): void {
  if (!element) return;
  
  // Ensure position is within bounds
  const maxScroll = element.scrollHeight - element.clientHeight;
  const safePosition = Math.max(0, Math.min(position, maxScroll));
  
  if (smooth) {
    element.scrollTo({
      top: safePosition,
      behavior: 'smooth'
    });
  } else {
    element.scrollTop = safePosition;
  }
}

/**
 * Save scroll state (position + anchor status)
 * 
 * @param element - Element to save state from
 * @param threshold - Bottom anchor threshold
 * @returns Scroll state object
 * 
 * @example
 * const scrollState = saveScrollState(streamRef.current, 100);
 * // Later...
 * restoreScrollState(streamRef.current, scrollState);
 */
export interface ScrollState {
  /** Pixel position from top */
  position: number;
  
  /** Was user anchored to bottom (viewing newest)? */
  wasAtBottom: boolean;
  
  /** Timestamp when saved */
  savedAt: number;
}

export function saveScrollState(
  element: HTMLElement | null,
  threshold: number = 100
): ScrollState | null {
  if (!element) return null;
  
  return {
    position: element.scrollTop,
    wasAtBottom: isAnchoredToBottom(element, threshold),
    savedAt: Date.now()
  };
}

/**
 * Restore scroll state with smart behavior
 * 
 * If user was anchored to bottom, keep them at bottom.
 * Otherwise, restore pixel position.
 * 
 * @param element - Element to restore scroll to
 * @param state - Saved scroll state
 * @param forceBottom - Force scroll to bottom regardless of saved state
 * 
 * @example
 * restoreScrollState(streamRef.current, scrollState);
 */
export function restoreScrollState(
  element: HTMLElement | null,
  state: ScrollState | null,
  forceBottom: boolean = false
): void {
  if (!element || !state) return;
  
  // If was anchored to bottom OR forceBottom, keep at bottom
  if (state.wasAtBottom || forceBottom) {
    scrollToBottom(element, false);
    console.log('[ScrollBehaviors] Restored to bottom (was anchored or forced)');
  } else {
    // Restore pixel position
    scrollToPosition(element, state.position, false);
    console.log('[ScrollBehaviors] Restored to position:', state.position);
  }
}

