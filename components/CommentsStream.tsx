'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, ChevronDown, Tv, Ban } from 'lucide-react';
import { StyledSearchIcon, StyledClearIcon, StyledUserIcon, StyledSearchInput, StyledUsernameInput, StyledCharCounter, StyledFilterIcon } from '@/components/UIElements';
import { Comment, CommentsResponse } from '@/types';
import { useFilters } from '@/hooks/useFilters';
import { useIndexedDBSync } from '@/hooks/useIndexedDBSync';
import { getStorage } from '@/modules/storage';
import { initializeIndexedDBSystem } from '@/modules/storage/init';
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
const MAX_DISPLAY_MESSAGES = 500; // Maximum messages to display at once
const INDEXEDDB_INITIAL_LOAD = 500; // Load 500 messages from IndexedDB initially
const INDEXEDDB_LAZY_LOAD_CHUNK = 100; // Load 100 more on each lazy load

// Import color functions from the color system
import { getRandomColor, getDarkerColor, COLOR_PALETTE } from '@/modules/colorSystem';
import { getCommentColor } from '@/modules/usernameColorGenerator';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { ContextMenu } from '@/components/ContextMenu';
import { TitleContextMenu } from '@/components/TitleContextMenu';
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
  
  // IndexedDB lazy loading state
  const [indexedDbOffset, setIndexedDbOffset] = useState(0);
  const [hasMoreInIndexedDb, setHasMoreInIndexedDb] = useState(false);
  const [isLoadingMoreFromIndexedDb, setIsLoadingMoreFromIndexedDb] = useState(false);
  const allIndexedDbMessages = useRef<Comment[]>([]);
  
  // Dynamic message limit (expands with lazy loading)
  const [dynamicMaxMessages, setDynamicMaxMessages] = useState(MAX_DISPLAY_MESSAGES);
  const [lazyLoadedCount, setLazyLoadedCount] = useState(0);
  
  // Scroll position memory for filters and search
  const [savedScrollPosition, setSavedScrollPosition] = useState<number | null>(null);
  const [savedSearchScrollPosition, setSavedSearchScrollPosition] = useState<number | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    comment: Comment;
    clickedWord?: string;
    isUsername?: boolean;
  } | null>(null);
  const [titleContextMenu, setTitleContextMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [messageCount, setMessageCount] = useState<number>(0);

  // Sync comments to IndexedDB (stores every message you see locally)
  useIndexedDBSync(allComments);
  
  // Fetch message count every 5 minutes
  useEffect(() => {
    const fetchMessageCount = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_COMMENTS_API_URL || 'https://sww-comments.bootloaders.workers.dev';
        const response = await fetch(`${baseUrl}/api/stats`);
        if (response.ok) {
          const data = await response.json();
          setMessageCount(data.totalMessages || 0);
        }
      } catch (error) {
        console.error('[MessageCounter] Failed to fetch count:', error);
      }
    };
    
    // Fetch immediately
    fetchMessageCount();
    
    // Then every 5 minutes
    const interval = setInterval(fetchMessageCount, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

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
  
  // Storage functions (needed before submission system)
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
    } catch (err) {
      console.error('[Comments] Failed to load from localStorage:', err);
    }
    return [];
  }, [COMMENTS_STORAGE_KEY]);

  const saveCommentsToStorage = useCallback((comments: Comment[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      // Keep only the last 1000 comments
      const toSave = comments.slice(-1000);
      localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.error('[Comments] Failed to save to localStorage:', err);
    }
  }, [COMMENTS_STORAGE_KEY]);
  
  // Username validation
  const { isFlashing: usernameFlash, flashUsername } = useUsernameValidation(username);
  
  // Comment submission system
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
        setAllComments(prev => {
          const combined = [...prev, comment];
          return trimToMaxMessages(combined);
        });
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
              
              // Apply max display limit
              const trimmedComments = trimToMaxMessages(mergedComments);
              setAllComments(trimmedComments);
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
      console.log('[Init] Reset message limit to default:', MAX_DISPLAY_MESSAGES);
      
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
              
              // Apply max display limit even for static JSON
              const trimmedComments = trimToMaxMessages(comments);
              setAllComments(trimmedComments);
              console.log(`[Dev Mode] Loaded ${trimmedComments.length} of ${comments.length} comments from static JSON`);
              
              // Initial scroll is handled by the useEffect
              
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.log('[Dev Mode] Static JSON not found, falling back to localStorage');
          }
        }
        
        // ENHANCED: Load from IndexedDB first (limited to INDEXEDDB_INITIAL_LOAD for performance)
        let indexedDbMessages: Comment[] = [];
        try {
          // Initialize IndexedDB if needed
          await initializeIndexedDBSystem();
          
          const storage = getStorage();
          if (storage.isInitialized()) {
            const allStoredMessages = await storage.getMessages({ store: 'all' });
            
            // Store all messages in ref for lazy loading
            allIndexedDbMessages.current = allStoredMessages.map((msg: any) => ({
              id: msg.id,
              text: msg.text,
              timestamp: new Date(msg.timestamp).getTime(),
              username: msg.username,
              userColor: msg.userColor || msg.color,
              videoRef: msg.videoRef,
              domain: msg.domain,
            }));
            
            // Sort by timestamp (oldest first)
            allIndexedDbMessages.current.sort((a, b) => a.timestamp - b.timestamp);
            
            // Take only the most recent INDEXEDDB_INITIAL_LOAD messages for initial display
            const totalStored = allIndexedDbMessages.current.length;
            if (totalStored > INDEXEDDB_INITIAL_LOAD) {
              indexedDbMessages = allIndexedDbMessages.current.slice(-INDEXEDDB_INITIAL_LOAD);
              setHasMoreInIndexedDb(true);
              setIndexedDbOffset(totalStored - INDEXEDDB_INITIAL_LOAD);
              console.log(`[IndexedDB] Loaded ${INDEXEDDB_INITIAL_LOAD} of ${totalStored} messages (more available)`);
            } else {
              indexedDbMessages = allIndexedDbMessages.current;
              setHasMoreInIndexedDb(false);
              console.log(`[IndexedDB] Loaded all ${totalStored} messages from local storage`);
            }
          }
        } catch (err) {
          console.warn('[IndexedDB] Failed to load stored messages:', err);
        }
        
        // Fetch latest from cloud API
        const data = await fetchComments(0, INITIAL_LOAD_COUNT);
        const cloudMessages = data.comments;
        
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
        
        setAllComments(trimmedMessages);
        
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
    if (allComments.length > 0 && !hasScrolledRef.current) {
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
  }, [allComments.length]); // Only re-run when number of comments changes from 0

  // Don't auto-scroll when video area toggles - let user stay where they are
  
  // Don't auto-scroll on resize - let user stay where they are

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
          
          // Append new messages but respect max display limit
          setAllComments(prev => {
            const combined = [...prev, ...newComments];
            // Trim to max limit (keep newest messages)
            return trimToMaxMessages(combined);
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
          setAllComments(prev => {
            const combined = [...prev, ...newComments];
            return trimToMaxMessages(combined); // Append but respect max limit
          });
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
  }, [allComments, loadCommentsFromStorage, isNearBottom, smoothScrollToBottom, trimToMaxMessages]);
  
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
    window.dispatchEvent(new Event('colorChanged'));
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
  
  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, comment: Comment, isUsername: boolean = false) => {
    e.preventDefault();
    e.stopPropagation();
    
    let clickedWord: string | undefined;
    
    if (!isUsername) {
      // Use selection API to get the word at click position
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const selectedText = selection.toString().trim();
        if (selectedText && selectedText.split(/\s+/).length === 1) {
          // Single word selected
          clickedWord = selectedText.replace(/[^a-zA-Z0-9]/g, '');
        }
      }
      
      // If no selection, try to extract from the whole text
      if (!clickedWord) {
        const target = e.target as HTMLElement;
        const text = target.textContent || '';
        // Simple approach: just get the first word if it's a short message
        const words = text.trim().split(/\s+/);
        if (words.length <= 5) {
          // For short messages, block the whole message makes sense
          clickedWord = undefined; // Will block username instead
        }
      }
    }
    
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY, 
      comment,
      clickedWord,
      isUsername 
    });
  }, []);
  
  const handleTouchStart = useCallback((e: React.TouchEvent, comment: Comment, isUsername: boolean = false) => {
    const touch = e.touches[0];
    
    // Clear any existing timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    // Set a new timer for long press (500ms)
    longPressTimer.current = setTimeout(() => {
      e.preventDefault();
      
      let clickedWord: string | undefined;
      
      if (!isUsername) {
        // For touch, we can't easily determine the exact word
        // So we'll just block the username unless text is selected
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const selectedText = selection.toString().trim();
          if (selectedText && selectedText.split(/\s+/).length === 1) {
            clickedWord = selectedText.replace(/[^a-zA-Z0-9]/g, '');
          }
        }
      }
      
      setContextMenu({ 
        x: touch.clientX, 
        y: touch.clientY, 
        comment,
        clickedWord,
        isUsername
      });
      // Haptic feedback for mobile if available
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }, 500);
  }, []);
  
  const handleTouchEnd = useCallback(() => {
    // Clear the timer if touch ends before long press
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);
  
  const handleCopy = useCallback(() => {
    if (!contextMenu) return;
    const { comment } = contextMenu;
    const timestamp = new Date(comment.timestamp).toLocaleString();
    const text = `${comment.username || 'anonymous'} (${timestamp}):\n${comment.text}`;
    
    // Modern clipboard API with fallback
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    
    console.log('[Context Menu] Copied message to clipboard');
  }, [contextMenu]);
  
  const handleSave = useCallback(() => {
    if (!contextMenu) return;
    const { comment } = contextMenu;
    const timestamp = new Date(comment.timestamp).toLocaleString();
    const filename = `message_${comment.username}_${Date.now()}.txt`;
    const content = `Username: ${comment.username || 'anonymous'}\nDate/Time: ${timestamp}\n\nMessage:\n${comment.text}`;
    
    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('[Context Menu] Saved message as:', filename);
  }, [contextMenu]);
  
  const handleBlock = useCallback(() => {
    if (!contextMenu) return;
    const { comment, clickedWord, isUsername } = contextMenu;
    
    if (clickedWord && !isUsername) {
      // Block the specific word
      addNegativeWordFilter(clickedWord);
      console.log('[Context Menu] Blocked word:', clickedWord);
    } else {
      // Block the username
      const username = comment.username || 'anonymous';
      addNegativeWordFilter(username);
      console.log('[Context Menu] Blocked user:', username);
    }
  }, [contextMenu, addNegativeWordFilter]);
  
  // Title context menu handlers
  const handleTitleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setTitleContextMenu({ x: e.clientX, y: e.clientY });
  }, []);
  
  const handleCopyAll = useCallback(() => {
    // Get all visible messages
    const messages = filteredComments.map(comment => {
      const timestamp = new Date(comment.timestamp).toLocaleString();
      return `${comment.username || 'anonymous'} (${timestamp}):\n${comment.text}`;
    }).join('\n\n');
    
    const header = `Say What Want - ${domainConfig.title}\nExported: ${new Date().toLocaleString()}\nTotal Messages: ${filteredComments.length}\n${'='.repeat(50)}\n\n`;
    const fullText = header + messages;
    
    // Modern clipboard API with fallback
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = fullText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    
    console.log(`[Title Context Menu] Copied ${filteredComments.length} messages to clipboard`);
  }, [filteredComments, domainConfig.title]);
  
  const handleSaveAll = useCallback(() => {
    // Get all visible messages
    const messages = filteredComments.map(comment => {
      const timestamp = new Date(comment.timestamp).toLocaleString();
      return `${comment.username || 'anonymous'} (${timestamp}):\n${comment.text}`;
    }).join('\n\n');
    
    const header = `Say What Want - ${domainConfig.title}\nExported: ${new Date().toLocaleString()}\nTotal Messages: ${filteredComments.length}\n${'='.repeat(50)}\n\n`;
    const fullText = header + messages;
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `saywhatwant_${domainConfig.title.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.txt`;
    
    // Create and download file
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`[Title Context Menu] Saved ${filteredComments.length} messages as: ${filename}`);
  }, [filteredComments, domainConfig.title]);


  // Remember and restore scroll position when toggling filters
  useEffect(() => {
    if (!streamRef.current) return;
    
    if (isFilterEnabled) {
      // Filters just turned ON - save current scroll position
      setSavedScrollPosition(streamRef.current.scrollTop);
      console.log('[Scroll] Saved scroll position before filter activation:', streamRef.current.scrollTop);
    } else if (savedScrollPosition !== null) {
      // Filters just turned OFF - restore saved scroll position
      requestAnimationFrame(() => {
        if (streamRef.current) {
          streamRef.current.scrollTop = savedScrollPosition;
          console.log('[Scroll] Restored scroll position after filter deactivation:', savedScrollPosition);
          setSavedScrollPosition(null); // Clear saved position
        }
      });
    }
  }, [isFilterEnabled, savedScrollPosition]);

  // Remember and restore scroll position when using search
  useEffect(() => {
    if (!streamRef.current) return;
    
    if (searchTerm && !savedSearchScrollPosition) {
      // Search just started - save current scroll position
      setSavedSearchScrollPosition(streamRef.current.scrollTop);
      console.log('[Scroll] Saved scroll position before search:', streamRef.current.scrollTop);
    } else if (!searchTerm && savedSearchScrollPosition !== null) {
      // Search just cleared - restore saved scroll position
      requestAnimationFrame(() => {
        if (streamRef.current) {
          streamRef.current.scrollTop = savedSearchScrollPosition;
          console.log('[Scroll] Restored scroll position after search cleared:', savedSearchScrollPosition);
          setSavedSearchScrollPosition(null); // Clear saved position
        }
      });
    }
  }, [searchTerm, savedSearchScrollPosition]);


  // Handle mobile keyboard visibility - works for both iOS and Android
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Only for mobile devices
    if (window.innerWidth > 768) return;
    
    let lastKnownKeyboardHeight = 0;
    let resizeTimer: NodeJS.Timeout;
    
    const adjustForKeyboard = (forceAdjust = false) => {
      const inputForm = document.querySelector('.mobile-input-form') as HTMLElement;
      const messagesContainer = streamRef.current;
      
      if (!inputForm || !messagesContainer) return;
      
      // Use visualViewport if available (more reliable on Android)
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - viewportHeight;
      
      // Check if keyboard state changed or force adjustment on focus
      const keyboardIsOpen = keyboardHeight > 50;
      const keyboardStateChanged = Math.abs(keyboardHeight - lastKnownKeyboardHeight) > 30;
      
      if (keyboardIsOpen && (keyboardStateChanged || forceAdjust)) {
        // Keyboard is open - adjust layout
        lastKnownKeyboardHeight = keyboardHeight;
        
        // Make input fixed at bottom
        inputForm.style.position = 'fixed';
        inputForm.style.bottom = '0';
        inputForm.style.left = '0';
        inputForm.style.right = '0';
        inputForm.style.zIndex = '9999';
        
        // Add padding to messages container
        messagesContainer.style.paddingBottom = `${inputForm.offsetHeight + keyboardHeight}px`;
        
        // Only scroll to bottom if user is already near the bottom
        if (isNearBottom) {
          setTimeout(() => {
            smoothScrollToBottom(false);
          }, 100);
        }
        
      } else if (!keyboardIsOpen && lastKnownKeyboardHeight > 0) {
        // Keyboard is closed - reset layout
        lastKnownKeyboardHeight = 0;
        
        // Reset styles
        inputForm.style.position = '';
        inputForm.style.bottom = '';
        inputForm.style.left = '';
        inputForm.style.right = '';
        inputForm.style.zIndex = '';
        messagesContainer.style.paddingBottom = '';
      }
    };
    
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      // Check if it's an input or textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Force adjustment on focus (handles case where keyboard was dismissed with native button)
        setTimeout(() => {
          adjustForKeyboard(true); // Force adjust
          // Ensure input is visible
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        
        // Check again after keyboard should be fully open
        setTimeout(() => adjustForKeyboard(true), 500);
      }
    };
    
    const handleFocusOut = () => {
      // Delay to let keyboard close
      setTimeout(() => adjustForKeyboard(false), 100);
    };
    
    const handleViewportChange = () => {
      // Clear any existing timer
      clearTimeout(resizeTimer);
      
      // Debounce the adjustment
      resizeTimer = setTimeout(() => adjustForKeyboard(false), 50);
    };
    
    // Listen for focus events
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    
    // Listen for viewport changes (more reliable for Android)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);
    
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);  
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
      clearTimeout(resizeTimer);
    };
  }, [isNearBottom, smoothScrollToBottom]);

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden relative">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="p-3 space-y-2">
          {/* Title and Domain Filter */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 
                onContextMenu={handleTitleContextMenu}
                className="sww-title transition-opacity cursor-pointer select-none" 
                title={domainFilterEnabled ? "Messages from this website | Right click more options" : "Global message stream | Right click more options"}
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
              {/* Message counter - small and subtle, inheriting user color */}
              {messageCount > 0 && (
                <span 
                  className="text-xs mr-2 opacity-60" 
                  style={{ color: userColor }}
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
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 space-y-1 min-h-0"
        style={{
          ['--scrollbar-color' as any]: getDarkerColor(userColor, OPACITY_LEVELS.DARK), // 40% opacity
          ['--scrollbar-bg' as any]: getDarkerColor(userColor, OPACITY_LEVELS.DARKEST * 0.5), // 5% opacity
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
                  backgroundColor: getDarkerColor(userColor, OPACITY_LEVELS.DARKEST),
                  color: userColor,
                  border: `1px solid ${getDarkerColor(userColor, OPACITY_LEVELS.DARK)}`
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
          <div className="text-center py-8">
            {!searchTerm && (
              <Ban 
                className="w-12 h-12 mx-auto mb-4" 
                style={{ color: userColor }}
              />
            )}
            <div style={{ color: userColor }}>
              {searchTerm ? 'No matching comments' : (
                <>
                  Apparently there's nothing to see here.
                  <br /><br />
                  Try turning filters off{' '}
                  <button
                    onClick={toggleFilter}
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
                  , changing filters, search term<br />or check what link got you here.<br />Maybe someone fucked something up.<br /><br />99.9% chance it's not a server issue.
                </>
              )}
            </div>
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
                  onContextMenu={(e) => handleContextMenu(e, comment, true)} // true = username clicked
                  onTouchStart={(e) => handleTouchStart(e, comment, true)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchEnd}
                  className="text-xs font-medium flex-shrink-0 hover:underline cursor-pointer select-none" 
                  title={`Click to filter by ${comment.username || 'Anonymous'} | Right click more options`}
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
                  <div 
                    onContextMenu={(e) => handleContextMenu(e, comment, false)} // false = message clicked
                    onTouchStart={(e) => handleTouchStart(e, comment, false)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchEnd}
                    className="text-sm leading-snug break-all overflow-wrap-anywhere" 
                    title="Click to filter by word | Right click more options"
                    style={{ 
                      lineHeight: '20px',
                      color: getCommentColor(comment) // Use actual or generated color
                    }}
                  >
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

      {/* Input Form - Always visible on mobile */}
      <div className="mobile-input-form flex-shrink-0 border-t border-white/10 bg-black/90 backdrop-blur-sm p-3 sticky bottom-0 z-20 safe-area-inset-bottom w-full max-w-full overflow-hidden">
        {error && (
          <div className="mb-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="w-full">
          <div className="relative w-full max-w-full">
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
              onFocus={() => {
                // Prevent zoom on iPhone
                window.scrollTo(0, 0);
              }}
              placeholder="Say what you want..."
              className="w-full px-3 pt-6 pb-2 pr-10 bg-white/5 border border-white/10 rounded-lg resize-none focus:outline-none focus:border-white/30 min-h-[56px] max-h-[120px] text-sm md:text-sm custom-scrollbar touch-manipulation box-border"
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
