/**
 * SearchBar Component
 * 
 * Provides instant search interface with clear button
 * Pure presentation component - search logic handled by parent
 */

import React from 'react';
import { StyledSearchIcon, StyledClearIcon, StyledSearchInput } from '@/components/UIElements';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';

interface SearchBarProps {
  /**
   * Current search term value
   */
  searchTerm: string;
  
  /**
   * User's color in 9-digit format (for consistency)
   */
  userColor: string;
  
  /**
   * User's color in RGB format for CSS display
   */
  userColorRgb: string;
  
  /**
   * Callback when search value changes
   */
  onSearchChange: (value: string) => void;
  
  /**
   * Callback when clear button is clicked
   */
  onClearSearch: () => void;
  
  /**
   * Optional placeholder text
   * @default "Search..."
   */
  placeholder?: string;
}

/**
 * SearchBar Component
 * 
 * Displays search input with icon and optional clear button.
 * Icon opacity changes based on whether search is active.
 * 
 * @example
 * <SearchBar
 *   searchTerm={searchTerm}
 *   userColor={userColor}
 *   userColorRgb={userColorRgb}
 *   onSearchChange={(value) => setSearchTerm(value)}
 *   onClearSearch={() => setSearchTerm('')}
 * />
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  userColor,
  userColorRgb,
  onSearchChange,
  onClearSearch,
  placeholder = "Search..."
}) => {
  return (
    <div className="relative">
      {/* Search Icon - Full opacity when active, lighter when empty */}
      <StyledSearchIcon 
        userColor={userColorRgb} 
        opacity={searchTerm ? OPACITY_LEVELS.FULL : OPACITY_LEVELS.LIGHT} 
      />
      
      {/* Search Input */}
      <StyledSearchInput 
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        userColor={userColorRgb}
        placeholder={placeholder}
      />
      
      {/* Clear Button - Only shown when search has value */}
      {searchTerm && (
        <button
          onClick={onClearSearch}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:opacity-80 rounded transition-colors"
          aria-label="Clear search"
          tabIndex={-1}
        >
          <StyledClearIcon userColor={userColorRgb} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;

