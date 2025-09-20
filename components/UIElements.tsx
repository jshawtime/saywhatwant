/**
 * UIElements.tsx - Centralized styled UI components
 * 
 * This file ensures consistent color application across all UI elements.
 * All icons and inputs use these components to prevent color regression.
 * 
 * IMPORTANT: Always use these components instead of raw lucide-react icons
 * to ensure colors are properly applied and won't revert to white.
 */

import React from 'react';
import { Search, Filter, X, User } from 'lucide-react';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { getDarkerColor } from '@/modules/colorSystem';

interface StyledIconProps {
  userColor: string;
  className?: string;
  opacity?: number;
  style?: React.CSSProperties;
}

// Search Icon - Always 60% opacity
export const StyledSearchIcon: React.FC<StyledIconProps> = ({ 
  userColor, 
  className = "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 z-10 pointer-events-none",
  opacity = OPACITY_LEVELS.LIGHT,
  style = {}
}) => {
  const color = getDarkerColor(userColor || 'rgb(96, 165, 250)', opacity);
  return (
    <Search 
      className={className}
      style={{ color, ...style }}
    />
  );
};

// Filter Icon - Always 60% opacity
export const StyledFilterIcon: React.FC<StyledIconProps> = ({ 
  userColor,
  className = "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 z-10 pointer-events-none",
  opacity = OPACITY_LEVELS.LIGHT,
  style = {}
}) => {
  const color = getDarkerColor(userColor || 'rgb(96, 165, 250)', opacity);
  return (
    <Filter 
      className={className}
      style={{ color, ...style }}
    />
  );
};

// Clear/X Icon - Always 60% opacity
export const StyledClearIcon: React.FC<StyledIconProps> = ({ 
  userColor,
  className = "w-3 h-3",
  opacity = OPACITY_LEVELS.LIGHT,
  style = {}
}) => {
  const color = getDarkerColor(userColor || 'rgb(96, 165, 250)', opacity);
  return (
    <X 
      className={className}
      style={{ color, ...style }}
    />
  );
};

// User Icon - Full opacity by default
export const StyledUserIcon: React.FC<StyledIconProps> = ({ 
  userColor,
  className = "w-4 h-4",
  opacity = OPACITY_LEVELS.FULL,
  style = {}
}) => {
  const color = opacity === OPACITY_LEVELS.FULL 
    ? (userColor || 'rgb(96, 165, 250)')
    : getDarkerColor(userColor || 'rgb(96, 165, 250)', opacity);
  return (
    <User 
      className={className}
      style={{ color, ...style }}
    />
  );
};

// Search Input - With proper color inheritance
interface StyledSearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  userColor: string;
  placeholder?: string;
  className?: string;
}

export const StyledSearchInput: React.FC<StyledSearchInputProps> = ({
  value,
  onChange,
  userColor,
  placeholder = "Search...",
  className = "w-full pl-10 pr-4 py-1.5 bg-white/5 border rounded-lg text-sm focus:outline-none"
}) => {
  const baseColor = userColor || 'rgb(96, 165, 250)';
  const textColor = value ? baseColor : getDarkerColor(baseColor, OPACITY_LEVELS.DARK);
  const borderColor = value ? getDarkerColor(baseColor, OPACITY_LEVELS.MEDIUM) : 'rgba(255,255,255,0.1)';
  const placeholderColor = getDarkerColor(baseColor, OPACITY_LEVELS.MEDIUM); // 50% opacity - 1 step lighter
  
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      style={{ 
        color: textColor,
        borderColor: borderColor,
        '--placeholder-color': placeholderColor,
      }}
      tabIndex={-1}
    />
  );
};

// Username Input - With proper color inheritance
interface StyledUsernameInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  userColor: string;
  placeholder?: string;
  maxLength?: number;
  inputRef?: React.RefObject<HTMLInputElement>;
  usernameFlash?: boolean;
}

export const StyledUsernameInput: React.FC<StyledUsernameInputProps> = ({
  value,
  onChange,
  onFocus,
  onKeyDown,
  userColor,
  placeholder,
  maxLength,
  inputRef,
  usernameFlash = false
}) => {
  const baseColor = userColor || 'rgb(96, 165, 250)';
  const textColor = getDarkerColor(baseColor, OPACITY_LEVELS.LIGHT); // 60% opacity
  
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`flex-1 pl-9 pr-8 py-1.5 bg-white/5 border rounded-lg text-sm focus:outline-none focus:border-white/30 placeholder-white/40 transition-all duration-300 ${
        usernameFlash 
          ? 'border-cyan-400 animate-pulse shadow-[0_0_10px_rgba(0,255,255,0.5)]' 
          : 'border-white/10'
      }`}
      maxLength={maxLength}
      style={{ 
        width: '100%',
        color: textColor
      }}
    />
  );
};

// Character Counter
interface StyledCharCounterProps {
  current: number;
  max: number;
  userColor: string;
}

export const StyledCharCounter: React.FC<StyledCharCounterProps> = ({
  current,
  max,
  userColor
}) => {
  const baseColor = userColor || 'rgb(96, 165, 250)';
  const color = getDarkerColor(baseColor, OPACITY_LEVELS.LIGHT); // 60% opacity
  
  return (
    <div 
      className="absolute top-2 right-2 text-[10px] pointer-events-none z-10"
      style={{ color }}
    >
      {current}/{max}
    </div>
  );
};
