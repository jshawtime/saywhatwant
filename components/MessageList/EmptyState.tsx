/**
 * EmptyState Component
 * 
 * Displays when no messages match current filters/search
 * Shows helpful guidance to user
 */

import React, { useState, useEffect } from 'react';
import { StyledFilterIcon } from '@/components/UIElements';

interface EmptyStateProps {
  searchTerm: string;
  isFilterEnabled: boolean;
  userColor: string;
  onToggleFilter: () => void;
}

// Build timestamp - set at build time
// Using environment variable to avoid hydration issues
const BUILD_TIMESTAMP = process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown';

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
            <div style={{ fontSize: '16px', marginBottom: '12px' }}>
              Your conversations are anonymous - even your 1000th one
            </div>
            <div style={{ fontSize: '13px', marginBottom: '23px' }}>
              Bookmark this page to save this conversation
            </div>
            <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '12px' }}>
              Build: {BUILD_TIMESTAMP}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

