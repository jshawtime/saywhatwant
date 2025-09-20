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
      className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all group"
      style={{
        backgroundColor: isEnabled ? `${color}20` : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isEnabled ? color : 'rgba(255,255,255,0.1)'}`,
      }}
      title={`Filter: ${domain} only (${isEnabled ? 'ON' : 'OFF'})`}
    >
      {/* LED Indicator */}
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
          className="relative w-3 h-3 rounded-full transition-all"
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
      
      {/* Domain Label */}
      <span 
        className="text-xs font-medium transition-all"
        style={{
          color: isEnabled ? color : 'rgba(255,255,255,0.4)',
          opacity: isEnabled ? 1 : 0.6,
        }}
      >
        {domain.split('.')[0].toUpperCase()}
      </span>
    </button>
  );
};

export default DomainFilter;
