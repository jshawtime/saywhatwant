/**
 * AppHeader Component
 * 
 * Main application header with title, domain filter, message type toggles, and user controls
 * Orchestrates multiple sub-components for clean separation of concerns
 */

import React from 'react';
import DomainFilter from '@/components/DomainFilter';
import FilterBar from '@/components/FilterBar';
import { SearchBar } from '@/components/Search/SearchBar';
import { MessageTypeToggle } from './MessageTypeToggle';
import { UserControls } from './UserControls';
import { getDarkerColor } from '@/modules/colorSystem';
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
  
  // Message Type Channel (exclusive: human OR AI)
  activeChannel: 'human' | 'AI';
  onChannelChange: (channel: 'human' | 'AI') => void;
  
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
          {/* Title & Domain LED */}
          <div className="flex items-center gap-3">
            <h2 
              onClick={onTitleClick}
              onContextMenu={onTitleContextMenu}
              className="sww-title transition-opacity cursor-pointer select-none" 
              title={domainFilterEnabled 
                ? "Show messages across all domains | Right click more options" 
                : "Show messages from this domain only | Right click more options"
              }
              style={{ 
                color: userColorRgb,
                opacity: domainFilterEnabled ? 0.4 : 0.25,
                textShadow: 'none'
              }}
            >
              {modelDomain || title}
            </h2>
            
            {mounted && (
              <DomainFilter
                isEnabled={domainFilterEnabled}
                domain={currentDomain}
                color={userColorRgb}
                onClick={onTitleClick}
              />
            )}
          </div>
          
          {/* Message Type Toggle (Exclusive Channel) */}
          <MessageTypeToggle
            activeChannel={activeChannel}
            userColorRgb={userColorRgb}
            onChannelChange={onChannelChange}
          />
          
          {/* User Controls */}
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
            showVideo={showVideo}
            onUsernameChange={onUsernameChange}
            onUsernameFocus={onUsernameFocus}
            onUsernameTab={onUsernameTab}
            onClearUsername={onClearUsername}
            onToggleColorPicker={onToggleColorPicker}
            onSelectColor={onSelectColor}
            onToggleVideo={onToggleVideo}
            usernameRef={usernameRef}
            colorPickerRef={colorPickerRef}
          />
        </div>

        {/* Filter Bar */}
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

        {/* Search Bar */}
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
  );
};

export default AppHeader;

