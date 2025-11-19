import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar } from 'lucide-react';
import { StyledFilterIcon } from '@/components/UIElements';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { UsernameFilter } from '@/modules/filterSystem';
import { describeDateRange } from '@/utils/dateTimeParser';
import { FilterNotificationMenu, getSoundIcon } from '@/components/FilterNotificationMenu';
import { 
  getFilterKey, 
  getFilterNotificationSetting, 
  updateFilterSound, 
  markFilterAsRead,
  NotificationSound 
} from '@/modules/notificationSystem';

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
  
  // Notification menu state
  const [notificationMenu, setNotificationMenu] = useState<{ 
    x: number; 
    y: number; 
    filterKey: string;
    currentSound: NotificationSound;
  } | null>(null);
  
  // Track notification settings for each filter
  // Initialize from localStorage to avoid hydration mismatch
  const [filterNotificationSettings, setFilterNotificationSettings] = useState<Record<string, { sound: NotificationSound; isUnread: boolean }>>(() => {
    const settings: Record<string, { sound: NotificationSound; isUnread: boolean }> = {};
    // Only load on client to avoid SSR mismatch
    if (typeof window !== 'undefined') {
      filterUsernames.forEach(filter => {
        const key = getFilterKey(filter.username, filter.color || userColor);
        settings[key] = getFilterNotificationSetting(key);
      });
      filterWords.forEach(word => {
        const key = getFilterKey(word, '');
        settings[key] = getFilterNotificationSetting(key);
      });
    }
    return settings;
  });
  
  useEffect(() => {
    setMounted(true);
    // Reload settings when filters change
    const loadSettings = () => {
      const settings: Record<string, { sound: NotificationSound; isUnread: boolean }> = {};
      filterUsernames.forEach(filter => {
        const key = getFilterKey(filter.username, filter.color || userColor);
        settings[key] = getFilterNotificationSetting(key);
      });
      filterWords.forEach(word => {
        const key = getFilterKey(word, '');
        settings[key] = getFilterNotificationSetting(key);
      });
      setFilterNotificationSettings(settings);
    };
    loadSettings();
    
    // Listen for notification updates
    const handleNotificationUpdate = () => {
      loadSettings();
    };
    
    window.addEventListener('filterNotificationUpdate', handleNotificationUpdate);
    return () => {
      window.removeEventListener('filterNotificationUpdate', handleNotificationUpdate);
    };
  }, [filterUsernames, filterWords, userColor]);
  
  const hasDateTimeFilter = dateTimeFilter && (
    dateTimeFilter.from !== null || 
    dateTimeFilter.to !== null || 
    dateTimeFilter.timeFrom !== null || 
    dateTimeFilter.timeTo !== null
  );
  
  // Handle right-click on filter item
  const handleFilterContextMenu = useCallback((e: React.MouseEvent, filterKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentSetting = getFilterNotificationSetting(filterKey);
    setNotificationMenu({
      x: e.clientX,
      y: e.clientY,
      filterKey,
      currentSound: currentSetting.sound
    });
  }, []);
  
  // Handle filter hover (mark as read)
  const handleFilterHover = useCallback((filterKey: string) => {
    const setting = filterNotificationSettings[filterKey];
    if (setting?.isUnread) {
      markFilterAsRead(filterKey);
      setFilterNotificationSettings(prev => ({
        ...prev,
        [filterKey]: { ...prev[filterKey], isUnread: false }
      }));
    }
  }, [filterNotificationSettings]);
  
  // Handle sound selection
  const handleSoundSelect = useCallback((sound: NotificationSound) => {
    if (notificationMenu) {
      updateFilterSound(notificationMenu.filterKey, sound);
      setFilterNotificationSettings(prev => ({
        ...prev,
        [notificationMenu.filterKey]: { 
          ...prev[notificationMenu.filterKey], 
          sound 
        }
      }));
    }
  }, [notificationMenu]);
  
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
          {filterUsernames.length === 0 && filterWords.length === 0 && negativeFilterWords.length === 0 && !hasDateTimeFilter ? (
            <span style={{ color: getDarkerColor(userColor, OPACITY_LEVELS.DARKER) }}> {/* 30% opacity - one level lighter */}
              Click usernames or words to filter...
            </span>
          ) : (
            <>
              {/* Username filters */}
              {filterUsernames.map((filter, idx) => {
                const filterKey = getFilterKey(filter.username, filter.color);
                const setting = filterNotificationSettings[filterKey] || { sound: 'none', isUnread: false };
                const isHumanFilter = filter.messageType === 'human' || !filter.messageType;  // Default to human if not set
                const chipColor = filter.colorRgb || userColor;
                const displayLabel = `${filter.username}:${filter.color}`;
                
                return (
                  <span
                    key={`user-${filter.username}-${idx}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      setting.isUnread ? 'font-bold' : ''
                    }`}
                    style={{ 
                      backgroundColor: getDarkerColor(chipColor, OPACITY_LEVELS.DARKEST), // 10% opacity
                      opacity: isFilterEnabled ? 1 : 0.4,
                      boxShadow: setting.isUnread ? `0 0 0 2px ${chipColor}` : 'none'
                    }}
                    onContextMenu={(e) => {
                      if (isHumanFilter) {
                        handleFilterContextMenu(e, filterKey);
                      } else {
                        e.preventDefault();  // Block context menu for AI usernames
                      }
                    }}
                    onMouseEnter={() => handleFilterHover(filterKey)}
                    title={isHumanFilter ? "Right click to set alert. Filter must be on." : filter.username}
                  >
                    {setting.sound !== 'none' && (
                      <span style={{ color: chipColor }}>
                        {getSoundIcon(setting.sound)}
                      </span>
                    )}
                    <span style={{ fontSize: '13.8px', fontWeight: 500, color: chipColor }}>
                      {displayLabel}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveUsernameFilter(filter.username, filter.color);
                      }}
                      className="hover:opacity-80"
                      style={{ color: chipColor }}
                      tabIndex={-1}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                );
              })}
              
              {/* Word filters */}
              {filterWords.map((word) => {
                // Words don't have colors - just use the word as the key
                const filterKey = getFilterKey(word, '');
                const setting = filterNotificationSettings[filterKey] || { sound: 'none', isUnread: false };
                
                return (
                  <span
                    key={`word-${word}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      setting.isUnread ? 'font-bold' : ''
                    }`}
                    style={{ 
                      backgroundColor: getDarkerColor(userColor, OPACITY_LEVELS.DARKEST), // 10% opacity
                      opacity: isFilterEnabled ? 1 : 0.4,
                      boxShadow: setting.isUnread ? `0 0 0 2px ${userColor}` : 'none'
                    }}
                    onContextMenu={(e) => handleFilterContextMenu(e, filterKey)}
                    onMouseEnter={() => handleFilterHover(filterKey)}
                    title="Right click to set alert. Filter must be on."
                  >
                    {setting.sound !== 'none' && (
                      <span style={{ color: userColor }}>
                        {getSoundIcon(setting.sound)}
                      </span>
                    )}
                    <span style={{ fontSize: '13.8px', color: userColor }}>
                      {word}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWordFilter(word);
                      }}
                      className="hover:opacity-80"
                      style={{ color: userColor }}
                      tabIndex={-1}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                );
              })}
              
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveNegativeFilter(word);
                    }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearDateTimeFilter();
                      }}
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
      
      {/* Notification context menu */}
      {notificationMenu && (
        <FilterNotificationMenu
          x={notificationMenu.x}
          y={notificationMenu.y}
          currentSound={notificationMenu.currentSound}
          onClose={() => setNotificationMenu(null)}
          onSelectSound={handleSoundSelect}
        />
      )}
    </div>
  );
};

export default FilterBar;
