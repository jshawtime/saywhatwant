/**
 * AppHeader Component
 * 
 * Main application header with title, domain filter, message type toggles, and user controls
 * Orchestrates multiple sub-components for clean separation of concerns
 */

import React from 'react';
import { Download, Share2, Tv } from 'lucide-react';
import DomainFilter from '@/components/DomainFilter';
import FilterBar from '@/components/FilterBar';
import { SearchBar } from '@/components/Search/SearchBar';
import { MessageTypeToggle } from './MessageTypeToggle';
import { UserControls } from './UserControls';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { UsernameFilter } from '@/modules/filterSystem';

interface AppHeaderProps {
  // Title & Domain
  title: string;
  domainFilterEnabled: boolean;
  currentDomain: string;
  mounted: boolean;
  modelDomain: string | null;
  userColor: string;
  userColorRgb: string;
  
  // Message Type Channel (human, AI, ALL, or null for neither)
  activeChannel: 'human' | 'AI' | 'ALL' | null;
  onChannelChange: (channel: 'human' | 'AI' | 'ALL' | null) => void;
  
  // Username & Color  
  username: string;
  hasClickedUsername: boolean;
  usernameFlash: boolean;
  showColorPicker: boolean;
  randomizedColors: string[];
  maxUsernameLength: number;
  usernameRef: React.RefObject<HTMLInputElement>;
  colorPickerRef: React.RefObject<HTMLDivElement>;
  onUsernameChange: (username: string) => void;
  onUsernameFocus: () => void;
  onUsernameTab: () => void;
  onClearUsername: () => void;
  onToggleColorPicker: () => void;
  onSelectColor: (color: string) => void;
  
  // TV Toggle
  showVideo: boolean;
  onToggleVideo?: () => void;
  
  // Message Counts
  displayedCount: number;
  globalCount: number;
  
  // Filters
  filterUsernames: UsernameFilter[];
  filterWords: string[];
  negativeFilterWords: string[];
  isFilterEnabled: boolean;
  hasActiveFilters: boolean;
  dateTimeFilter: any;
  onToggleFilter: () => void;
  onRemoveUsernameFilter: (username: string, color: string) => void;
  onRemoveWordFilter: (word: string) => void;
  onRemoveNegativeFilter: (word: string) => void;
  onClearDateTimeFilter: () => void;
  
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  
  // Events
  onTitleClick: () => void;
  onTitleContextMenu: (e: React.MouseEvent) => void;
  
  // Export menu handlers (for Download icon)
  onCopyAll: () => void;
  onCopyAllVerbose: () => void;
  onSaveAll: () => void;
  titleContextMenu: { x: number; y: number } | null;
  setTitleContextMenu: (menu: { x: number; y: number } | null) => void;
}

