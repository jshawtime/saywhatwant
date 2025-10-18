import React, { useEffect, useRef } from 'react';
import { Copy, Download, Ban } from 'lucide-react';
import { Comment } from '@/types';

interface ContextMenuProps {
  x: number;
  y: number;
  comment: Comment;
  clickedWord?: string;  // The specific word that was clicked
  isUsername?: boolean;  // Whether the username was clicked
  onClose: () => void;
  onCopy: () => void;
  onSave: () => void;
  onBlock: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  comment,
  clickedWord,
  isUsername,
  onClose,
  onCopy,
  onSave,
  onBlock,
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
      className="fixed z-50 bg-black/90 backdrop-blur-sm border border-gray-800 rounded-md shadow-2xl p-0.5 flex gap-0.5"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Copy Button */}
      <button
        onClick={() => {
          onCopy();
          onClose();
        }}
        className="p-2 hover:bg-white/10 rounded transition-all text-gray-400 hover:text-white"
        title="Copy"
        aria-label="Copy message"
      >
        <Copy size={16} />
      </button>

      {/* Save Button */}
      <button
        onClick={() => {
          onSave();
          onClose();
        }}
        className="p-2 hover:bg-white/10 rounded transition-all text-gray-400 hover:text-white"
        title="Save"
        aria-label="Save message"
      >
        <Download size={16} />
      </button>

      {/* Block Button */}
      <button
        onClick={() => {
          onBlock();
          onClose();
        }}
        className="p-2 hover:bg-white/10 rounded transition-all text-gray-400 hover:text-red-400"
        title={clickedWord ? `Block word: "${clickedWord}"` : `Block user: "${comment.username || 'anonymous'}"`}
        aria-label={clickedWord ? "Block word" : "Block user"}
      >
        <Ban size={16} />
      </button>
    </div>
  );
};
