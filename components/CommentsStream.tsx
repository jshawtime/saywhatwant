'use client';

// ==========================================
// REACT & EXTERNAL LIBRARIES
// ==========================================
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, ChevronDown, Tv, Ban, Users, Sparkles } from 'lucide-react';

// ==========================================
// TYPES
// ==========================================
import { Comment, CommentsResponse, BotParams } from '@/types';

// ==========================================
// CONFIGURATION
// ==========================================
import { COMMENTS_CONFIG, getCommentsConfig } from '@/config/comments-source';
import { getCurrentDomain, getCurrentDomainConfig, isDomainFilterEnabled, toggleDomainFilter } from '@/config/domain-config';
import { MESSAGE_SYSTEM_CONFIG } from '@/config/message-system';

// Configuration constants
const INITIAL_LOAD_COUNT = MESSAGE_SYSTEM_CONFIG.cloudInitialLoad; // ALWAYS 0 - presence-based
const POLLING_INTERVAL = MESSAGE_SYSTEM_CONFIG.cloudPollingInterval; // 5000ms
const MAX_COMMENT_LENGTH = 201;
const POLL_BATCH_LIMIT = MESSAGE_SYSTEM_CONFIG.cloudPollBatch;
const MAX_USERNAME_LENGTH = 16;
const MAX_DISPLAY_MESSAGES = MESSAGE_SYSTEM_CONFIG.maxDisplayMessages;
const INDEXEDDB_INITIAL_LOAD = MESSAGE_SYSTEM_CONFIG.maxDisplayMessages;
const INDEXEDDB_LAZY_LOAD_CHUNK = MESSAGE_SYSTEM_CONFIG.lazyLoadChunkSize;

// ==========================================
// COMPONENTS (Extracted in Phase 3)
// ==========================================
import { AppHeader } from '@/components/Header/AppHeader';
import { SearchBar } from '@/components/Search/SearchBar';
import { MessageStream } from '@/components/MessageStream/MessageStream';
import { MessageInput } from '@/components/MessageInput/MessageInput';
import { NotificationBanner } from '@/components/Notifications/NotificationBanner';
import { MessageItem } from '@/components/MessageList/MessageItem';
import { EmptyState } from '@/components/MessageList/EmptyState';
import { ContextMenu } from '@/components/ContextMenu';
import { TitleContextMenu } from '@/components/TitleContextMenu';
import { ColorPickerDropdown } from '@/components/ColorPicker/ColorPickerDropdown';
import FilterBar from '@/components/FilterBar';
import DomainFilter from '@/components/DomainFilter';
import { StyledSearchIcon, StyledClearIcon, StyledUserIcon, StyledSearchInput, StyledUsernameInput, StyledCharCounter, StyledFilterIcon } from '@/components/UIElements';

// ==========================================
// CUSTOM HOOKS (Feature-specific)
// ==========================================
import { useSimpleFilters } from '@/hooks/useSimpleFilters';
import { useIndexedDBFiltering } from '@/hooks/useIndexedDBFiltering';
// REMOVED: import { useCommentsWithModels } from '@/hooks/useCommentsWithModels';
import { useMessageCounts } from '@/hooks/useMessageCounts';
import { useColorPicker } from '@/hooks/useColorPicker';
import { useMessageTypeFilters } from '@/hooks/useMessageTypeFilters';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useContextMenus } from '@/hooks/useContextMenus';
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard';
import { useMessageLoadingState } from '@/hooks/useMessageLoadingState';
import { useUsernameEditor } from '@/hooks/useUsernameEditor';