/**
 * AppHeader Component
 * 
 * Complete application header with all navigation and control elements:
 * - Title with domain filter toggle
 * - Domain LED indicator
 * - Message type toggles (Humans/Entities)
 * - Message counters (displayed + global)
 * - Username input with color picker
 * - TV toggle (optional)
 * - Filter bar
 * - Search bar
 * 
 * Orchestrates multiple sub-components for modularity.
 * 
 * @example
 * <AppHeader
 *   title="Say What Want"
 *   domainFilterEnabled={true}
 *   currentDomain="saywhatwant.app"
 *   userColor={userColor}
 *   userColorRgb={userColorRgb}
 *   showHumans={true}
 *   showEntities={true}
 *   username={username}
 *   // ... all other props
 * />
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  // Title & Domain
  title,
  domainFilterEnabled,
  currentDomain,
  mounted,
  modelDomain,
  userColor,
  userColorRgb,
  onTitleClick,
  onTitleContextMenu,
  
  // Export menu handlers
  onCopyAll,
  onCopyAllVerbose,
  onSaveAll,
  titleContextMenu,
  setTitleContextMenu,
  
  // Message Type Channel
  activeChannel,
  onChannelChange,
  
  // Username & Color
  username,
  hasClickedUsername,
  usernameFlash,
  showColorPicker,
  randomizedColors,
  maxUsernameLength,
  usernameRef,
  colorPickerRef,
  onUsernameChange,
  onUsernameFocus,
  onUsernameTab,
  onClearUsername,
  onToggleColorPicker,
  onSelectColor,
  
  // TV Toggle
  showVideo,
  onToggleVideo,
  
  // Message Counts
  displayedCount,
  globalCount,
  
  // Filters
  filterUsernames,
  filterWords,
  negativeFilterWords,
  isFilterEnabled,
  hasActiveFilters,
  dateTimeFilter,
  onToggleFilter,
  onRemoveUsernameFilter,
  onRemoveWordFilter,
  onRemoveNegativeFilter,
  onClearDateTimeFilter,
  
  // Search
  searchTerm,
  onSearchChange,
  onClearSearch
}) => {
  return (
    <div className="flex-shrink-0 border-b border-white/10 bg-black/50 backdrop-blur-sm">
      <div className="p-3 space-y-2">
        {/* Title and Domain Filter */}
        <div className="flex items-center justify-between gap-4">
          {/* Icons: Human, AI, Download, Share (moved to left) */}
          <div className="flex items-center gap-1.5">
          
          {/* Message Type Toggle (Exclusive Channel) */}
          <MessageTypeToggle
            activeChannel={activeChannel}
            userColorRgb={userColorRgb}
            onChannelChange={onChannelChange}
          />
          
          {/* Spacer */}
          <div className="w-3" />
          
          {/* Download Icon - Toggles export menu */}
          <button
            onClick={(e) => {
              if (titleContextMenu) {
                // Menu is open - close it
                setTitleContextMenu(null);
              } else {
                // Menu is closed - open it
                const rect = e.currentTarget.getBoundingClientRect();
                setTitleContextMenu({ 
                  x: rect.left, 
                  y: rect.bottom + 5 
                });
              }
            }}
            className="p-2 rounded-full transition-all hover:bg-black/40"
            title="Export conversation"
          >
            <Download 
              className="w-6 h-6"
              style={{ color: getDarkerColor(userColorRgb, OPACITY_LEVELS.MEDIUM) }}
            />
          </button>
          
          {/* Share Icon - Placeholder for future */}
          <button
            className="p-2 rounded-full transition-all opacity-50 cursor-not-allowed"
            title="Share conversation (coming soon)"
            disabled
          >
            <Share2 
              className="w-6 h-6"
              style={{ color: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK) }}
            />
          </button>
          
          {/* Small gap separator */}
          <div className="w-2" />
          
          {/* TV Toggle */}
          {onToggleVideo && (
            <button
              onClick={onToggleVideo}
              className="p-2 rounded-full transition-all hover:bg-black/40"
              style={{ 
                color: showVideo 
                  ? getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT)
                  : getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK),
                opacity: showVideo ? 1 : 0.5
              }}
              title={showVideo ? 'Hide video' : 'Show video'}
            >
              <Tv className="w-6 h-6" />
            </button>
          )}
          
          </div>
          
          {/* User Controls (anchored right) */}
          <UserControls
            username={username}
            userColor={userColor}
            userColorRgb={userColorRgb}
            hasClickedUsername={hasClickedUsername}
            usernameFlash={usernameFlash}
            showColorPicker={showColorPicker}
            randomizedColors={randomizedColors}
            maxUsernameLength={maxUsernameLength}
            displayedCount={displayedCount}
            globalCount={globalCount}
            onUsernameChange={onUsernameChange}
            onUsernameFocus={onUsernameFocus}
            onUsernameTab={onUsernameTab}
            onClearUsername={onClearUsername}
            onToggleColorPicker={onToggleColorPicker}
            onSelectColor={onSelectColor}
            usernameRef={usernameRef}
            colorPickerRef={colorPickerRef}
          />
        </div>

        {/* Filter Bar and Search Bar - Shared Row */}
        <div className="flex items-center gap-3">
          {/* Filter Bar (2/3 width) */}
          <div className="flex-[2]">
            <FilterBar 
              filterUsernames={filterUsernames}
              filterWords={filterWords}
              negativeFilterWords={negativeFilterWords}
              isFilterEnabled={isFilterEnabled}
              hasActiveFilters={hasActiveFilters}
              userColor={userColorRgb}
              dateTimeFilter={dateTimeFilter}
              onToggleFilter={onToggleFilter}
              onRemoveUsernameFilter={onRemoveUsernameFilter}
              onRemoveWordFilter={onRemoveWordFilter}
              onRemoveNegativeFilter={onRemoveNegativeFilter}
              onClearDateTimeFilter={onClearDateTimeFilter}
              getDarkerColor={getDarkerColor}
            />
          </div>

          {/* Search Bar (1/3 width) */}
          <div className="flex-[1]">
            <SearchBar
              searchTerm={searchTerm}
              userColor={userColor}
              userColorRgb={userColorRgb}
              onSearchChange={onSearchChange}
              onClearSearch={onClearSearch}
              placeholder="Search..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;

