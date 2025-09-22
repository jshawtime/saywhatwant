/**
 * Keyboard Shortcuts Manager Module
 * Centralized keyboard shortcut handling for the entire application
 * Part of Phase 2 modularization - extracted from CommentsStream.tsx
 */

import { useEffect, useRef, useCallback } from 'react';

// Types for better type safety
export type ShortcutHandler = (event: KeyboardEvent) => void;
export type ModifierKeys = {
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

export interface KeyboardShortcut {
  key: string;
  handler: ShortcutHandler;
  description?: string;
  preventDefault?: boolean;
  allowInInput?: boolean;
  modifiers?: ModifierKeys;
}

/**
 * Check if the current element is an input field
 */
const isInputElement = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.contentEditable === 'true';
};

/**
 * Check if modifier keys match the requirements
 */
const matchesModifiers = (event: KeyboardEvent, modifiers?: ModifierKeys): boolean => {
  if (!modifiers) return true;
  
  return (
    (modifiers.ctrlKey === undefined || event.ctrlKey === modifiers.ctrlKey) &&
    (modifiers.metaKey === undefined || event.metaKey === modifiers.metaKey) &&
    (modifiers.altKey === undefined || event.altKey === modifiers.altKey) &&
    (modifiers.shiftKey === undefined || event.shiftKey === modifiers.shiftKey)
  );
};

/**
 * Custom hook for managing keyboard shortcuts
 * @param shortcuts - Array of keyboard shortcuts to register
 * @param dependencies - Optional dependencies array for the effect
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[], 
  dependencies: React.DependencyList = []
) => {
  const shortcutsRef = useRef(shortcuts);
  
  // Update shortcuts ref when they change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);
  
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target;
      const isInInput = isInputElement(target);
      
      // Find matching shortcut
      const matchingShortcut = shortcutsRef.current.find(shortcut => {
        // Check if key matches
        if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
        
        // Check if we should skip due to input focus
        if (isInInput && !shortcut.allowInInput) return false;
        
        // Check modifiers
        if (!matchesModifiers(event, shortcut.modifiers)) return false;
        
        return true;
      });
      
      if (matchingShortcut) {
        if (matchingShortcut.preventDefault !== false) {
          event.preventDefault();
        }
        matchingShortcut.handler(event);
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, dependencies); // Use provided dependencies
};

/**
 * Hook for common application shortcuts
 * This provides pre-configured shortcuts that can be used across the app
 */
export const useCommonShortcuts = ({
  onColorChange,
  onFocusInput,
  inputRef
}: {
  onColorChange?: (color: string) => void;
  onFocusInput?: () => void;
  inputRef?: React.RefObject<HTMLElement>;
}) => {
  const shortcuts: KeyboardShortcut[] = [];
  
  // Tab to focus input
  if (onFocusInput || inputRef) {
    shortcuts.push({
      key: 'Tab',
      handler: (event) => {
        event.preventDefault();
        if (inputRef?.current) {
          inputRef.current.focus();
        } else if (onFocusInput) {
          onFocusInput();
        }
      },
      description: 'Focus message input',
      allowInInput: false,
      modifiers: { shiftKey: false }
    });
  }
  
  // 'r' for random color
  if (onColorChange) {
    shortcuts.push({
      key: 'r',
      handler: (event) => {
        // Only if NO modifiers (allow Cmd+R / Ctrl+R to refresh)
        if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
          onColorChange('random');
        }
      },
      description: 'Random color',
      allowInInput: false,
      preventDefault: true
    });
  }
  
  return shortcuts;
};

/**
 * Utility to generate a shortcuts help text
 */
export const getShortcutsHelp = (shortcuts: KeyboardShortcut[]): string[] => {
  return shortcuts
    .filter(s => s.description)
    .map(s => {
      const modifiers = [];
      if (s.modifiers?.ctrlKey) modifiers.push('Ctrl');
      if (s.modifiers?.metaKey) modifiers.push('Cmd');
      if (s.modifiers?.altKey) modifiers.push('Alt');
      if (s.modifiers?.shiftKey) modifiers.push('Shift');
      
      const keys = [...modifiers, s.key.toUpperCase()].join('+');
      return `${keys}: ${s.description}`;
    });
};

/**
 * Global shortcut registry for preventing conflicts
 */
class ShortcutRegistry {
  private shortcuts: Map<string, Set<string>> = new Map();
  
  register(componentId: string, keys: string[]) {
    this.shortcuts.set(componentId, new Set(keys));
    this.checkConflicts();
  }
  
  unregister(componentId: string) {
    this.shortcuts.delete(componentId);
  }
  
  private checkConflicts() {
    const allKeys = new Map<string, string[]>();
    
    this.shortcuts.forEach((keys, componentId) => {
      keys.forEach(key => {
        if (!allKeys.has(key)) {
          allKeys.set(key, []);
        }
        allKeys.get(key)!.push(componentId);
      });
    });
    
    // Log conflicts in development
    if (process.env.NODE_ENV === 'development') {
      allKeys.forEach((components, key) => {
        if (components.length > 1) {
          console.warn(
            `[KeyboardShortcuts] Conflict detected for key "${key}" in components:`,
            components
          );
        }
      });
    }
  }
}

export const shortcutRegistry = new ShortcutRegistry();

/**
 * Hook to register shortcuts with conflict detection
 */
export const useRegisteredShortcuts = (
  componentId: string,
  shortcuts: KeyboardShortcut[],
  dependencies: React.DependencyList = []
) => {
  useEffect(() => {
    const keys = shortcuts.map(s => {
      const modifiers = [];
      if (s.modifiers?.ctrlKey) modifiers.push('Ctrl');
      if (s.modifiers?.metaKey) modifiers.push('Cmd');
      if (s.modifiers?.altKey) modifiers.push('Alt');
      if (s.modifiers?.shiftKey) modifiers.push('Shift');
      modifiers.push(s.key);
      return modifiers.join('+');
    });
    
    shortcutRegistry.register(componentId, keys);
    
    return () => {
      shortcutRegistry.unregister(componentId);
    };
  }, [componentId, shortcuts]);
  
  useKeyboardShortcuts(shortcuts, dependencies);
};

// Export all utilities
export const KeyboardShortcuts = {
  useKeyboardShortcuts,
  useCommonShortcuts,
  useRegisteredShortcuts,
  getShortcutsHelp,
  isInputElement,
  matchesModifiers,
  registry: shortcutRegistry
};
