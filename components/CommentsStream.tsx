'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, ChevronDown, Tv, Ban } from 'lucide-react';
import { StyledSearchIcon, StyledClearIcon, StyledUserIcon, StyledSearchInput, StyledUsernameInput, StyledCharCounter } from '@/components/UIElements';
import { Comment, CommentsResponse } from '@/types';
import { useFilters } from '@/hooks/useFilters';
import FilterBar from '@/components/FilterBar';
import DomainFilter from '@/components/DomainFilter';
import { parseCommentText } from '@/utils/textParsing';
import { COMMENTS_CONFIG, getCommentsConfig } from '@/config/comments-source';
import { getCurrentDomain, getCurrentDomainConfig, isDomainFilterEnabled, toggleDomainFilter } from '@/config/domain-config';

// Configuration - Now using config file
const INITIAL_LOAD_COUNT = COMMENTS_CONFIG.initialLoadCount; // 50 (Ham Radio Mode)
const POLLING_INTERVAL = COMMENTS_CONFIG.pollingInterval;
const MAX_COMMENT_LENGTH = 201;
const POLL_BATCH_LIMIT = 50; // Max new messages per poll
const MAX_USERNAME_LENGTH = 16;

// Import color functions from the color system
import { getRandomColor, getDarkerColor, COLOR_PALETTE } from '@/modules/colorSystem';
import { getCommentColor } from '@/modules/usernameColorGenerator';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
// Import cloud API functions
import { fetchCommentsFromCloud, postCommentToCloud, isCloudAPIEnabled } from '@/modules/cloudApiClient';
// Import timestamp system
import { formatTimestamp } from '@/modules/timestampSystem';
// Import keyboard shortcuts
import { useCommonShortcuts } from '@/modules/keyboardShortcuts';
// Import polling system
import { useCommentsPolling, useAutoScrollDetection } from '@/modules/pollingSystem';
// Import video sharing system
import { useVideoSharing } from '@/modules/videoSharingSystem';
// Import comment submission system
import { useCommentSubmission, useUsernameValidation } from '@/modules/commentSubmission';

interface CommentsStreamProps {
  showVideo?: boolean;
  toggleVideo?: () => void;
}

