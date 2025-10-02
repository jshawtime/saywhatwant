/**
 * EmptyState Component
 * 
 * Displays when no messages match current filters/search
 * Shows helpful guidance to user
 */

import React from 'react';
import { Ban } from 'lucide-react';
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
      {!searchTerm && (
        <Ban 
          className="w-12 h-12 mx-auto mb-4" 
          style={{ color: userColor }}
        />
      )}
      <div style={{ color: userColor }}>
        {searchTerm ? 'No matching comments' : (
          <>
            Apparently there's nothing to see here.
            <br /><br />
            Try turning filters off{' '}
            <button
              onClick={onToggleFilter}
              style={{
                display: 'inline-flex',
                verticalAlign: 'middle',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                margin: '0 4px'
              }}
              title={isFilterEnabled ? 'Disable filter' : 'Enable filter'}
            >
              <StyledFilterIcon 
                userColor={userColor}
                opacity={isFilterEnabled ? 1.0 : 0.4}
              />
            </button>
            , changing filters, search term<br />or check what link got you here.<br />Maybe someone fucked something up.<br /><br />99.9% chance it's not a server issue.
          </>
        )}
      </div>
    </div>
  );
};

