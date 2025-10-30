/**
 * EmptyState Component
 * 
 * Displays when no messages match current filters/search
 * Shows helpful guidance to user
 */

import React from 'react';
import { StyledFilterIcon } from '@/components/UIElements';

interface EmptyStateProps {
  searchTerm: string;
  isFilterEnabled: boolean;
  userColor: string;
  onToggleFilter: () => void;
}

// Build timestamp - generated at build time for deployment verification
const BUILD_TIMESTAMP = new Date().toISOString();

export const EmptyState: React.FC<EmptyStateProps> = ({
  searchTerm,
  isFilterEnabled,
  userColor,
  onToggleFilter,
}) => {
  return (
    <div className="text-center py-8">
      <div style={{ color: userColor }}>
        {searchTerm ? 'No matching comments' : (
          <>
            <div style={{ fontSize: '28px', marginBottom: '20px' }}>
              SAY WHAT YOU WANT...
            </div>
            <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '10px' }}>
              Build: {BUILD_TIMESTAMP}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

