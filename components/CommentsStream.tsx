'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, ChevronDown, Tv, Ban, Users, Sparkles } from 'lucide-react';
import { StyledSearchIcon, StyledClearIcon, StyledUserIcon, StyledSearchInput, StyledUsernameInput, StyledCharCounter, StyledFilterIcon } from '@/components/UIElements';
import { Comment, CommentsResponse } from '@/types';
import { useFilters } from '@/hooks/useFilters';
import { 
  getNotificationSystem, 
  getFilterKey, 
  getFilterNotificationSetting,
  markFilterAsUnread,
  NotificationSound 
} from '@/modules/notificationSystem';
import { simpleIndexedDB, FilterCriteria } from '@/modules/simpleIndexedDB';
import { useIndexedDBFiltering } from '@/hooks/useIndexedDBFiltering';
import FilterBar from '@/components/FilterBar';
import DomainFilter from '@/components/DomainFilter';
import { parseCommentText } from '@/utils/textParsing';
import { COMMENTS_CONFIG, getCommentsConfig } from '@/config/comments-source';
import { getCurrentDomain, getCurrentDomainConfig, isDomainFilterEnabled, toggleDomainFilter } from '@/config/domain-config';
import { MESSAGE_SYSTEM_CONFIG } from '@/config/message-system';

// Configuration - Now using config files
const INITIAL_LOAD_COUNT = MESSAGE_SYSTEM_CONFIG.cloudInitialLoad; // ALWAYS 0 - presence-based
const POLLING_INTERVAL = MESSAGE_SYSTEM_CONFIG.cloudPollingInterval; // 5000ms
const MAX_COMMENT_LENGTH = 201;
const POLL_BATCH_LIMIT = MESSAGE_SYSTEM_CONFIG.cloudPollBatch; // From config
const MAX_USERNAME_LENGTH = 16;
const MAX_DISPLAY_MESSAGES = MESSAGE_SYSTEM_CONFIG.maxDisplayMessages; // From config
const INDEXEDDB_INITIAL_LOAD = MESSAGE_SYSTEM_CONFIG.maxDisplayMessages; // Load same amount initially
const INDEXEDDB_LAZY_LOAD_CHUNK = MESSAGE_SYSTEM_CONFIG.lazyLoadChunkSize; // From config

// Import color functions from the color system
import { getRandomColor, getDarkerColor, COLOR_PALETTE, nineDigitToRgb } from '@/modules/colorSystem';
import { getCommentColor } from '@/modules/usernameColorGenerator';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { ContextMenu } from '@/components/ContextMenu';
import { TitleContextMenu } from '@/components/TitleContextMenu';
import { URLFilterManager } from '@/lib/url-filter-manager';
import { MessageItem } from '@/components/MessageList/MessageItem';
import { EmptyState } from '@/components/MessageList/EmptyState';
import { ColorPickerDropdown } from '@/components/ColorPicker/ColorPickerDropdown';
// Import cloud API functions
import { fetchCommentsFromCloud, postCommentToCloud, isCloudAPIEnabled } from '@/modules/cloudApiClient';
// Import timestamp system
import { formatTimestamp } from '@/modules/timestampSystem';
// Import keyboard shortcuts
import { useCommonShortcuts, useKeyboardShortcuts } from '@/modules/keyboardShortcuts';
// Import number formatter
import { formatNumber } from '@/utils/formatNumber';
// Import polling system
import { useCommentsPolling, useAutoScrollDetection } from '@/modules/pollingSystem';
// Import video sharing system
import { useVideoSharing } from '@/modules/videoSharingSystem';
// Import comment submission system
import { useCommentSubmission, useUsernameValidation } from '@/modules/commentSubmission';
// Import model URL integration
import { useCommentsWithModels } from '@/hooks/useCommentsWithModels';
// Import message counts hook
import { useMessageCounts } from '@/hooks/useMessageCounts';
// Import color picker hook
import { useColorPicker } from '@/hooks/useColorPicker';
// Import message type filters hook
import { useMessageTypeFilters } from '@/hooks/useMessageTypeFilters';
// Import scroll restoration hook
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
// Import context menus hook
import { useContextMenus } from '@/hooks/useContextMenus';
// Import mobile keyboard hook
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard';

interface CommentsStreamProps {
  showVideo?: boolean;
  toggleVideo?: () => void;
}

