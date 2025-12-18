import React, { useEffect, useRef } from 'react';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { showToast } from '@/components/Toast';

interface TitleContextMenuProps {
  x: number;
  y: number;
  userColorRgb: string;
  onClose: () => void;
  onCopyAll: () => void;
  onCopyAllVerbose: () => void;
  onSaveAll: () => void;
}

export const TitleContextMenu: React.FC<TitleContextMenuProps> = ({
  x,
  y,
  userColorRgb,
  onClose,
  onCopyAll,
  onCopyAllVerbose,
  onSaveAll,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen (accounting for video drawer)
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      
      // Get actual container bounds (accounts for video drawer)
      const container = document.querySelector('.flex-1') || document.body;
      const containerRect = container.getBoundingClientRect();
      const viewportRight = containerRect.right;
      
      const adjustedX = Math.min(x, viewportRight - rect.width - 10);
      const adjustedY = Math.min(y, window.innerHeight - rect.height - 10);
      
      menuRef.current.style.left = `${Math.max(10, adjustedX)}px`;
      menuRef.current.style.top = `${Math.max(10, adjustedY)}px`;
    }
  }, [x, y]);

  // Handle bookmark save - copy URL and show toast
  const handleBookmarkSave = async () => {
    try {
      // Copy current URL to clipboard
      await navigator.clipboard.writeText(window.location.href);
      
      // Detect OS for keyboard shortcut hint
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const shortcut = isMac ? '⌘D' : 'Ctrl+D';
      
      // Show toast
      showToast({
        message: 'URL copied!',
        subMessage: `Press ${shortcut} to bookmark`,
        type: 'bookmark',
        duration: 3500,
      });
    } catch (err) {
      // Fallback if clipboard fails
      showToast({
        message: 'Bookmark this page to save',
        subMessage: 'Press ⌘D (Mac) or Ctrl+D (Windows)',
        type: 'bookmark',
        duration: 3500,
      });
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-black/90 backdrop-blur-sm border border-gray-800 rounded-md shadow-2xl py-1"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Save Conversation via Bookmark */}
      <button
        onClick={handleBookmarkSave}
        className="block w-full px-4 py-2 text-left hover:bg-white/10 transition-all"
        style={{ 
          color: getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT),
          fontSize: '12.9px'
        }}
        aria-label="Save conversation via bookmark"
        title="You can bookmark a conversation and continue it later"
      >
        Save Conversation (via bookmark)
      </button>

      {/* Separator */}
      <div 
        className="my-1 mx-2 border-t"
        style={{ borderColor: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK) }}
      />

      {/* Copy All Button */}
      <button
        onClick={() => {
          onCopyAll();
          onClose();
        }}
        className="block w-full px-4 py-2 text-left hover:bg-white/10 transition-all"
        style={{ 
          color: getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT),
          fontSize: '12.9px'
        }}
        aria-label="Copy all messages"
      >
        Copy ALL
      </button>

      {/* Copy All Verbose Button */}
      <button
        onClick={() => {
          onCopyAllVerbose();
          onClose();
        }}
        className="block w-full px-4 py-2 text-left hover:bg-white/10 transition-all"
        style={{ 
          color: getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT),
          fontSize: '12.9px'
        }}
        aria-label="Copy all messages with debug info"
      >
        Copy ALL - verbose
      </button>

      {/* Save All Button */}
      <button
        onClick={() => {
          onSaveAll();
          onClose();
        }}
        className="block w-full px-4 py-2 text-left hover:bg-white/10 transition-all"
        style={{ 
          color: getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT),
          fontSize: '12.9px'
        }}
        aria-label="Save all messages"
      >
        Save ALL
      </button>
    </div>
  );
};
