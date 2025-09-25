import React, { useEffect, useRef } from 'react';
import { Ban, Music, Gamepad2, Hand, Volume2, Sparkles } from 'lucide-react';
import { NotificationSound } from '@/modules/notificationSystem';

interface FilterNotificationMenuProps {
  x: number;
  y: number;
  currentSound: NotificationSound;
  onClose: () => void;
  onSelectSound: (sound: NotificationSound) => void;
}

const SOUND_OPTIONS: { sound: NotificationSound; icon: React.ReactNode; label: string }[] = [
  { sound: 'none', icon: <Ban size={14} />, label: 'Silent' },
  { sound: 'delightful', icon: <Sparkles size={14} />, label: 'Delightful' },
  { sound: 'gamer', icon: <Gamepad2 size={14} />, label: 'Gamer' },
  { sound: 'hello', icon: <Hand size={14} />, label: 'Hello' },
  { sound: 'horn', icon: <Volume2 size={14} />, label: 'Horn' },
  { sound: 'subtle', icon: <Music size={14} />, label: 'Subtle' },
];

export const FilterNotificationMenu: React.FC<FilterNotificationMenuProps> = ({
  x,
  y,
  currentSound,
  onClose,
  onSelectSound,
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

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const menuWidth = menuRef.current.offsetWidth;
      const menuHeight = menuRef.current.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + menuWidth > viewportWidth - 10) {
        adjustedX = viewportWidth - menuWidth - 10;
      }
      if (y + menuHeight > viewportHeight - 10) {
        adjustedY = viewportHeight - menuHeight - 10;
      }

      menuRef.current.style.left = `${Math.max(10, adjustedX)}px`;
      menuRef.current.style.top = `${Math.max(10, adjustedY)}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-black/90 backdrop-blur-sm border border-gray-800 rounded-md shadow-2xl p-1"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="text-xs text-gray-400 px-2 py-1 border-b border-gray-700 mb-1">
        Notify
      </div>
      {SOUND_OPTIONS.map(({ sound, icon, label }) => (
        <button
          key={sound}
          onClick={() => {
            onSelectSound(sound);
            onClose();
          }}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-all text-left ${
            currentSound === sound 
              ? 'bg-white/20 text-white' 
              : 'hover:bg-white/10 text-gray-400 hover:text-white'
          }`}
          title={label}
        >
          <span className="flex-shrink-0">{icon}</span>
          <span className="text-xs">{label}</span>
        </button>
      ))}
    </div>
  );
};

// Helper function to get icon for a sound
export function getSoundIcon(sound: NotificationSound): React.ReactNode {
  const option = SOUND_OPTIONS.find(opt => opt.sound === sound);
  return option ? option.icon : <Ban size={12} />;
}
