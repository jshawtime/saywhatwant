import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { StyledFilterIcon } from '@/components/UIElements';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { UsernameFilter } from '@/hooks/useFilters';
import { describeDateRange } from '@/utils/dateTimeParser';

interface FilterBarProps {
  filterUsernames: UsernameFilter[];
  filterWords: string[];
  negativeFilterWords: string[];
  isFilterEnabled: boolean;
  hasActiveFilters: boolean;
  userColor: string;
  dateTimeFilter?: {
    from: string | null;
    to: string | null;
    timeFrom: number | null;
    timeTo: number | null;
  };
  onToggleFilter: () => void;
  onRemoveUsernameFilter: (username: string, color: string) => void;
  onRemoveWordFilter: (word: string) => void;
  onRemoveNegativeFilter: (word: string) => void;
  onClearDateTimeFilter?: () => void;
  getDarkerColor: (color: string, factor?: number) => string;
}

const FilterBar: React.FC<FilterBarProps> = ({
  filterUsernames,
  filterWords,
  negativeFilterWords,
  isFilterEnabled,
  hasActiveFilters,
  userColor,
  dateTimeFilter,
  onToggleFilter,
  onRemoveUsernameFilter,
  onRemoveWordFilter,
  onRemoveNegativeFilter,
  onClearDateTimeFilter,
  getDarkerColor
}) => {
  // Use state to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const hasDateTimeFilter = dateTimeFilter && (
    dateTimeFilter.from !== null || 
    dateTimeFilter.to !== null || 
    dateTimeFilter.timeFrom !== null || 
    dateTimeFilter.timeTo !== null
  );
  return (
    <div className="relative flex items-center gap-2">
      <div className="flex-1 relative">
        {/* Filter icon - clickable and synced with LED button */}
        <button
          onClick={onToggleFilter}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 z-10 cursor-pointer"
          title={isFilterEnabled ? 'Disable filter' : 'Enable filter | You can also bookmark to save'}
          tabIndex={-1}
        >
          <StyledFilterIcon 
            userColor={userColor} 
            opacity={isFilterEnabled ? OPACITY_LEVELS.FULL : OPACITY_LEVELS.LIGHT}
          />
        </button>
        <div 
          className="w-full min-h-[34px] max-h-[100px] overflow-y-auto custom-scrollbar pl-10 pr-3 py-1.5 bg-white/5 border rounded-lg text-sm flex items-start gap-2 flex-wrap transition-colors"
          style={{ 
            borderColor: isFilterEnabled && hasActiveFilters 
              ? getDarkerColor(userColor, OPACITY_LEVELS.MEDIUM) // 50% opacity 
              : 'rgba(255,255,255,0.1)',
            ['--scrollbar-color' as any]: getDarkerColor(userColor, OPACITY_LEVELS.DARK), // 40% opacity
            ['--scrollbar-bg' as any]: getDarkerColor(userColor, OPACITY_LEVELS.DARKEST * 0.5), // 5% opacity
          } as React.CSSProperties}
        >
          {filterUsernames.length === 0 && filterWords.length === 0 && negativeFilterWords.length === 0 && (!mounted || !hasDateTimeFilter) ? (
            <span style={{ color: getDarkerColor(userColor, OPACITY_LEVELS.DARKER) }}> {/* 30% opacity - one level lighter */}
              Click usernames or words to filter...
            </span>
          ) : (
            <>
              {/* Username filters */}
              {filterUsernames.map((filter, idx) => (
                <span
                  key={`user-${filter.username}-${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-md transition-opacity"
                  style={{ 
                    backgroundColor: getDarkerColor(filter.color, OPACITY_LEVELS.DARKEST), // 10% opacity
                    opacity: isFilterEnabled ? 1 : 0.4
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: filter.color }}>
                    {filter.username}
                  </span>
                  <button
                    onClick={() => onRemoveUsernameFilter(filter.username, filter.color)}
                    className="hover:opacity-80"
                    style={{ color: filter.color }}
                    tabIndex={-1}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              
              {/* Word filters */}
              {filterWords.map((word) => (
                <span
                  key={`word-${word}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-md transition-opacity"
                  style={{ 
                    backgroundColor: getDarkerColor(userColor, OPACITY_LEVELS.DARKEST), // 10% opacity
                    opacity: isFilterEnabled ? 1 : 0.4
                  }}
                >
                  <span className="text-xs" style={{ color: userColor }}>
                    {word}
                  </span>
                  <button
                    onClick={() => onRemoveWordFilter(word)}
                    className="hover:opacity-80"
                    style={{ color: userColor }}
                    tabIndex={-1}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              
              {/* Negative word filters */}
              {negativeFilterWords.map((word) => (
                <span
                  key={`negative-${word}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-md transition-opacity"
                  style={{ 
                    backgroundColor: 'rgba(139, 0, 0, 0.15)',
                    opacity: isFilterEnabled ? 1 : 0.4
                  }}
                >
                  <span className="text-xs" style={{ color: '#8B0000' }}>
                    -{word}
                  </span>
                  <button
                    onClick={() => onRemoveNegativeFilter(word)}
                    className="hover:opacity-80"
                    style={{ color: '#8B0000' }}
                    tabIndex={-1}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              
              {/* Date/Time filter - only render on client to avoid hydration issues */}
              {mounted && hasDateTimeFilter && dateTimeFilter && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-md transition-opacity"
                  style={{ 
                    backgroundColor: getDarkerColor('#9333EA', OPACITY_LEVELS.DARKEST * 1.5), // 15% opacity
                    opacity: isFilterEnabled ? 1 : 0.4
                  }}
                >
                  <Calendar className="w-3 h-3" style={{ color: '#9333EA' }} />
                  <span className="text-xs" style={{ color: '#9333EA' }}>
                    {describeDateRange(
                      dateTimeFilter.from, 
                      dateTimeFilter.to, 
                      dateTimeFilter.timeFrom, 
                      dateTimeFilter.timeTo
                    )}
                  </span>
                  {onClearDateTimeFilter && (
                    <button
                      onClick={onClearDateTimeFilter}
                      className="hover:opacity-80"
                      style={{ color: '#9333EA' }}
                      tabIndex={-1}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