// ==========================================
// MODULES (Business Logic)
// ==========================================
import { simpleIndexedDB, FilterCriteria } from '@/modules/simpleIndexedDB';
import { fetchCommentsFromCloud, postCommentToCloud, isCloudAPIEnabled } from '@/modules/cloudApiClient';
import { useCommentsPolling, useAutoScrollDetection } from '@/modules/pollingSystem';
import { useVideoSharing } from '@/modules/videoSharingSystem';
import { useCommentSubmission, useUsernameValidation } from '@/modules/commentSubmission';
import { useCommonShortcuts, useKeyboardShortcuts } from '@/modules/keyboardShortcuts';
import { getNotificationSystem, getFilterKey, getFilterNotificationSetting, markFilterAsUnread, NotificationSound } from '@/modules/notificationSystem';
import { getRandomColor, getDarkerColor, COLOR_PALETTE, nineDigitToRgb, getCommentColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { formatTimestamp } from '@/modules/timestampSystem';

// ==========================================
// UTILITIES
// ==========================================
import { parseCommentText } from '@/utils/textParsing';
import { formatNumber } from '@/utils/formatNumber';
// REMOVED: import { URLFilterManager } from '@/lib/url-filter-manager';
import { rgbToNineDigit } from '@/lib/url-filter-simple';  // NEW: Direct import
import { sortMessagesOldestFirst, mergeAndSortMessages } from '@/utils/messageUtils';

/**
 * CommentsStream Component Props
 */
interface CommentsStreamProps {
  /**
   * Whether video is currently shown
   */
  showVideo?: boolean;
  
  /**
   * Callback to toggle video visibility
   */
  toggleVideo?: () => void;
}

/**
 * CommentsStream Component
 * 
 * Main container component for the Say What Want messaging application.
 * Orchestrates all sub-components and hooks to provide a complete messaging experience.
 * 
 * **Architecture** (Post Phase 3 Refactor):
 * - **Container Component**: Manages state and data flow, minimal UI rendering
 * - **Presentation Components**: AppHeader, MessageStream, MessageInput (extracted)
 * - **Custom Hooks**: 11 feature-specific hooks for clean separation of concerns
 * 
 * **Responsibilities**:
 * 1. State Management: Domain config, initial messages, search term
 * 2. Hook Orchestration: Integrates 11+ custom hooks for features
 * 3. Data Loading: Initial IndexedDB load, cloud polling integration
 * 4. Event Handling: Submit, notification matching, domain toggle
 * 5. Component Composition: Assembles AppHeader, MessageStream, MessageInput, Context Menus
 * 
 * **Key Features**:
 * - Presence-based messaging (messages received while tab is open)
 * - Real-time polling every 5 seconds for new messages
 * - IndexedDB storage with lazy loading
 * - Username + color filtering
 * - Search across all messages
 * - Domain filtering
 * - Message type filtering (Humans vs AI Entities)
 * - Scroll restoration for filters/search
 * - Mobile keyboard optimization
 * - Video sharing integration
 * - Context menus for messages
 * - Sound notifications for filter matches
 * 
 * @example
 * <CommentsStream
 *   showVideo={false}
 *   toggleVideo={() => setShowVideo(!showVideo)}
 * />
 */
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
  const [searchTerm, setSearchTerm] = useState('');
  const [hasNewComments, setHasNewComments] = useState(false);
  const [mounted, setMounted] = useState(false); // For hydration safety
  
  // Username editing (consolidated into hook)
  const {
    username,
    isEditing: isEditingUsername,
    hasInteracted: hasClickedUsername,
    setUsername,
    startEditing: startEditingUsername,
    stopEditing: stopEditingUsername,
    clearUsername,
    markAsInteracted: markUsernameAsInteracted
  } = useUsernameEditor(MAX_USERNAME_LENGTH);
  
  // Color picker management (extracted to hook)
  const {
    userColor,
    userColorRgb,
    showColorPicker,
    randomizedColors,
    toggleColorPicker,
    selectColor,
    setUserColor,
    setShowColorPicker
  } = useColorPicker(getRandomColor());
  
  // Consolidated loading state (replaces 6 separate useState calls)
  const {
    isInitialLoading: isLoading,
    isLoadingMore: isLoadingMoreFromIndexedDb,
    hasMore: hasMoreInIndexedDb,
    offset: indexedDbOffset,
    maxMessages: dynamicMaxMessages,
    loadedCount: lazyLoadedCount,
    setInitialLoading: setIsLoading,
    startLoadingMore,
    finishLoadingMore,
    setHasMore: setHasMoreInIndexedDb,
    setOffset: setIndexedDbOffset,
    increaseMaxMessages,
  } = useMessageLoadingState(MAX_DISPLAY_MESSAGES, INDEXEDDB_LAZY_LOAD_CHUNK);
  
  const allIndexedDbMessages = useRef<Comment[]>([]);
  
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
  
  // Message type scroll restoration (still needed for Humans/Entities toggle)
  // NOTE: This hook will be deprecated once we fully remove the old toggle system
  const {
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
  
  // Use the NEW simple filters hook (with filteractive support!)
  const {
    mergedUserFilters,  // RGB colors for FilterBar display
    mergedFilterWords: filterWords,
    mergedNegativeWords: negativeFilterWords,
    isFilterEnabled,
    filteredComments: userFilteredComments,
    addToFilter,
    removeFromFilter,
    addWordToFilter,
    removeWordFromFilter,
    addNegativeWordFilter,
    removeNegativeWordFilter,
    toggleFilter,
    hasFilters: hasActiveFilters,
    filterState,  // Get the full state
    messageType,  // ✅ Get real value from URL
    setMessageType,  // ✅ Get real function
    uis,  // NEW: User initial state from URL
    ais,  // NEW: AI initial state from URL (for bot identity override)
    entity: urlEntity,  // NEW: Bot entity from URL
    priority: urlPriority,  // NEW: Bot priority from URL
    model: urlModel,  // NEW: Bot model from URL
    nom: urlNom,  // NEW: Bot nom from URL
  } = useSimpleFilters({ 
    comments: initialMessages,
    filterByColorToo: true
  });
  
  // Derive filterUsernames from filterState (9-digit colors for IndexedDB)
  const filterUsernames = filterState.users;  // Already in 9-digit format
  
  // Stub implementations for features not yet in useSimpleFilters (kept for now)
  const urlSearchTerms: string[] = [];
  const addSearchTermToURL = () => {};
  const removeSearchTermFromURL = () => {};
  const serverSideUsers: any[] = [];
  const dateTimeFilter = null;
  const clearDateTimeFilter = () => {};
  
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
    activeChannel: messageType,  // NEW: Pass exclusive channel instead of 2 booleans
    maxDisplayMessages: MAX_DISPLAY_MESSAGES,
    initialMessages
  });
  
  // REMOVED: useCommentsWithModels (old URL system)
  // Model functionality stubbed - not currently used
  const modelDomain: string | null = null;
  const isProcessingQueue = false;
  const addModelResponse = () => {};
  const getFilteredMessagesForModel = () => [];
  const handleModelResponseComplete = () => {};
  const aiUsername: string | null = null;
  const aiColor: string | null = null;
  
  // NEW: Apply uis parameter from URL (user initial state)
  useEffect(() => {
    if (uis) {
      console.log('[CommentsStream] Applying uis from URL:', uis);
      
      // Format: username:color or username:random
      const [uisUsername, uisColor] = uis.split(':');
      
      if (uisUsername) {
        // Update username
        setUsername(uisUsername);
        localStorage.setItem('sww-username', uisUsername);
        console.log('[CommentsStream] Set username to:', uisUsername);
        
        // Update color if provided
        if (uisColor) {
          if (uisColor.toLowerCase() === 'random') {
            // Generate random color
            const randomColor = `${Math.floor(Math.random() * 256).toString().padStart(3, '0')}${Math.floor(Math.random() * 256).toString().padStart(3, '0')}${Math.floor(Math.random() * 256).toString().padStart(3, '0')}`;
            setUserColor(randomColor);
            localStorage.setItem('sww-color', randomColor);
            console.log('[CommentsStream] Set random color:', randomColor);
          } else {
            // Use provided color
            setUserColor(uisColor);
            localStorage.setItem('sww-color', uisColor);
            console.log('[CommentsStream] Set color to:', uisColor);
          }
        }
      }
    }
  }, [uis]);
  
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
    activeChannel: messageType,  // NEW: Use exclusive channel
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
    
    // Username is now loaded automatically by useUsernameEditor hook
    // If username was loaded from localStorage, mark as interacted
    if (username) {
      markUsernameAsInteracted();
    }
    
    const savedColor = localStorage.getItem('sww-color');
    if (savedColor) {
      // Convert to 9-digit format if needed (for backwards compatibility)
      // REPLACED: URLFilterManager with url-filter-simple (imported at top)
      let colorDigits = savedColor;
      
      if (savedColor.startsWith('#') || savedColor.startsWith('rgb')) {
        // Convert old format to 9-digit
        colorDigits = rgbToNineDigit(savedColor);
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
            
            // Merge and sort using global utility (ensures oldest→newest)
            const mergedComments = mergeAndSortMessages(allComments, newMessages);
              
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
      
      // Sort using global utility (ensures oldest→newest for chat display)
      sortMessagesOldestFirst(allStoredComments);
      
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
        
        // Convert back to array and sort using global utility
        const mergedMessages = sortMessagesOldestFirst(Array.from(messageMap.values()));
        
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
    
    startLoadingMore();
    
    // Calculate how many messages to load
    const newOffset = Math.max(0, indexedDbOffset - INDEXEDDB_LAZY_LOAD_CHUNK);
    const loadCount = indexedDbOffset - newOffset;
    
    if (loadCount > 0 && allIndexedDbMessages.current.length > 0) {
      // Get the older messages
      const olderMessages = allIndexedDbMessages.current.slice(newOffset, indexedDbOffset);
      
      // Prepend to existing messages (actually ADD them, don't trim!)
      setAllComments(prev => {
        // Create a Map to avoid duplicates
        const messageMap = new Map<string, Comment>();
        
        // Add older messages first
        olderMessages.forEach(msg => messageMap.set(msg.id, msg));
        
        // Add existing messages
        prev.forEach(msg => messageMap.set(msg.id, msg));
        
        // Convert back to array and sort using global utility
        const merged = sortMessagesOldestFirst(Array.from(messageMap.values()));
        
        console.log(`[IndexedDB] Added ${loadCount} older messages (${newOffset} remaining in storage)`);
        return merged; // Don't trim! Let them all show
      });
      
      // Update offset
      setIndexedDbOffset(newOffset);
      
      // Finish loading more (hook manages counts and limits)
      const stillHasMore = newOffset > 0;
      finishLoadingMore(loadCount, stillHasMore);
    } else {
      finishLoadingMore(0, false);
    }
  }, [hasMoreInIndexedDb, isLoadingMoreFromIndexedDb, indexedDbOffset, startLoadingMore, finishLoadingMore, setIndexedDbOffset]);
  
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
        // CHANNEL-EXCLUSIVE: Only poll for active channel (human OR AI)
        // If mt=ALL, don't send type parameter (get everything)
        const typeParam = messageType === 'ALL' ? '' : `&type=${messageType}`;
        const pollUrl = `${COMMENTS_CONFIG.apiUrl}?after=${pageLoadTimestamp.current}&limit=${POLL_BATCH_LIMIT}${typeParam}`;
        console.log(`[Presence Polling] Polling for ${messageType} messages after ${new Date(pageLoadTimestamp.current).toLocaleTimeString()}`);
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
        
        // Smart auto-scroll: If user is anchored to bottom, show them new messages
        // This works in ALL modes: filtered, unfiltered, search, etc.
        // The ONLY thing that matters: Is user at bottom?
        if (isNearBottom) {
          console.log('[Polling] User at bottom, auto-scrolling to show new messages');
          setTimeout(() => smoothScrollToBottom(), 50);
        } else {
          console.log('[Polling] User scrolled up, showing New Messages indicator');
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
    
    // Build pre-formatted context from displayed messages (only if nom= in URL)
    const contextArray = (() => {
      // If no nom in URL, return undefined - let bot use entity.nom
      if (!urlNom) return undefined;
      
      const messages = allComments.slice(-urlNom);
      return messages.length > 0 
        ? messages.map(m => `${m.username}: ${m.text}`)
        : undefined;
    })();
    
    // Pass ais parameter (AI identity override)
    const aiStateParam = ais || undefined;
    
    // Build bot parameters from URL (structured, type-safe)
    const botParams: BotParams | undefined = (() => {
      const params: BotParams = {};
      if (urlEntity) params.entity = urlEntity;
      if (urlPriority !== undefined) params.priority = urlPriority;
      if (urlModel) params.model = urlModel;
      if (aiStateParam) params.ais = aiStateParam;
      // Note: nom is used above to slice context, don't send to bot
      
      return Object.keys(params).length > 0 ? params : undefined;
    })();
    
    // Comprehensive logging
    if (contextArray) {
      console.log('[CommentsStream] Sending context:', contextArray.length, 'messages');
    }
    if (aiStateParam) {
      console.log('[CommentsStream] AI identity (ais):', aiStateParam);
    }
    if (botParams) {
      console.log('[CommentsStream] Bot parameters:', botParams);
    }
    
    await submitComment(inputText, username, userColor, flashUsername, contextArray, aiStateParam, botParams);
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
      <AppHeader
        title={domainConfig.title}
        domainFilterEnabled={domainFilterEnabled}
        currentDomain={currentDomain}
        mounted={mounted}
        modelDomain={modelDomain}
        userColor={userColor}
        userColorRgb={userColorRgb}
        activeChannel={messageType}
        onChannelChange={setMessageType}
        username={username}
        hasClickedUsername={hasClickedUsername}
                usernameFlash={usernameFlash}
        showColorPicker={showColorPicker}
        randomizedColors={randomizedColors}
        maxUsernameLength={MAX_USERNAME_LENGTH}
        usernameRef={usernameRef}
        colorPickerRef={colorPickerRef}
        onUsernameChange={setUsername}
        onUsernameFocus={markUsernameAsInteracted}
        onUsernameTab={() => inputRef.current?.focus()}
        onClearUsername={clearUsername}
        onToggleColorPicker={toggleColorPicker}
        onSelectColor={selectColor}
        showVideo={showVideo}
        onToggleVideo={toggleVideo}
        displayedCount={displayedComments.length}
        globalCount={messageCount}
        filterUsernames={mergedUserFilters}
            filterWords={filterWords}
            negativeFilterWords={negativeFilterWords}
            isFilterEnabled={isFilterEnabled}
            hasActiveFilters={hasActiveFilters}
            dateTimeFilter={dateTimeFilter}
            onToggleFilter={toggleFilter}
            onRemoveUsernameFilter={removeFromFilter}
            onRemoveWordFilter={removeWordFromFilter}
            onRemoveNegativeFilter={removeNegativeWordFilter}
            onClearDateTimeFilter={clearDateTimeFilter}
        searchTerm={searchTerm}
        onSearchChange={(value) => setSearchTerm(value)}
        onClearSearch={() => setSearchTerm('')}
        onTitleClick={() => {
          const newState = toggleDomainFilter();
          setDomainFilterEnabled(newState);
        }}
        onTitleContextMenu={handleTitleContextMenu}
      />

      {/* Comments Stream */}
      <MessageStream
        messages={filteredComments}
        isLoading={isLoading}
        hasMore={hasMoreInIndexedDb}
        isLoadingMore={isLoadingMoreFromIndexedDb}
        loadMoreCount={Math.min(INDEXEDDB_LAZY_LOAD_CHUNK, indexedDbOffset)}
            searchTerm={searchTerm}
            isFilterEnabled={isFilterEnabled}
        userColorRgb={userColorRgb}
              onUsernameClick={addToFilter}
              onContextMenu={handleContextMenu}
              onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
        onLoadMore={loadMoreFromIndexedDb}
        onToggleFilter={toggleFilter}
              parseText={parseCommentTextWithHandlers}
              formatTimestamp={formatTimestamp}
              getCommentColor={getCommentColor}
        streamRef={streamRef}
        lazyLoadThreshold={100}
            />

      {/* New Comments Indicator */}

      {/* Input Form - Always visible on mobile */}
      <div className="mobile-input-form flex-shrink-0 border-t border-white/10 bg-black/90 backdrop-blur-sm p-3 sticky bottom-0 z-20 safe-area-inset-bottom w-full max-w-full overflow-hidden">
        {/* Message Input Form */}
        <MessageInput
          inputText={inputText}
          userColor={userColor}
          userColorRgb={userColorRgb}
          isSubmitting={isSubmitting}
          error={error}
          pendingVideoKey={pendingVideoKey}
          showVideo={showVideo}
              maxLength={MAX_COMMENT_LENGTH}
          onInputChange={(text) => {
            setInputText(text);
            handleVideoInputChange(text);
          }}
          onSubmit={handleSubmit}
          onVideoLinkClick={() => handleVideoLinkClick(showVideo || false, toggleVideo)}
          getInputCursorStyle={getInputCursorStyle}
          scrollToBottom={smoothScrollToBottom}
          hasNewMessages={hasNewComments}
          clearNewMessages={() => setHasNewComments(false)}
          inputRef={inputRef}
          usernameRef={usernameRef}
        />
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
