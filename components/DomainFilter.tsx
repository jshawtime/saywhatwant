/**
 * Domain Filter LED Indicator Component
 * Shows an LED-style indicator for domain filtering
 */

import React from 'react';

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
      title="Show messages from this site only"
    >
      {/* LED Indicator Only */}
      <div className="relative">
        {/* LED Glow Effect when ON */}
        {isEnabled && (
          <div
            className="absolute inset-0 rounded-full blur-sm animate-pulse"
            style={{
              backgroundColor: color,
              width: '12px',
              height: '12px',
            }}
          />
        )}
        
        {/* LED Core */}
        <div
          className="relative w-3 h-3 rounded-full transition-all cursor-pointer"
          style={{
            backgroundColor: isEnabled ? color : 'rgba(255,255,255,0.2)',
            boxShadow: isEnabled ? `0 0 10px ${color}` : 'none',
            border: `1px solid ${isEnabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          {/* LED Highlight */}
          <div
            className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full"
            style={{
              backgroundColor: isEnabled ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
            }}
          />
        </div>
      </div>
    </button>
  );
};

export default DomainFilter;