const CommentsStream: React.FC<CommentsStreamProps> = ({ showVideo = false, toggleVideo }) => {
  // Constants
  const COMMENTS_STORAGE_KEY = 'sww-comments-local';
  
  // Domain configuration
  const [domainConfig] = useState(() => getCurrentDomainConfig());
  const [domainFilterEnabled, setDomainFilterEnabled] = useState(() => isDomainFilterEnabled());
  const currentDomain = getCurrentDomain();
  
  // State management - initial messages from IndexedDB
  const [initialMessages, setInitialMessages] = useState<Comment[]>([]);
  const [displayedComments, setDisplayedComments] = useState<Comment[]>([]);
  const [inputText, setInputText] = useState('');
  const [username, setUsername] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasNewComments, setHasNewComments] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [hasClickedUsername, setHasClickedUsername] = useState(false);
  const [mounted, setMounted] = useState(false); // For hydration safety
  
  // Color picker management (extracted to hook)
  const {
    userColor,
    userColorRgb,
    showColorPicker,
    randomizedColors,
    toggleColorPicker,
    selectColor,
    setUserColor
  } = useColorPicker(getRandomColor());
  
  // IndexedDB lazy loading state
  const [indexedDbOffset, setIndexedDbOffset] = useState(0);
  const [hasMoreInIndexedDb, setHasMoreInIndexedDb] = useState(false);
  const [isLoadingMoreFromIndexedDb, setIsLoadingMoreFromIndexedDb] = useState(false);
  const allIndexedDbMessages = useRef<Comment[]>([]);
  
  // Dynamic message limit (expands with lazy loading)
  const [dynamicMaxMessages, setDynamicMaxMessages] = useState(MAX_DISPLAY_MESSAGES);
  const [lazyLoadedCount, setLazyLoadedCount] = useState(0);
  
  // Scroll restoration now handled by useScrollRestoration hook

  // Message counts (global KV + local IndexedDB)
  const { globalCount: messageCount, localCount } = useMessageCounts();

  // Refs
  const streamRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const lastFetchTimeRef = useRef<number>(0); // Initialize to 0, set after mount
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const pageLoadTimestamp = useRef<number>(0); // Initialize to 0, set after mount
  
  // Message type filtering (Humans/Entities) - extracted to hook
  const {
    showHumans,
    showEntities,
    toggleShowHumans,
    toggleShowEntities,
    savedHumansScrollPosition,
    savedEntitiesScrollPosition,
    setSavedHumansScrollPosition,
    setSavedEntitiesScrollPosition,
  } = useMessageTypeFilters(streamRef);
  
  // Auto-scroll detection using the new modular system
  const { isNearBottom, scrollToBottom: smoothScrollToBottom } = useAutoScrollDetection(streamRef, 100);
  
  // Clear "New Messages" indicator when user scrolls to bottom
  useEffect(() => {
    if (isNearBottom && hasNewComments) {
      console.log('[New Messages] Clearing indicator - user scrolled to bottom');
      setHasNewComments(false);
    }
  }, [isNearBottom, hasNewComments]);
  
  // Debug log for hasNewComments state
  useEffect(() => {
    console.log('[New Messages] hasNewComments state:', hasNewComments);
  }, [hasNewComments]);
  
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
  
  // Storage functions DISABLED - We only use IndexedDB for messages now
  const loadCommentsFromStorage = useCallback((): Comment[] => {
    // DISABLED: No localStorage for messages - only IndexedDB
    return [];
  }, [COMMENTS_STORAGE_KEY]);

  const saveCommentsToStorage = useCallback((comments: Comment[]) => {
    // DISABLED: No localStorage for messages - only IndexedDB
    // localStorage should only store settings, not message data
    return;
  }, [COMMENTS_STORAGE_KEY]);
  
  // Username validation
  const { isFlashing: usernameFlash, flashUsername } = useUsernameValidation(username);
  
  // Use the filters hook with initial messages
  const {
    filterUsernames,
    filterWords,
    negativeFilterWords,
    isFilterEnabled,
    filteredComments: userFilteredComments, // Rename to be clear this is user/word filtered
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
  } = useFilters({ 
    displayedComments: initialMessages, 
    searchTerm
  });
  
  // Use IndexedDB filtering hook for efficient querying
  const {
    messages: allComments,
    isLoading: isFilterQueryLoading,
    isFilterMode,
    matchesCurrentFilter,
    addMessages: addFilteredMessages,
    setMessages: setAllComments
  } = useIndexedDBFiltering({
    isFilterEnabled,
    filterUsernames,
    filterWords,
    negativeFilterWords,
    searchTerm,
    dateTimeFilter,
    domainFilterEnabled,
    currentDomain,
    showHumans,
    showEntities,
    maxDisplayMessages: MAX_DISPLAY_MESSAGES,
    initialMessages
  });
  
  // Model URL Integration - handles model messages and user state from URL
  const {
    currentDomain: modelDomain,
    isProcessingQueue,
    addModelResponse,
    getFilteredMessagesForModel,
    handleModelResponseComplete,
    aiUsername,
    aiColor
  } = useCommentsWithModels({ 
    comments: allComments, 
    setComments: setAllComments
  });
  
  // Add AI to filter bar when AI username is set from URL
  useEffect(() => {
    if (aiUsername && aiColor && addToFilter) {
      addToFilter(aiUsername, aiColor);
    }
  }, [aiUsername, aiColor, addToFilter]);
  
  // Comment Submission System (moved here so modelDomain is available)
  const {
    isSubmitting,
    error,
    handleSubmit: submitComment,
    setError,
  } = useCommentSubmission(
    {
      maxLength: MAX_COMMENT_LENGTH,
      domain: modelDomain || currentDomain,
      storageKey: COMMENTS_STORAGE_KEY,
    },
    {
      onOptimisticUpdate: async (comment) => {
        // Save to IndexedDB (PRESENCE-BASED: Store your own messages)
        try {
          if (simpleIndexedDB.isInit()) {
            // Store Comment exactly as-is - no transformation needed!
            await simpleIndexedDB.saveMessage(comment);
            console.log('[SimpleIndexedDB] Saved user message to storage');
          }
        } catch (err) {
          console.warn('[SimpleIndexedDB] Failed to save user message:', err);
        }
        
        // Add to display using filtering hook
        // Hook handles filter testing and trimming
        addFilteredMessages([comment]);
      },
      onOptimisticRemove: (commentId) => {
        setAllComments(prev => prev.filter(c => c.id !== commentId));
      },
      onInputClear: () => setInputText(''),
      onScrollToBottom: () => {
        // When user submits a comment, always scroll to bottom
        smoothScrollToBottom(false);
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
  
  // USE INDEXEDDB FILTERING RESULTS - NOT LEGACY FILTERS
  const filteredComments = useMemo(() => {
    // allComments comes from useIndexedDBFiltering which queries the full DB
    // userFilteredComments is from legacy useFilters which only operates on initialMessages (3 messages)
    // WE WANT THE DB RESULTS, NOT THE LEGACY FILTER RESULTS!
    return allComments;
  }, [allComments]);
  
  // Context menus (extracted to hook)
  const {
    contextMenu,
    titleContextMenu,
    setContextMenu,
    setTitleContextMenu,
    handleContextMenu,
    handleTouchStart,
    handleTouchEnd,
    handleCopy,
    handleSave,
    handleBlock,
    handleTitleContextMenu,
    handleCopyAll,
    handleSaveAll,
  } = useContextMenus({
    addNegativeWordFilter,
    filteredComments,
    domainConfigTitle: domainConfig.title,
  });
  
  // Scroll restoration for filters and search (extracted to hook)
  useScrollRestoration({
    streamRef,
    isFilterEnabled,
    searchTerm,
    savedHumansScrollPosition,
    savedEntitiesScrollPosition,
    setSavedHumansScrollPosition,
    setSavedEntitiesScrollPosition,
    showHumans,
    showEntities,
    filteredCommentsLength: filteredComments.length,
  });
  
  // Mobile keyboard handling (extracted to hook)
  useMobileKeyboard({
    streamRef,
    isNearBottom,
    smoothScrollToBottom,
  });
  
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
    
    // Set timestamps after mount to avoid hydration mismatch
    pageLoadTimestamp.current = Date.now();
    lastFetchTimeRef.current = Date.now();
    
    const savedUsername = localStorage.getItem('sww-username');
    const savedColor = localStorage.getItem('sww-color');
    if (savedUsername) {
      setUsername(savedUsername);
      setHasClickedUsername(true); // If there's a saved username, treat it as if they've clicked
    }
    
    if (savedColor) {
      // Convert to 9-digit format if needed (for backwards compatibility)
      const manager = URLFilterManager.getInstance();
      let colorDigits = savedColor;
      
      if (savedColor.startsWith('#') || savedColor.startsWith('rgb')) {
        // Convert old format to 9-digit
        colorDigits = manager.rgbToNineDigit(savedColor);
        localStorage.setItem('sww-color', colorDigits); // Update to new format
      }
      
      // Store internally as 9-digit
      setUserColor(colorDigits);
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
              
              // Apply max display limit
              const trimmedComments = trimToMaxMessages(mergedComments);
              // Update initial messages - hook will re-filter if needed
              setInitialMessages(trimmedComments);
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
  const shortcuts = useCommonShortcuts({
    onColorChange: (color) => {
      if (color === 'random') {
        const randomColor = getRandomColor();
          setUserColor(randomColor);
          localStorage.setItem('sww-color', randomColor);
        window.dispatchEvent(new Event('colorChanged'));
      }
    },
    onFocusInput: () => {
      inputRef.current?.focus();
    },
    inputRef
  });
  
  // Actually HOOK UP the shortcuts!
  useKeyboardShortcuts(shortcuts);

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
  // Storage functions are now defined earlier (before submission system)

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
      
      // Reset dynamic limits on initial load/refresh
      setDynamicMaxMessages(MAX_DISPLAY_MESSAGES);
      setLazyLoadedCount(0);
      console.log('[Init] Starting initial load...');
      console.log('[Init] Cloud API enabled:', isCloudAPIEnabled());
      console.log('[Init] API URL:', COMMENTS_CONFIG.apiUrl);
      console.log('[Init] Page load timestamp:', new Date(pageLoadTimestamp.current).toLocaleTimeString());
      console.log('[Init] Reset message limit to default:', MAX_DISPLAY_MESSAGES);
      
      try {
        // REMOVED: Static JSON loading - we don't want any pre-populated messages
        // Messages should only come from real-time sources (KV or new posts)
        
        // PRESENCE-BASED: Load from IndexedDB - this is your history  
        // You only see what you've collected while present
        let indexedDbMessages: Comment[] = [];
        
        // Initialize IndexedDB and load existing messages
        try {
          await simpleIndexedDB.init();
          
          if (simpleIndexedDB.isInit()) {
            // Load messages from IndexedDB (PRESENCE-BASED)
            // SimpleIndexedDB returns Comments exactly as stored - no transformation needed!
            indexedDbMessages = await simpleIndexedDB.getMessages(INDEXEDDB_INITIAL_LOAD, 0);
            
            console.log(`[SimpleIndexedDB] Loaded ${indexedDbMessages.length} messages from storage`);
            
            // Check if there are more messages available
            const totalCount = await simpleIndexedDB.getMessageCount();
            setHasMoreInIndexedDb(totalCount > INDEXEDDB_INITIAL_LOAD);
            console.log(`[SimpleIndexedDB] Total messages in storage: ${totalCount}, has more: ${totalCount > INDEXEDDB_INITIAL_LOAD}`);
            }
          } catch (err) {
          console.warn('[SimpleIndexedDB] Error loading messages:', err);
        }
        
        allIndexedDbMessages.current = indexedDbMessages;
        
        // Fetch latest from cloud API (PRESENCE-BASED: Should be 0 messages)
        const data = await fetchComments(0, INITIAL_LOAD_COUNT);
        const cloudMessages = data.comments;
        
        // Save any cloud messages to IndexedDB (should be 0 with INITIAL_LOAD_COUNT=0)
        if (cloudMessages.length > 0) {
          try {
            if (simpleIndexedDB.isInit()) {
              // Cloud messages are already Comments - no transformation needed!
              await simpleIndexedDB.saveMessages(cloudMessages);
              console.log(`[SimpleIndexedDB] Saved ${cloudMessages.length} initial cloud messages to storage`);
          }
      } catch (err) {
            console.warn('[SimpleIndexedDB] Failed to save initial cloud messages:', err);
          }
        }
        
        // Merge messages: IndexedDB messages + new cloud messages (avoid duplicates)
        const messageMap = new Map<string, Comment>();
        
        // Add IndexedDB messages first
        indexedDbMessages.forEach(msg => {
          messageMap.set(msg.id, msg);
        });
        
        // Add cloud messages (will update any existing ones)
        cloudMessages.forEach(msg => {
          messageMap.set(msg.id, msg);
        });
        
        // Convert back to array and sort by timestamp
        const mergedMessages = Array.from(messageMap.values())
          .sort((a, b) => a.timestamp - b.timestamp);
        
        console.log(`[Comments] Merged ${indexedDbMessages.length} IndexedDB + ${cloudMessages.length} cloud = ${mergedMessages.length} total messages`);
        
        // Trim to max display limit (keep newest)
        const trimmedMessages = trimToMaxMessages(mergedMessages);
        
        // Set initial messages - the hook will handle filtering if needed
        setInitialMessages(trimmedMessages);
        
        // Initial scroll is handled by the useEffect
      } catch (err) {
        console.error('[Comments] Failed to load comments:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialComments();
  }, [fetchComments]);

  // Track if we've done initial scroll
  const hasScrolledRef = useRef(false);
  
  // Helper to trim messages to dynamic display limit
  const trimToMaxMessages = useCallback((messages: Comment[]): Comment[] => {
    if (messages.length <= dynamicMaxMessages) {
      return messages;
    }
    
    // Always keep the newest messages up to the dynamic limit
    const trimmed = messages.slice(-dynamicMaxMessages);
    console.log(`[Trim] Kept newest ${dynamicMaxMessages} messages (dynamic limit), removed ${messages.length - dynamicMaxMessages} older ones`);
    
    // When we trim from the beginning, there might be more messages available to lazy load
    if (messages.length > dynamicMaxMessages && allIndexedDbMessages.current.length > messages.length) {
      setHasMoreInIndexedDb(true);
    }
    
    return trimmed;
  }, [dynamicMaxMessages]);
  
  // Load more messages from IndexedDB (for lazy loading)
  const loadMoreFromIndexedDb = useCallback(() => {
    if (!hasMoreInIndexedDb || isLoadingMoreFromIndexedDb) return;
    
    setIsLoadingMoreFromIndexedDb(true);
    
    // Calculate how many messages to load
    const newOffset = Math.max(0, indexedDbOffset - INDEXEDDB_LAZY_LOAD_CHUNK);
    const loadCount = indexedDbOffset - newOffset;
    
    if (loadCount > 0 && allIndexedDbMessages.current.length > 0) {
      // Get the older messages
      const olderMessages = allIndexedDbMessages.current.slice(newOffset, indexedDbOffset);
      
      // Update the dynamic max to accommodate new messages + headroom
      const newLazyLoadedCount = lazyLoadedCount + loadCount;
      const newDynamicMax = MAX_DISPLAY_MESSAGES + newLazyLoadedCount + 50; // +50 headroom
      setLazyLoadedCount(newLazyLoadedCount);
      setDynamicMaxMessages(newDynamicMax);
      
      console.log(`[Lazy Load] Expanding message limit: ${MAX_DISPLAY_MESSAGES} → ${newDynamicMax} (loaded ${newLazyLoadedCount} extra messages)`);
      
      // Prepend to existing messages (actually ADD them, don't trim!)
      setAllComments(prev => {
        // Create a Map to avoid duplicates
        const messageMap = new Map<string, Comment>();
        
        // Add older messages first
        olderMessages.forEach(msg => messageMap.set(msg.id, msg));
        
        // Add existing messages
        prev.forEach(msg => messageMap.set(msg.id, msg));
        
        // Convert back to array and sort
        const merged = Array.from(messageMap.values())
          .sort((a, b) => a.timestamp - b.timestamp);
        
        console.log(`[IndexedDB] Added ${loadCount} older messages (${newOffset} remaining in storage)`);
        return merged; // Don't trim! Let them all show
      });
      
      setIndexedDbOffset(newOffset);
      setHasMoreInIndexedDb(newOffset > 0);
    }
    
    setIsLoadingMoreFromIndexedDb(false);
  }, [hasMoreInIndexedDb, isLoadingMoreFromIndexedDb, indexedDbOffset, lazyLoadedCount]);
  
  // Scroll to bottom ONLY on initial page load when comments first arrive
  useEffect(() => {
    // Only scroll once when comments first arrive AND we haven't scrolled yet
    // AND filters are not active (to avoid interfering with filter toggling)
    if (allComments.length > 0 && !hasScrolledRef.current && !isFilterEnabled) {
      hasScrolledRef.current = true;
      
      // Initial scroll to bottom (only happens once per page load)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (streamRef.current) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
            console.log('[Scroll] Initial scroll to bottom completed');
          }
        });
      });
    }
  }, [allComments.length, isFilterEnabled]); // Check filter state to avoid conflicts

  // Don't auto-scroll when video area toggles - let user stay where they are
  
  // Don't auto-scroll on resize - let user stay where they are

  // Check for new comments using cursor-based polling (ultra efficient!)
  // Check if new comments match filters and trigger notifications
  const checkNotificationMatches = useCallback((newComments: Comment[]) => {
    const notificationSystem = getNotificationSystem();
    const soundsToPlay: NotificationSound[] = [];
    const filtersToMark: string[] = [];
    
    // Check each new comment
    newComments.forEach(comment => {
      // Check username filters (username+color combo)
      filterUsernames.forEach(filter => {
        // Match both username AND color (username+color = unique identity)
        if (comment.username === filter.username && comment.color === filter.color) {
          const filterKey = getFilterKey(filter.username, filter.color);
          const setting = getFilterNotificationSetting(filterKey);
          
          if (setting.sound !== 'none' && !filtersToMark.includes(filterKey)) {
            soundsToPlay.push(setting.sound);
            filtersToMark.push(filterKey);
          }
        }
      });
      
      // Check word filters
      filterWords.forEach(word => {
        if (comment.text && comment.text.toLowerCase().includes(word.toLowerCase())) {
          // Words don't have colors - just use the word as the key
          const filterKey = getFilterKey(word, '');
          const setting = getFilterNotificationSetting(filterKey);
          
          if (setting.sound !== 'none' && !filtersToMark.includes(filterKey)) {
            soundsToPlay.push(setting.sound);
            filtersToMark.push(filterKey);
          }
        }
      });
    });
    
    // Play sounds in order with cooldown
    if (soundsToPlay.length > 0) {
      notificationSystem.playSoundsInOrder(soundsToPlay);
    }
    
    // Mark filters as unread (make them bold)
    filtersToMark.forEach(filterKey => {
      markFilterAsUnread(filterKey);
    });
    
    // Force re-render of FilterBar to show bold state
    if (filtersToMark.length > 0) {
      // Trigger a re-render by updating a dummy state or dispatching an event
      window.dispatchEvent(new CustomEvent('filterNotificationUpdate'));
    }
  }, [filterUsernames, filterWords, userColor]);

  // Check for new comments - presence-based (only messages since page load)
  const checkForNewComments = useCallback(async () => {
      try {
      let newComments: Comment[] = [];
        
      if (isCloudAPIEnabled()) {
        // PRESENCE-BASED: Get all messages created since we loaded the page
        // This ensures we see everything that happens while we're present
        const pollUrl = `${COMMENTS_CONFIG.apiUrl}?after=${pageLoadTimestamp.current}&limit=${POLL_BATCH_LIMIT}`;
        console.log(`[Presence Polling] Polling for messages after ${new Date(pageLoadTimestamp.current).toLocaleTimeString()}`);
        console.log(`[Presence Polling] URL: ${pollUrl}`);
        
        const response = await fetch(pollUrl);
        
        if (!response.ok) {
          console.error(`[Presence Polling] HTTP error: ${response.status}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        newComments = await response.json();
        console.log(`[Presence Polling] Response: ${newComments.length} messages`);
        
        if (newComments.length > 0) {
          console.log(`[Presence Polling] Found ${newComments.length} new messages since page load at ${new Date(pageLoadTimestamp.current).toLocaleTimeString()}`);
          
          // Save new messages to IndexedDB (PRESENCE-BASED: Store your history)
          try {
            if (simpleIndexedDB.isInit()) {
              // New comments are already Comments - no transformation needed!
              await simpleIndexedDB.saveMessages(newComments);
              console.log(`[SimpleIndexedDB] Saved ${newComments.length} new messages to storage`);
              if (newComments.length > 0) {
                console.log('[SimpleIndexedDB] First message saved:', newComments[0]);
              }
            }
          } catch (err) {
            console.warn('[SimpleIndexedDB] Failed to save polled messages:', err);
          }
          
          // Add new messages using the filtering hook
          // Hook handles deduplication, filtering, and trimming
          addFilteredMessages(newComments);
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
          addFilteredMessages(newComments);
        }
      }
      
      if (newComments.length > 0) {
        // Check for notification matches if filters are active
        if (isFilterEnabled && (filterUsernames.length > 0 || filterWords.length > 0)) {
          checkNotificationMatches(newComments);
        }
        
        // Smart auto-scroll using the new system
        // Only auto-scroll if user is near bottom AND filters are NOT active
        // When filters are active, never auto-scroll - let user control their position
        if (isNearBottom && !isFilterEnabled) {
          console.log('[Polling] User near bottom (unfiltered view), auto-scrolling');
          setTimeout(() => smoothScrollToBottom(), 50);
          } else {
          console.log('[Polling] User scrolled up or filters active, showing New Messages indicator');
            setHasNewComments(true);
          }
        }
        
        lastFetchTimeRef.current = Date.now();
      } catch (err) {
        console.error('[Comments] Polling error:', err);
      }
  }, [loadCommentsFromStorage, isNearBottom, smoothScrollToBottom, trimToMaxMessages, 
      isFilterEnabled, filterUsernames, filterWords, checkNotificationMatches, isFilterMode, matchesCurrentFilter]);
  
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
  // Color picker functions now handled by useColorPicker hook
  // Message type filter toggles now handled by useMessageTypeFilters hook
  // Context menu handlers now handled by useContextMenus hook
  // Mobile keyboard handling now handled by useMobileKeyboard hook

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden relative">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="p-3 space-y-2">
          {/* Title and Domain Filter */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 
                onClick={() => {
                  const newState = toggleDomainFilter();
                  setDomainFilterEnabled(newState);
                }}
                onContextMenu={handleTitleContextMenu}
                className="sww-title transition-opacity cursor-pointer select-none" 
                title={domainFilterEnabled ? "Show messages across all domains | Right click more options" : "Show messages from this domain only | Right click more options"}
                style={{ 
                  color: userColorRgb,
                  opacity: domainFilterEnabled ? 0.4 : 0.25, // Simple opacity change
                  textShadow: 'none' // Explicitly remove any text shadow
                }}
              >
                {modelDomain || domainConfig.title}
              </h2>
              {mounted && (
                <DomainFilter
                  isEnabled={domainFilterEnabled}
                  domain={currentDomain}
                  color={userColorRgb}
                  onClick={() => {
                    const newState = toggleDomainFilter();
                    setDomainFilterEnabled(newState);
                  }}
                />
              )}
            </div>
            
            {/* Message Type Filters - Between LED and Counter */}
            <div className="flex gap-1.5">
              {/* Humans Button */}
              <button
                onClick={toggleShowHumans}
                className={`px-2.5 py-1.5 rounded-full transition-all ${
                  showHumans ? 'bg-black/40' : 'hover:bg-black/20'
                }`}
                title={showHumans ? "Hide human messages" : "Show human messages"}
              >
                <Users 
                  className="w-3.5 h-3.5"
                  style={{ 
                    color: getDarkerColor(userColorRgb, showHumans 
                      ? OPACITY_LEVELS.LIGHT  // Active: 60% opacity
                      : OPACITY_LEVELS.DARK   // Inactive: 40% opacity
                    )
                  }}
                />
              </button>
              
              {/* Entities Button */}
              <button
                onClick={toggleShowEntities}
                className={`px-2.5 py-1.5 rounded-full transition-all ${
                  showEntities ? 'bg-black/40' : 'hover:bg-black/20'
                }`}
                title={showEntities ? "Hide entity messages" : "Show entity messages"}
              >
                <Sparkles 
                  className="w-3.5 h-3.5"
                  style={{ 
                    color: getDarkerColor(userColorRgb, showEntities 
                      ? OPACITY_LEVELS.LIGHT  // Active: 60% opacity
                      : OPACITY_LEVELS.DARK   // Inactive: 40% opacity
                    )
                  }}
                />
              </button>
            </div>
            
            {/* Username Input and TV Toggle - Always Visible */}
            <div className="flex items-center gap-2">
              {/* Messages window count */}
              {displayedComments.length > 0 && (
                <span 
                  className="text-xs mr-2 opacity-60" 
                  style={{ color: userColorRgb }}
                  title="Messages in current window"
                >
                  {formatNumber(displayedComments.length)}
                </span>
              )}
              
              {/* Global message counter - small and subtle, inheriting user color */}
              {messageCount > 0 && (
                <span 
                  className="text-xs mr-2 opacity-60" 
                  style={{ color: userColorRgb }}
                  title="Total global messages"
                >
                  {formatNumber(messageCount)}
                </span>
              )}
              <div className="relative flex items-center gap-2" style={{ width: 'calc(15ch + 65px)' }} ref={colorPickerRef}>
              <button
                onClick={toggleColorPicker}
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
                onSelectColor={selectColor}
                isVisible={showColorPicker}
              />
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
                userColor={userColorRgb}
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
                  <StyledClearIcon userColor={userColorRgb} />
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
                    ? getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT)  // 60% opacity when active
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
            userColor={userColorRgb}
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
            <StyledSearchIcon 
              userColor={userColorRgb} 
              opacity={searchTerm ? OPACITY_LEVELS.FULL : OPACITY_LEVELS.LIGHT} 
            />
              <StyledSearchInput 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              userColor={userColorRgb}
              placeholder="Search..."
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:opacity-80 rounded transition-colors"
                aria-label="Clear search"
                tabIndex={-1}
              >
                <StyledClearIcon userColor={userColorRgb} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comments Stream */}
      <div 
        ref={streamRef}
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 space-y-1 min-h-0"
        style={{
          ['--scrollbar-color' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK), // 40% opacity
          ['--scrollbar-bg' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST * 0.5), // 5% opacity
        } as React.CSSProperties}
        onScroll={(e) => {
          const element = e.currentTarget;
          // Check if scrolled near the top for lazy loading
          if (element.scrollTop < 100 && hasMoreInIndexedDb && !isLoadingMoreFromIndexedDb) {
            loadMoreFromIndexedDb();
          }
        }}
      >
        {/* Load More indicator at the top */}
        {hasMoreInIndexedDb && (
          <div className="flex justify-center py-2 mb-2">
            {isLoadingMoreFromIndexedDb ? (
              <div className="text-gray-500 text-sm">Loading more messages...</div>
            ) : (
              <button
                onClick={loadMoreFromIndexedDb}
                className="px-4 py-1 text-sm rounded-lg transition-all duration-200 hover:scale-105"
                style={{
                  backgroundColor: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST),
                  color: userColorRgb,
                  border: `1px solid ${getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK)}`
                }}
              >
                Load {Math.min(INDEXEDDB_LAZY_LOAD_CHUNK, indexedDbOffset)} more messages
              </button>
            )}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        ) : filteredComments.length === 0 ? (
          <EmptyState
            searchTerm={searchTerm}
            isFilterEnabled={isFilterEnabled}
            userColor={userColorRgb}
            onToggleFilter={toggleFilter}
          />
        ) : (
          filteredComments.map((comment) => (
            <MessageItem
              key={comment.id} 
              comment={comment}
              onUsernameClick={addToFilter}
              onContextMenu={handleContextMenu}
              onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
              parseText={parseCommentTextWithHandlers}
              formatTimestamp={formatTimestamp}
              getCommentColor={getCommentColor}
            />
          ))
        )}
      </div>

      {/* New Comments Indicator */}

      {/* Input Form - Always visible on mobile */}
      <div className="mobile-input-form flex-shrink-0 border-t border-white/10 bg-black/90 backdrop-blur-sm p-3 sticky bottom-0 z-20 safe-area-inset-bottom w-full max-w-full overflow-hidden">
        {error && (
          <div className="mb-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="w-full">
          <div className="relative w-full max-w-full">
            {/* New Messages text indicator - positioned left of chevron, clickable */}
            {hasNewComments && (
              <button
                type="button"
                onClick={() => {
                  smoothScrollToBottom(false);
                  setHasNewComments(false);
                }}
                className="absolute top-2 text-xs z-20 font-medium pr-2 hover:opacity-80 cursor-pointer"
                style={{ 
                  color: userColorRgb,
                  right: '4rem', // Position further left of chevron for better spacing
                  background: 'none',
                  border: 'none',
                  padding: '0 12px 0 0' // Increased right padding for better spacing from chevron
                }}
                tabIndex={-1}
                aria-label="Jump to latest messages"
              >
                New Messages
              </button>
            )}
            
            {/* Scroll to bottom button - positioned left of character counter */}
            <button
              type="button"
              onClick={() => {
                smoothScrollToBottom(false);
                setHasNewComments(false);
              }}
              className="absolute top-2 right-12 p-0 rounded transition-all hover:opacity-80 cursor-pointer z-10"
              style={{ 
                color: getDarkerColor(userColorRgb, OPACITY_LEVELS.MEDIUM)
              }}
              tabIndex={-1}
              aria-label="Scroll to bottom"
              title="Jump to latest messages"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {/* Character counter - keeps its absolute positioning */}
            <StyledCharCounter 
              current={inputText.length}
              max={MAX_COMMENT_LENGTH}
              userColor={userColorRgb}
            />
            
            {/* Send button - vertically centered between char count and input bottom */}
            <button
              type="submit"
              disabled={isSubmitting || !inputText.trim()}
              className={`absolute bottom-2 right-2 p-1 rounded transition-all z-10 ${
                isSubmitting || !inputText.trim()
                  ? 'cursor-not-allowed'
                  : 'hover:opacity-80 cursor-pointer'
              }`}
              style={{ 
                color: userColorRgb, // Message text color
                opacity: (isSubmitting || !inputText.trim()) ? OPACITY_LEVELS.DARK : OPACITY_LEVELS.LIGHT // 40% when disabled, 60% when enabled - one level lighter
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
              onFocus={() => {
                // Prevent zoom on iPhone
                window.scrollTo(0, 0);
              }}
              placeholder="Say what you want..."
              className="w-full px-3 pt-6 pb-2 pr-10 bg-white/5 border border-white/10 rounded-lg resize-none focus:outline-none focus:border-white/30 min-h-[56px] max-h-[120px] text-sm md:text-sm custom-scrollbar touch-manipulation box-border"
              style={{
                ['--placeholder-color' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKER), // 30% opacity - one level lighter
                ['--scrollbar-color' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT), // 60% opacity
                ['--scrollbar-bg' as any]: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST), // 10% opacity
                color: userColorRgb, // Always use user's color
                backgroundColor: getDarkerColor(userColorRgb, OPACITY_LEVELS.DARKEST * 0.5), // 5% opacity - even darker than darkest
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
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          comment={contextMenu.comment}
          clickedWord={contextMenu.clickedWord}
          isUsername={contextMenu.isUsername}
          onClose={() => setContextMenu(null)}
          onCopy={handleCopy}
          onSave={handleSave}
          onBlock={handleBlock}
        />
      )}
      
      {/* Title Context Menu */}
      {titleContextMenu && (
        <TitleContextMenu
          x={titleContextMenu.x}
          y={titleContextMenu.y}
          onClose={() => setTitleContextMenu(null)}
          onCopyAll={handleCopyAll}
          onSaveAll={handleSaveAll}
        />
      )}
    </div>
  );
};

export default CommentsStream;