const CommentsStream: React.FC<CommentsStreamProps> = ({ showVideo = false, toggleVideo }) => {
  // Domain configuration
  const [domainConfig] = useState(() => getCurrentDomainConfig());
  const [currentDomain] = useState(() => getCurrentDomain());
  const [domainFilterEnabled, setDomainFilterEnabled] = useState(() => isDomainFilterEnabled());
  
  // State management
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [displayedComments, setDisplayedComments] = useState<Comment[]>([]);
  const [inputText, setInputText] = useState('');
  const [username, setUsername] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasNewComments, setHasNewComments] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [hasClickedUsername, setHasClickedUsername] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [userColor, setUserColor] = useState(() => getRandomColor()); // Start with random color
  const [randomizedColors, setRandomizedColors] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false); // For hydration safety

  // Refs
  const streamRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const lastFetchTimeRef = useRef<number>(Date.now());
  const colorPickerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll detection using the new modular system
  const { isNearBottom, scrollToBottom: smoothScrollToBottom } = useAutoScrollDetection(streamRef, 100);
  
  // Video sharing system
  const {
    pendingVideoKey,
    setPendingVideoKey,
    processVideoInComment,
    handleInputChange: handleVideoInputChange,
    handleVideoLinkClick,
    getInputCursorStyle,
    clearVideoState,
  } = useVideoSharing(inputRef, setInputText);
  
  // Username validation
  const { isFlashing: usernameFlash, flashUsername } = useUsernameValidation(username);
  
  // Comment submission system
  const currentDomain = getCurrentDomain();
  const {
    isSubmitting,
    error,
    handleSubmit: submitComment,
    setError,
  } = useCommentSubmission(
    {
      maxLength: MAX_COMMENT_LENGTH,
      domain: currentDomain,
      storageKey: COMMENTS_STORAGE_KEY,
    },
    {
      onOptimisticUpdate: (comment) => {
        setAllComments(prev => [...prev, comment]);
      },
      onOptimisticRemove: (commentId) => {
        setAllComments(prev => prev.filter(c => c.id !== commentId));
      },
      onInputClear: () => setInputText(''),
      onScrollToBottom: () => {
        if (streamRef.current) {
          streamRef.current.scrollTop = streamRef.current.scrollHeight;
        }
      },
      onFocusInput: () => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      },
      loadCommentsFromStorage,
      saveCommentsToStorage,
      processVideoInComment,
      clearVideoState,
    }
  );
  
  // Apply domain filtering if enabled
  const domainFilteredComments = useMemo(() => {
    if (!domainFilterEnabled) return displayedComments;
    return displayedComments.filter(comment => 
      comment.domain === currentDomain || 
      !comment.domain // Show old comments without domain field
    );
  }, [displayedComments, domainFilterEnabled, currentDomain]);

  // Use the filters hook with domain-filtered comments
  const {
    filterUsernames,
    filterWords,
    negativeFilterWords,
    isFilterEnabled,
    filteredComments,
    addToFilter,
    removeFromFilter,
    addWordToFilter,
    removeWordFromFilter,
    addNegativeWordFilter,
    removeNegativeWordFilter,
    toggleFilter,
    hasActiveFilters,
    urlSearchTerms,
    addSearchTermToURL,
    removeSearchTermFromURL,
    serverSideUsers,  // Server-side user search from #uss= parameter
    dateTimeFilter,
    clearDateTimeFilter
  } = useFilters({ displayedComments: domainFilteredComments, searchTerm });

  // Storage key for localStorage
  const COMMENTS_STORAGE_KEY = 'sww-comments-local';
  
  // Sync search bar with URL search terms
  useEffect(() => {
    if (urlSearchTerms.length > 0) {
      // Join multiple search terms with space
      setSearchTerm(urlSearchTerms.join(' '));
    }
  }, [urlSearchTerms]);

  // Load username, color, and filters from localStorage
  useEffect(() => {
    setMounted(true); // Mark as mounted for hydration safety
    
    const savedUsername = localStorage.getItem('sww-username');
    const savedColor = localStorage.getItem('sww-color');
    if (savedUsername) {
      setUsername(savedUsername);
      setHasClickedUsername(true); // If there's a saved username, treat it as if they've clicked
    }
    
    if (savedColor) {
      // Handle both old hex format and new RGB format
      if (savedColor.startsWith('#')) {
        // Convert old hex to RGB
        const hexMatch = savedColor.match(/^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i);
        if (hexMatch) {
          const r = parseInt(hexMatch[1], 16);
          const g = parseInt(hexMatch[2], 16);
          const b = parseInt(hexMatch[3], 16);
          const rgbColor = `rgb(${r}, ${g}, ${b})`;
          setUserColor(rgbColor);
          localStorage.setItem('sww-color', rgbColor); // Update to new format
        }
      } else if (savedColor.startsWith('rgb')) {
        setUserColor(savedColor);
      }
    }
  }, []);

  // Video share events are now handled by useVideoSharing hook
  // When video is shared, it updates inputText directly via the hook

  // Close color picker on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };

    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker]);

  // Handle server-side user search when URL has #uss= parameter
  useEffect(() => {
    // Only trigger if we have server-side users and cloud API is enabled
    if (!serverSideUsers || serverSideUsers.length === 0 || !isCloudAPIEnabled()) {
      return;
    }

    // Build the uss query parameter from users
    const ussQuery = serverSideUsers
      .map(user => {
        // Convert RGB to 9-digit format for URL
        const rgbToNineDigit = (color: string): string => {
          const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (rgbMatch) {
            const r = rgbMatch[1].padStart(3, '0');
            const g = rgbMatch[2].padStart(3, '0');
            const b = rgbMatch[3].padStart(3, '0');
            return `${r}${g}${b}`;
          }
          // If already 9 digits or other format, return as-is
          if (/^\d{9}$/.test(color)) return color;
          return '255255255'; // Default white
        };

        const colorDigits = rgbToNineDigit(user.color || '#60A5FA');
        return `${user.username}:${colorDigits}`;
      })
      .join('+');

    console.log('[Comments] Performing server-side search for:', ussQuery);
    setIsLoading(true);

    // Fetch from API with server-side search
    fetch(`${COMMENTS_CONFIG.apiUrl}?uss=${encodeURIComponent(ussQuery)}`)
      .then(res => res.json())
      .then((data: CommentsResponse) => {
        if (data.serverSideSearch && data.comments) {
          console.log(`[Comments] Server-side search returned ${data.comments.length} results`);
          
          // MERGE server results with existing comments (don't replace)
          // This is for catching up on messages missed while tab was closed
          const existingIds = new Set(allComments.map(c => c.id));
          const newMessages = data.comments.filter(c => !existingIds.has(c.id));
          
          if (newMessages.length > 0) {
            console.log(`[Comments] Adding ${newMessages.length} new messages from server`);
            
            // Merge and sort by timestamp (newest first) 
            const mergedComments = [...allComments, ...newMessages]
              .sort((a, b) => b.timestamp - a.timestamp);
              
              setAllComments(mergedComments);
          } else {
            console.log('[Comments] No new messages from server search');
          }
          
          setIsLoading(false);
        }
      })
      .catch(err => {
        console.error('[Comments] Server-side search failed:', err);
        setIsLoading(false);
      });
  }, [serverSideUsers]); // Only re-run when serverSideUsers changes

  // Keyboard shortcuts using the common shortcuts module
  // ⚠️ CRITICAL: NEVER ADD MODIFIER KEYS TO SHORTCUTS IN THIS APP ⚠️
  // The 'r' shortcut is properly handled in the module with NO modifiers
  useCommonShortcuts({
    onColorChange: (color) => {
      if (color === 'random') {
        const randomColor = getRandomColor();
        setUserColor(randomColor);
        localStorage.setItem('sww-color', randomColor);
      }
    },
    onFocusInput: () => {
      inputRef.current?.focus();
    },
    inputRef
  });

  // Create wrapped parse function with handlers
  const parseCommentTextWithHandlers = useCallback((text: string): React.ReactNode[] => {
    return parseCommentText(text, {
      onWordClick: addWordToFilter,
      onWordRightClick: addNegativeWordFilter,
      onVideoClick: (videoKey) => {
        // Open video area if it's closed
        if (!showVideo && toggleVideo) {
          toggleVideo();
        }
        
        // Play the video
        const playEvent = new CustomEvent('playSharedVideo', {
          detail: { videoKey }
        });
        window.dispatchEvent(playEvent);
      }
    });
  }, [addWordToFilter, addNegativeWordFilter, showVideo, toggleVideo]);

  // Timestamp formatting is now imported from timestampSystem module

  // Load comments from localStorage or fallback to static JSON
  const loadCommentsFromStorage = useCallback((): Comment[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(COMMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('[Comments] Failed to load from localStorage:', error);
    }
    return [];
  }, []);

  // Save comments to localStorage
  const saveCommentsToStorage = useCallback((comments: Comment[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      // Keep only the last 1000 comments
      const toSave = comments.slice(-1000);
      localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('[Comments] Failed to save to localStorage:', error);
    }
  }, []);

  // Fetch comments from cloud API is now imported from cloudApiClient module

  // Fetch comments (supports both localStorage and cloud API)
  const fetchComments = useCallback(async (offset = 0, limit = INITIAL_LOAD_COUNT) => {
    try {
      if (isCloudAPIEnabled()) {
        // Use cloud API
        return await fetchCommentsFromCloud(offset, limit);
      }
      
      // Use localStorage (existing implementation)
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const allStoredComments = loadCommentsFromStorage();
      
      // Sort by timestamp (newest last for chat-style display)
      allStoredComments.sort((a, b) => a.timestamp - b.timestamp);
      
      const total = allStoredComments.length;
      const start = Math.max(0, total - offset - limit);
      const end = total - offset;
      const slice = allStoredComments.slice(start, end);
      
      const data: CommentsResponse = {
        comments: slice,
        total: total,
        hasMore: start > 0,
      };
      
      return data;
    } catch (err) {
      console.error('[Comments] Error fetching comments:', err);
      throw err;
    }
  }, [loadCommentsFromStorage]);

  // Initial load
  useEffect(() => {
    const loadInitialComments = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // In dev mode with localStorage enabled, try to load from static JSON first
        if (COMMENTS_CONFIG.useLocalStorage) {
          try {
            const response = await fetch('/kv-data-export.json');
            if (response.ok) {
              const exportData = await response.json();
              const comments = exportData.comments || [];
              
              // Store in localStorage for consistency
              localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
              
              setAllComments(comments);
              console.log(`[Dev Mode] Loaded ${comments.length} comments from static JSON`);
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.log('[Dev Mode] Static JSON not found, falling back to localStorage');
          }
        }
        
        // Default behavior - use fetchComments (either cloud API or localStorage)
        const data = await fetchComments(0, INITIAL_LOAD_COUNT);
        // Only keep the most recent messages (Ham Radio Mode)
        const recentMessages = data.comments.slice(-INITIAL_LOAD_COUNT);
        setAllComments(recentMessages);
        
        // Scroll to bottom on initial load
        setTimeout(() => {
          if (streamRef.current) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
          }
        }, 100);
      } catch (err) {
        setError('Failed to load comments. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialComments();
  }, [fetchComments]);

  // Check for new comments using cursor-based polling (ultra efficient!)
  const checkForNewComments = useCallback(async () => {
    try {
      let newComments: Comment[] = [];
      
      if (isCloudAPIEnabled()) {
        // Get the latest timestamp we have
        const latestTimestamp = allComments.length > 0 
          ? Math.max(...allComments.map(c => c.timestamp))
          : Date.now() - 60000; // Start from 1 minute ago if no comments
        
        // Use cursor-based polling - only get messages AFTER our latest
        const response = await fetch(
          `${COMMENTS_CONFIG.apiUrl}?after=${latestTimestamp}&limit=${POLL_BATCH_LIMIT}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        newComments = await response.json();
        
        if (newComments.length > 0) {
          console.log(`[Cursor Polling] Found ${newComments.length} new messages after timestamp ${latestTimestamp}`);
          
          // Just append new messages - no deduplication needed!
          setAllComments(prev => {
            // Combine and keep reasonable size
            const combined = [...prev, ...newComments];
            // Keep only recent messages to prevent memory issues
            if (combined.length > INITIAL_LOAD_COUNT * 2) {
              return combined.slice(-INITIAL_LOAD_COUNT);
            }
            return combined;
          });
        }
      } else {
        // Use localStorage polling - simple check for new messages
        const storedComments = loadCommentsFromStorage();
        const latestTimestamp = allComments.length > 0 
          ? Math.max(...allComments.map(c => c.timestamp))
          : 0;
        
        newComments = storedComments.filter(c => c.timestamp > latestTimestamp);
        
        if (newComments.length > 0) {
          console.log(`[LocalStorage] Found ${newComments.length} new comments`);
          setAllComments(storedComments.slice(-INITIAL_LOAD_COUNT)); // Keep bounded
        }
      }
      
      if (newComments.length > 0) {
        // Smart auto-scroll using the new system
        if (isNearBottom) {
          setTimeout(() => smoothScrollToBottom(), 50);
        } else {
          setHasNewComments(true);
        }
      }
      
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      console.error('[Comments] Polling error:', err);
    }
  }, [allComments, loadCommentsFromStorage, isNearBottom, smoothScrollToBottom]);
  
  // Use the modular polling system
  useCommentsPolling({
    checkForNewComments,
    isLoading,
    pollingInterval: POLLING_INTERVAL,
    useLocalStorage: COMMENTS_CONFIG.useLocalStorage,
    storageKey: COMMENTS_STORAGE_KEY
  });

  // Handle comment submission (using the new submission system)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitComment(inputText, username, userColor, flashUsername);
  };

  // Keep displayedComments in sync with allComments (no lazy loading needed)
  useEffect(() => {
    setDisplayedComments(allComments);
  }, [allComments]);

  // Scroll to bottom
  const scrollToBottom = () => {
    smoothScrollToBottom(false); // Use instant scroll for click
    setHasNewComments(false);
  };

  // Username is now auto-saved on change, no need for save function
  
  // Handle color selection
  const selectColor = (color: string) => {
    setUserColor(color);
    localStorage.setItem('sww-color', color);
    setShowColorPicker(false);
  };


  // Shuffle colors array
  const shuffleColors = () => {
    // Generate 12 unique random colors for the color picker
    const colors: string[] = [];
    const usedColors = new Set<string>();
    
    while (colors.length < 12) {
      const color = getRandomColor();
      // Ensure we don't have duplicates
      if (!usedColors.has(color)) {
        colors.push(color);
        usedColors.add(color);
      }
    }
    
    setRandomizedColors(colors);
  };

  // Toggle color picker with randomization
  const toggleColorPicker = () => {
    if (!showColorPicker) {
      shuffleColors();
    }
    setShowColorPicker(!showColorPicker);
  };


  // Scroll to bottom when filters are turned off
  useEffect(() => {
    if (!streamRef.current) return;
    
    // When filter is turned off, scroll to bottom to show latest messages
    if (!isFilterEnabled) {
      setTimeout(() => {
        if (streamRef.current) {
          streamRef.current.scrollTop = streamRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [isFilterEnabled]);

  // Scroll to bottom when search is cleared
  useEffect(() => {
    if (!streamRef.current) return;
    
    // When search is cleared, scroll to bottom to show latest messages
    if (!searchTerm) {
      setTimeout(() => {
        if (streamRef.current) {
          streamRef.current.scrollTop = streamRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [searchTerm]);


  return (
    <div className="flex flex-col h-full bg-black text-white overflow-x-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="p-3 space-y-2">
          {/* Title and Domain Filter */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 
                className="sww-title transition-opacity" 
                style={{ 
                  color: userColor,
                  opacity: domainFilterEnabled ? 0.4 : 0.25, // Simple opacity change
                  textShadow: 'none' // Explicitly remove any text shadow
                }}
              >
                {domainConfig.title}
              </h2>
              {mounted && (
                <DomainFilter
                  isEnabled={domainFilterEnabled}
                  domain={currentDomain}
                  color={userColor}
                  onClick={() => {
                    const newState = toggleDomainFilter();
                    setDomainFilterEnabled(newState);
                  }}
                />
              )}
            </div>
            
            {/* Username Input and TV Toggle - Always Visible */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center gap-2" style={{ width: 'calc(15ch + 65px)' }} ref={colorPickerRef}>
              <button
                onClick={toggleColorPicker}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 hover:opacity-80 transition-opacity z-10"
                aria-label="Choose color"
                title="Click to pick color or press 'R' for random"
                tabIndex={-1}
              >
                <StyledUserIcon userColor={userColor} />
              </button>
              
              {/* Color Picker Dropdown */}
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-2 grid grid-cols-6 gap-1 z-20 shadow-xl">
                  {randomizedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => selectColor(color)}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors"
                      aria-label={`Select color ${color}`}
                    >
                      <StyledUserIcon userColor={color} />
                    </button>
                  ))}
                </div>
              )}
              <StyledUsernameInput
                inputRef={usernameRef}
                value={username}
                onChange={(e) => {
                  // Remove spaces and limit length
                  const newUsername = e.target.value.replace(/\s/g, '').substring(0, MAX_USERNAME_LENGTH);
                  setUsername(newUsername);
                  localStorage.setItem('sww-username', newUsername);
                }}
                onFocus={() => {
                  if (!hasClickedUsername) {
                    setHasClickedUsername(true);
                  }
                }}
                onKeyDown={(e) => {
                  // Tab to message field
                  if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    inputRef.current?.focus();
                  }
                }}
                userColor={userColor}
                placeholder={hasClickedUsername && username ? "" : "..."}
                maxLength={MAX_USERNAME_LENGTH}
                usernameFlash={usernameFlash}
              />
              {username && (
                <button
                  onClick={() => {
                    setUsername('');
                    localStorage.removeItem('sww-username');
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:opacity-80 rounded transition-opacity"
                  aria-label="Clear username"
                  tabIndex={-1}
                >
                  <StyledClearIcon userColor={userColor} />
                </button>
              )}
            </div>
            
            {/* TV Toggle */}
            {toggleVideo && (
              <button
                onClick={toggleVideo}
                className="p-2 hover:opacity-80 transition-opacity"
                style={{ 
                  color: showVideo 
                    ? getDarkerColor(userColor, OPACITY_LEVELS.LIGHT)  // 60% opacity when active
                    : userColor,  // Full color when off
                  opacity: showVideo ? 1 : OPACITY_LEVELS.MEDIUM  // 50% opacity when off
                }}
                title={showVideo ? 'Hide video' : 'Show video'}
                tabIndex={-1}
              >
                <Tv className="w-5 h-5" />
              </button>
            )}
          </div>
          </div>

          {/* Filter Bar */}
          <FilterBar 
              filterUsernames={filterUsernames}
              filterWords={filterWords}
              negativeFilterWords={negativeFilterWords}
              isFilterEnabled={isFilterEnabled}
              hasActiveFilters={hasActiveFilters}
              userColor={userColor}
              dateTimeFilter={dateTimeFilter}
              onToggleFilter={toggleFilter}
              onRemoveUsernameFilter={removeFromFilter}
              onRemoveWordFilter={removeWordFromFilter}
              onRemoveNegativeFilter={removeNegativeWordFilter}
              onClearDateTimeFilter={clearDateTimeFilter}
              getDarkerColor={getDarkerColor}
            />

          {/* Search Bar - Instant Search */}
          <div className="relative">
            <StyledSearchIcon userColor={userColor} />
              <StyledSearchInput 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              userColor={userColor}
              placeholder="Search..."
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:opacity-80 rounded transition-colors"
                aria-label="Clear search"
                tabIndex={-1}
              >
                <StyledClearIcon userColor={userColor} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comments Stream */}
      <div 
        ref={streamRef}
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 space-y-1"
        style={{
          ['--scrollbar-color' as any]: getDarkerColor(userColor, OPACITY_LEVELS.DARK), // 40% opacity
          ['--scrollbar-bg' as any]: getDarkerColor(userColor, OPACITY_LEVELS.DARKEST * 0.5), // 5% opacity
        } as React.CSSProperties}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="text-center py-8">
            {!searchTerm && (
              <Ban 
                className="w-12 h-12 mx-auto mb-4" 
                style={{ color: userColor }}
              />
            )}
            <p style={{ color: userColor }}>
              {searchTerm ? 'No matching comments' : (
                <>
                  Apparently there's nothing to see here.
                  <br /><br />
                  Try turning filters off, changing filters, search term<br />or check what link got you here.<br />Maybe someone fucked something up.<br /><br />99.9% chance it's not a server issue.
                </>
              )}
            </p>
          </div>
        ) : (
          filteredComments.map((comment) => (
            <div 
              key={comment.id} 
              className="comment-enter bg-white/5 rounded-lg px-3 py-2 hover:bg-white/[0.07] transition-colors"
            >
              <div className="flex items-start relative" style={{ gap: 'var(--comment-username-gap)' }}>
                {/* Username - vertically centered with first line of message */}
                <button 
                  onClick={() => comment.username && addToFilter(comment.username, getCommentColor(comment))}
                  className="text-xs font-medium flex-shrink-0 hover:underline cursor-pointer" 
                  style={{ 
                    lineHeight: '20px',
                    color: getDarkerColor(getCommentColor(comment), OPACITY_LEVELS.LIGHT)  // Use generated color for consistency
                  }}
                  tabIndex={-1}
                >
                  {comment.username || 'Anonymous'}:
                </button>
                
                {/* Message with right margin for timestamp */}
                <div className="flex-1 pr-12">
                  <div className="text-sm leading-snug break-all overflow-wrap-anywhere" style={{ 
                    lineHeight: '20px',
                    color: getCommentColor(comment) // Use actual or generated color
                  }}>
                    {parseCommentTextWithHandlers(comment.text)}
                  </div>
                </div>
                
                {/* Timestamp - positioned absolute on right */}
                <span 
                  className="absolute top-0 right-0 text-[10px] border px-1.5 py-0.5 rounded"
                  style={{ 
                    color: getDarkerColor(getCommentColor(comment), 0.7),  // Use actual or generated color
                    borderColor: getDarkerColor(getCommentColor(comment), OPACITY_LEVELS.DARK),  // Use actual or generated color
                    backgroundColor: getDarkerColor(getCommentColor(comment), OPACITY_LEVELS.DARKEST)  // Use actual or generated color
                  }}
                >
                  {formatTimestamp(comment.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Comments Indicator */}
      {hasNewComments && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 transform -translate-x-1/2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg flex items-center gap-1.5 transition-all hover-scale"
        >
          <ChevronDown className="w-3 h-3" />
          <span className="text-xs">New comments</span>
        </button>
      )}

      {/* Input Form */}
      <div className="flex-shrink-0 border-t border-white/10 bg-black/50 backdrop-blur-sm p-3">
        {error && (
          <div className="mb-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="relative">
            {/* Character counter at top of textarea */}
            <StyledCharCounter 
              current={inputText.length}
              max={MAX_COMMENT_LENGTH}
              userColor={userColor}
            />
            
            {/* Send button inside field, under character count */}
            <button
              type="submit"
              disabled={isSubmitting || !inputText.trim()}
              className={`absolute top-6 right-2 p-1 rounded transition-all z-10 ${
                isSubmitting || !inputText.trim()
                  ? 'cursor-not-allowed'
                  : 'hover:opacity-80 cursor-pointer'
              }`}
              style={{ 
                color: userColor, // Message text color
                opacity: (isSubmitting || !inputText.trim()) ? OPACITY_LEVELS.DARK : 1 // 40% when disabled
              }}
              tabIndex={-1}
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
            
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => {
                const newText = e.target.value.substring(0, MAX_COMMENT_LENGTH);
                setInputText(newText);
                // Handle video placeholder removal
                handleVideoInputChange(newText);
              }}
              onClick={() => {
                // Handle clicking on video link in input
                if (inputText.includes('<-- video')) {
                  handleVideoLinkClick(showVideo || false, toggleVideo);
                }
              }}
              placeholder="Say what you want..."
              className="w-full px-3 pt-6 pb-2 pr-10 bg-white/5 border border-white/10 rounded-lg resize-none focus:outline-none focus:border-white/30 min-h-[56px] max-h-[120px] text-sm custom-scrollbar"
              style={{
                ['--placeholder-color' as any]: getDarkerColor(userColor, OPACITY_LEVELS.DARK), // 40% opacity
                ['--scrollbar-color' as any]: getDarkerColor(userColor, OPACITY_LEVELS.LIGHT), // 60% opacity
                ['--scrollbar-bg' as any]: getDarkerColor(userColor, OPACITY_LEVELS.DARKEST), // 10% opacity
                color: userColor, // Always use user's color
                backgroundColor: getDarkerColor(userColor, OPACITY_LEVELS.DARKEST * 0.5), // 5% opacity - even darker than darkest
                ...getInputCursorStyle(inputText), // Video link cursor styling
              } as React.CSSProperties}
              maxLength={MAX_COMMENT_LENGTH}
              // No disabled state - allow immediate typing for rapid messaging
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                } else if (e.key === 'Tab' && e.shiftKey) {
                  // Shift+Tab to username field
                  e.preventDefault();
                  usernameRef.current?.focus();
                } else if (e.key === 'Tab' && !e.shiftKey) {
                  // Tab cycles back to username
                  e.preventDefault();
                  usernameRef.current?.focus();
                }
              }}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommentsStream;
