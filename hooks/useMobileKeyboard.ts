/**
 * useMobileKeyboard Hook
 * 
 * Handles mobile keyboard visibility and layout adjustments
 * Works for both iOS and Android devices
 */

import { useEffect } from 'react';

interface UseMobileKeyboardParams {
  streamRef: React.RefObject<HTMLDivElement>;
  isNearBottom: boolean;
  smoothScrollToBottom: (instant?: boolean) => void;
}

export function useMobileKeyboard(params: UseMobileKeyboardParams): void {
  const { streamRef, isNearBottom, smoothScrollToBottom } = params;
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Only for mobile devices
    if (window.innerWidth > 768) return;
    
    let lastKnownKeyboardHeight = 0;
    let resizeTimer: NodeJS.Timeout;
    
    const adjustForKeyboard = (forceAdjust = false) => {
      const inputForm = document.querySelector('.mobile-input-form') as HTMLElement;
      const messagesContainer = streamRef.current;
      
      if (!inputForm || !messagesContainer) return;
      
      // Use visualViewport if available (more reliable on Android)
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - viewportHeight;
      
      // Check if keyboard state changed or force adjustment on focus
      const keyboardIsOpen = keyboardHeight > 50;
      const keyboardStateChanged = Math.abs(keyboardHeight - lastKnownKeyboardHeight) > 30;
      
      if (keyboardIsOpen && (keyboardStateChanged || forceAdjust)) {
        // Keyboard is open - adjust layout
        lastKnownKeyboardHeight = keyboardHeight;
        
        // Make input fixed at bottom
        inputForm.style.position = 'fixed';
        inputForm.style.bottom = '0';
        inputForm.style.left = '0';
        inputForm.style.right = '0';
        inputForm.style.zIndex = '9999';
        
        // Add padding to messages container
        messagesContainer.style.paddingBottom = `${inputForm.offsetHeight + keyboardHeight}px`;
        
        // Only scroll to bottom if user is already near the bottom
        if (isNearBottom) {
          setTimeout(() => {
            smoothScrollToBottom(false);
          }, 100);
        }
        
      } else if (!keyboardIsOpen && lastKnownKeyboardHeight > 0) {
        // Keyboard is closed - reset layout
        lastKnownKeyboardHeight = 0;
        
        // Reset styles
        inputForm.style.position = '';
        inputForm.style.bottom = '';
        inputForm.style.left = '';
        inputForm.style.right = '';
        inputForm.style.zIndex = '';
        messagesContainer.style.paddingBottom = '';
      }
    };
    
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      // Check if it's an input or textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Force adjustment on focus (handles case where keyboard was dismissed with native button)
        setTimeout(() => {
          adjustForKeyboard(true); // Force adjust
          // Ensure input is visible
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        
        // Check again after keyboard should be fully open
        setTimeout(() => adjustForKeyboard(true), 500);
      }
    };
    
    const handleFocusOut = () => {
      // Delay to let keyboard close
      setTimeout(() => adjustForKeyboard(false), 100);
    };
    
    const handleViewportChange = () => {
      // Clear any existing timer
      clearTimeout(resizeTimer);
      
      // Debounce the adjustment
      resizeTimer = setTimeout(() => adjustForKeyboard(false), 50);
    };
    
    // Listen for focus events
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    
    // Listen for viewport changes (more reliable for Android)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);
    
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);  
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
      clearTimeout(resizeTimer);
    };
  }, [isNearBottom, smoothScrollToBottom, streamRef]);
}

