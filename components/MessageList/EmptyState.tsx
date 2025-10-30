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
          <>
            <div style={{ fontSize: '28px', marginBottom: '20px' }}>
              SAY WHAT YOU WANT...
            </div>
            
            <div style={{ fontSize: '16px' }}>
              This is either your first time here or
              <br />a new conversation with AI or
            </div>

            <div style={{ fontSize: '11px', marginTop: '20px' }}>
              try turning filters off{' '}
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
            , changing filters, search term<br />or check what link got you here.<br />Maybe the link maker fucked something up.<br /><br />99.99% chance it's not a Cloudflare server issue.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

