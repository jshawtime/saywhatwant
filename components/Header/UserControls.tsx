/**
 * UserControls Component
 * 
 * Username input with integrated color picker
 * Handles user identity and color selection
 */

import React from 'react';
import { StyledUserIcon, StyledUsernameInput, StyledClearIcon } from '@/components/UIElements';
import { ColorPickerDropdown } from '@/components/ColorPicker/ColorPickerDropdown';
import { getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { formatNumber } from '@/utils/formatNumber';

interface UserControlsProps {
  /**
   * Current username value
   */
  username: string;
  
  /**
   * User's color in 9-digit format
   */
  userColor: string;
  
  /**
   * User's color in RGB format for styling
   */
  userColorRgb: string;
  
  /**
   * Whether user has interacted with username field
   */
  hasClickedUsername: boolean;
  
  /**
   * Whether username flash animation is active
   */
  usernameFlash: boolean;
  
  /**
   * Whether color picker dropdown is shown
   */
  showColorPicker: boolean;
  
  /**
   * Array of randomized colors for picker
   */
  randomizedColors: string[];
  
  /**
   * Maximum username length
   */
  maxUsernameLength: number;
  
  /**
   * Number of messages in current window
   */
  displayedCount: number;
  
  /**
   * Global message count
   */
  globalCount: number;
  
  /**
   * Callback when username changes
   */
  onUsernameChange: (username: string) => void;
  
  /**
   * Callback when username field is focused
   */
  onUsernameFocus: () => void;
  
  /**
   * Callback when Tab key is pressed in username
   */
  onUsernameTab: () => void;
  
  /**
   * Callback to clear username
   */
  onClearUsername: () => void;
  
  /**
   * Callback to toggle color picker
   */
  onToggleColorPicker: () => void;
  
  /**
   * Callback when color is selected
   */
  onSelectColor: (color: string) => void;
  
  /**
   * Ref for username input element
   */
  usernameRef: React.RefObject<HTMLInputElement>;
  
  /**
   * Ref for color picker container
   */
  colorPickerRef: React.RefObject<HTMLDivElement>;
}

/**
 * UserControls Component
 * 
 * Complete user identity controls including:
 * - Message counters (displayed + global)
 * - Username input with validation
 * - Color picker with dropdown
 * - Clear username button
 * - TV toggle (optional)
 * - Tab navigation support
 * 
 * @example
 * <UserControls
 *   username={username}
 *   userColor={userColor}
 *   userColorRgb={userColorRgb}
 *   hasClickedUsername={hasClickedUsername}
 *   showColorPicker={showColorPicker}
 *   randomizedColors={randomizedColors}
 *   onUsernameChange={handleUsernameChange}
 *   onToggleColorPicker={toggleColorPicker}
 *   onSelectColor={selectColor}
 *   usernameRef={usernameRef}
 *   colorPickerRef={colorPickerRef}
 *   // ... other props
 * />
 */
export const UserControls: React.FC<UserControlsProps> = ({
  username,
  userColor,
  userColorRgb,
  hasClickedUsername,
  usernameFlash,
  showColorPicker,
  randomizedColors,
  maxUsernameLength,
  displayedCount,
  globalCount,
  onUsernameChange,
  onUsernameFocus,
  onUsernameTab,
  onClearUsername,
  onToggleColorPicker,
  onSelectColor,
  usernameRef,
  colorPickerRef
}) => {
  /**
   * Handle username input change with validation
   */
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove spaces and limit length
    const newUsername = e.target.value.replace(/\s/g, '').substring(0, maxUsernameLength);
    onUsernameChange(newUsername);
  };
  
  /**
   * Handle Tab key in username field
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      onUsernameTab();
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      {/* Messages Window Count */}
      {displayedCount > 0 && (
        <span 
          className="mr-2 opacity-60" 
          style={{ 
            color: userColorRgb,
            fontSize: '20.7px',  // 150% larger (was 13.8px)
            fontWeight: 500
          }}
          title="Messages in current window"
        >
          {formatNumber(displayedCount)}
        </span>
      )}
      
      {/* Global Message Counter */}
      {globalCount > 0 && (
        <span 
          className="mr-2 opacity-60" 
          style={{ 
            color: userColorRgb,
            fontSize: '20.7px',  // 150% larger (was 13.8px)
            fontWeight: 500
          }}
          title="Total global messages"
        >
          {formatNumber(globalCount)}
        </span>
      )}
      
      {/* Username Input with Color Picker */}
      <div 
        className="relative flex items-center gap-2" 
        style={{ width: 'calc(15ch + 65px)' }} 
        ref={colorPickerRef}
      >
        {/* Color Picker Button */}
        <button
          onClick={onToggleColorPicker}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 hover:opacity-80 transition-opacity z-10"
          aria-label="Choose color"
          title="Click to pick color or press 'R' for random"
          tabIndex={-1}
        >
          <StyledUserIcon userColor={userColorRgb} />
        </button>
        
        {/* Color Picker Dropdown */}
        <ColorPickerDropdown
          colors={randomizedColors}
          onSelectColor={onSelectColor}
          isVisible={showColorPicker}
        />
        
        {/* Username Input */}
        <StyledUsernameInput
          inputRef={usernameRef}
          value={username}
          onChange={handleUsernameChange}
          onFocus={() => {
            if (!hasClickedUsername) {
              onUsernameFocus();
            }
          }}
          onKeyDown={handleKeyDown}
          userColor={userColorRgb}
          placeholder={hasClickedUsername && username ? "" : "..."}
          maxLength={maxUsernameLength}
          usernameFlash={usernameFlash}
        />
        
        {/* Clear Username Button */}
        {username && (
          <button
            onClick={onClearUsername}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:opacity-80 rounded transition-opacity"
            aria-label="Clear username"
            tabIndex={-1}
          >
            <StyledClearIcon userColor={userColorRgb} />
          </button>
        )}
      </div>
      
    </div>
  );
};

export default UserControls;

