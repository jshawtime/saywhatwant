/**
 * Domain Filter LED Indicator Component
 * Shows an LED-style indicator for domain filtering
 */

import React from 'react';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { getDarkerColor } from '@/modules/colorSystem';

interface DomainFilterProps {
  isEnabled: boolean;
  domain: string;
  color: string;
  onClick: () => void;
}

const DomainFilter: React.FC<DomainFilterProps> = ({ 
  isEnabled, 
  domain, 
  color,
  onClick 
}) => {
  return (
    <button
      onClick={onClick}
      className="relative p-1 transition-all"
      title={isEnabled ? "Show messages across all domains" : "Show messages from this domain only"}
    >
      {/* LED Indicator Only */}
      <div className="relative">
        {/* LED Glow Effect when ON */}
        {isEnabled && (
          <div
            className="absolute inset-0 rounded-full blur-sm animate-pulse"
            style={{
              backgroundColor: color, // Use full color for glow
              width: '12px',
              height: '12px',
            }}
          />
        )}
        
        {/* LED Core */}
        <div
          className="relative w-3 h-3 rounded-full transition-all cursor-pointer"
          style={{
            backgroundColor: isEnabled 
              ? color // Use FULL color when active (100% opacity)
              : `rgba(255, 255, 255, ${OPACITY_LEVELS.DARKEST})`, // DARKEST level white when off
            boxShadow: isEnabled 
              ? `0 0 10px ${color}` 
              : `inset 0 0 2px rgba(255, 255, 255, ${OPACITY_LEVELS.DARKEST * 0.5})`, // Even subtler inset
          }}
        />
      </div>
    </button>
  );
};

export default DomainFilter;
