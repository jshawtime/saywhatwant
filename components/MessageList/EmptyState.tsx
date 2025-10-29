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
          <div style={{ fontSize: '28px', marginBottom: '20px' }}>
            SAY WHAT YOU WANT...
          </div>
        )}
      </div>
    </div>
  );
};

