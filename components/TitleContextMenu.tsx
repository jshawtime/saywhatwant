import React, { useEffect, useRef } from 'react';

interface TitleContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCopyAll: () => void;
  onSaveAll: () => void;
}

export const TitleContextMenu: React.FC<TitleContextMenuProps> = ({
  x,
  y,
  onClose,
  onCopyAll,
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

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-black/90 backdrop-blur-sm border border-gray-800 rounded-md shadow-2xl py-1"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Copy All Button */}
      <button
        onClick={() => {
          onCopyAll();
          onClose();
        }}
        className="block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all"
        aria-label="Copy all messages"
      >
        Copy ALL
      </button>

      {/* Save All Button */}
      <button
        onClick={() => {
          onSaveAll();
          onClose();
        }}
        className="block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all"
        aria-label="Save all messages"
      >
        Save ALL
      </button>
    </div>
  );
};
