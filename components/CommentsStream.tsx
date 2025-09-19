'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Send, ChevronDown, User, X, Tv } from 'lucide-react';
import { Comment, CommentsResponse } from '@/types';
import { useFilters } from '@/hooks/useFilters';
import FilterBar from '@/components/FilterBar';
import { parseCommentText, getDarkerColor } from '@/utils/textParsing';

// Configuration
const INITIAL_LOAD_COUNT = 500;
const LAZY_LOAD_BATCH = 50;
const POLLING_INTERVAL = 5000;
const MAX_COMMENT_LENGTH = 201;
const MAX_USERNAME_LENGTH = 16;

// Predefined color palette for usernames
const COLOR_PALETTE = [
  '#60A5FA', // blue-400
  '#34D399', // emerald-400
  '#FBBF24', // amber-400
  '#F87171', // red-400
  '#A78BFA', // violet-400
  '#FB923C', // orange-400
  '#4ADE80', // green-400
  '#F472B6', // pink-400
  '#38BDF8', // sky-400
  '#A3E635', // lime-400
  '#E879F9', // fuchsia-400
  '#94A3B8', // slate-400
];

interface CommentsStreamProps {
  showVideo?: boolean;
  toggleVideo?: () => void;
}

const CommentsStream: React.FC<CommentsStreamProps> = ({ showVideo = false, toggleVideo }) => {
  // State management
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [displayedComments, setDisplayedComments] = useState<Comment[]>([]);
  const [inputText, setInputText] = useState('');
  const [username, setUsername] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasNewComments, setHasNewComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameFlash, setUsernameFlash] = useState(false);
  const [hasClickedUsername, setHasClickedUsername] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [userColor, setUserColor] = useState('#60A5FA'); // Default blue-400
  const [randomizedColors, setRandomizedColors] = useState<string[]>([]);
  const [pendingVideoKey, setPendingVideoKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false); // For hydration safety

  // Refs
  const streamRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const lastFetchTimeRef = useRef<number>(Date.now());
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const colorPickerRef = useRef<HTMLDivElement>(null);
  
  // Use the filters hook
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
    dateTimeFilter,
    clearDateTimeFilter
  } = useFilters({ displayedComments, searchTerm });

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
    
    if (savedColor && COLOR_PALETTE.includes(savedColor)) {
      setUserColor(savedColor);
    }
  }, []);

  // Listen for video share events
  useEffect(() => {
    const handleShareVideo = (event: CustomEvent) => {
      const { videoKey } = event.detail;
      
      if (!videoKey) {
        return;
      }
      
      // Store the video key internally
      setPendingVideoKey(videoKey);
      
      // Just show the link text in input
      setInputText('<-- video');
      
      // Focus the input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    window.addEventListener('shareVideo' as any, handleShareVideo);
    
    return () => {
      window.removeEventListener('shareVideo' as any, handleShareVideo);
    };
  }, []);

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

  // Keyboard shortcut for random color (r key)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Check if 'r' is pressed without modifiers and not in an input/textarea
      if (event.key === 'r' && 
          !event.ctrlKey && 
          !event.metaKey && 
          !event.altKey && 
          !event.shiftKey) {
        
        const target = event.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        
        // Don't trigger if typing in input or textarea
        if (tagName !== 'input' && tagName !== 'textarea') {
          event.preventDefault();
          // Pick a random color from the palette
          const randomColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
          setUserColor(randomColor);
          localStorage.setItem('sww-color', randomColor);
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // Create wrapped parse function with handlers
  const parseCommentTextWithHandlers = useCallback((text: string): React.ReactNode[] => {
    return parseCommentText(text, {
      onWordClick: addWordToFilter,
      onWordRightClick: addNegativeWordFilter,
      onVideoClick: (videoKey) => {
        const playEvent = new CustomEvent('playSharedVideo', {
          detail: { videoKey }
        });
        window.dispatchEvent(playEvent);
      }
    });
  }, [addWordToFilter, addNegativeWordFilter]);

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 1 minute
    if (diff < 60000) return 'now';
    
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h`;
    }
    
    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d`;
    }
    
    // Default to date
    return date.toLocaleDateString();
  };

  // Load comments from localStorage
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

  // Fetch comments (simulates API call using localStorage)
  const fetchComments = useCallback(async (offset = 0, limit = INITIAL_LOAD_COUNT) => {
    try {
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
        const data = await fetchComments(0, INITIAL_LOAD_COUNT);
        setAllComments(data.comments);
        setDisplayedComments(data.comments.slice(-LAZY_LOAD_BATCH));
        
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

  // Polling for new comments (checks localStorage for updates)
  useEffect(() => {
    const checkForNewComments = async () => {
      try {
        const storedComments = loadCommentsFromStorage();
        
        // Find truly new comments
        const latestTimestamp = allComments.length > 0 
          ? Math.max(...allComments.map(c => c.timestamp))
          : 0;
          
        const newComments = storedComments.filter(c => c.timestamp > latestTimestamp);
        
        if (newComments.length > 0) {
          console.log(`[Comments] Found ${newComments.length} new comments`);
          
          // Update all comments
          setAllComments(storedComments);
          
          // Check if user is near bottom
          const isNearBottom = streamRef.current 
            ? streamRef.current.scrollHeight - (streamRef.current.scrollTop + streamRef.current.clientHeight) < 100
            : false;
          
          // Update displayed comments with just the new ones
          setDisplayedComments(prev => [...prev, ...newComments]);
          
          // Smart auto-scroll
          if (isNearBottom && streamRef.current) {
            setTimeout(() => {
              if (streamRef.current) {
                streamRef.current.scrollTop = streamRef.current.scrollHeight;
              }
            }, 50);
          } else {
            setHasNewComments(true);
          }
        }
        
        lastFetchTimeRef.current = Date.now();
      } catch (err) {
        console.error('[Comments] Polling error:', err);
      }
    };
    
    // Start polling after initial load
    if (!isLoading) {
      // Also listen for storage events (updates from other tabs)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === COMMENTS_STORAGE_KEY) {
          checkForNewComments();
        }
      };
      
      window.addEventListener('storage', handleStorageChange);
      pollingIntervalRef.current = setInterval(checkForNewComments, POLLING_INTERVAL);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [isLoading, allComments, loadCommentsFromStorage]);

  // Handle comment submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || !inputText.trim()) return;
    
    // Check if username is empty
    if (!username) {
      // Flash the username field to indicate it needs to be filled
      setUsernameFlash(true);
      setTimeout(() => setUsernameFlash(false), 1000);
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Create new comment
      let commentText = inputText.trim();
      
      // If there's a pending video, replace '<-- video' with the full video link
      if (pendingVideoKey && commentText.includes('<-- video')) {
        commentText = commentText.replace('<-- video', `[video:${pendingVideoKey}] <-- video`);
      }
      
      const newComment: Comment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: commentText,
        timestamp: Date.now(),
        username: username || undefined,
        color: userColor,
      };
      
      // Load existing comments
      const existingComments = loadCommentsFromStorage();
      
      // Add new comment and save
      const updatedComments = [...existingComments, newComment];
      saveCommentsToStorage(updatedComments);
      
      // Add to local state immediately
      setAllComments(prev => [...prev, newComment]);
      setDisplayedComments(prev => [...prev, newComment]);
      
      // Clear input and pending video
      setInputText('');
      setPendingVideoKey(null);
      
      // Keep focus in input field for rapid messaging
      if (inputRef.current) {
        inputRef.current.focus();
      }
      
      // Scroll to bottom
      setTimeout(() => {
        if (streamRef.current) {
          streamRef.current.scrollTop = streamRef.current.scrollHeight;
        }
      }, 50);
      
      console.log('[Comments] Posted comment:', newComment.id);
      
    } catch (err) {
      console.error('[Comments] Error posting comment:', err);
      setError('Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle scroll to load more
  const handleScroll = useCallback(() => {
    if (!streamRef.current) return;
    
    const { scrollTop } = streamRef.current;
    
    // Load more when scrolling near top
    if (scrollTop < 100) {
      const currentCount = displayedComments.length;
      const availableCount = allComments.length;
      
      if (currentCount < availableCount) {
        const newBatchStart = Math.max(0, availableCount - currentCount - LAZY_LOAD_BATCH);
        const newBatchEnd = availableCount - currentCount;
        const newBatch = allComments.slice(newBatchStart, newBatchEnd);
        
        setDisplayedComments(prev => [...newBatch, ...prev]);
      }
    }
  }, [allComments, displayedComments]);

  // Scroll to bottom
  const scrollToBottom = () => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
      setHasNewComments(false);
    }
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
    const shuffled = [...COLOR_PALETTE].sort(() => Math.random() - 0.5);
    setRandomizedColors(shuffled);
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
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="p-3 space-y-2">
          {/* Title and Username */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="sww-title" style={{ color: userColor }}>Say What Want</h2>
            
            {/* Username Input and TV Toggle - Always Visible */}
            <div className="flex items-center gap-4">
              <div className="relative flex items-center gap-2" style={{ width: 'calc(15ch + 65px)' }} ref={colorPickerRef}>
              <button
                onClick={toggleColorPicker}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 hover:opacity-80 transition-opacity z-10"
                style={{ color: userColor }}
                aria-label="Choose color"
                title="Click to pick color or press 'R' for random"
                tabIndex={-1}
              >
                <User className="w-4 h-4" />
              </button>
              
              {/* Color Picker Dropdown */}
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-2 grid grid-cols-6 gap-1 z-20 shadow-xl">
                  {randomizedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => selectColor(color)}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors"
                      style={{ color }}
                      aria-label={`Select color ${color}`}
                    >
                      <User className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              )}
              <input
                ref={usernameRef}
                type="text"
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
                placeholder={hasClickedUsername && username ? "" : "..."}
                className={`flex-1 pl-9 pr-8 py-1.5 bg-white/5 border rounded-lg text-sm focus:outline-none focus:border-white/30 placeholder-white/40 transition-all duration-300 ${
                  usernameFlash 
                    ? 'border-cyan-400 animate-pulse shadow-[0_0_10px_rgba(0,255,255,0.5)]' 
                    : 'border-white/10'
                }`}
                maxLength={MAX_USERNAME_LENGTH}
                style={{ 
                  width: '100%',
                  color: getDarkerColor(userColor, 0.6) // Match darker username in comments
                }}
              />
              {username && (
                <button
                  onClick={() => {
                    setUsername('');
                    localStorage.removeItem('sww-username');
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:opacity-80 rounded transition-opacity"
                  aria-label="Clear username"
                  style={{ color: getDarkerColor(userColor, 0.6) }}
                  tabIndex={-1}
                >
                  <X className="w-3 h-3" />
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
                    ? getDarkerColor(userColor, 0.6)  // Username color when active
                    : userColor,  // Same as title when off
                  opacity: showVideo ? 1 : 0.5  // Same opacity as title when off
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 z-10 pointer-events-none" 
              style={{ color: getDarkerColor(userColor, 0.6) }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-1.5 bg-white/5 border rounded-lg text-sm focus:outline-none"
              style={{ 
                borderColor: searchTerm ? getDarkerColor(userColor, 0.5) : 'rgba(255,255,255,0.1)',
                color: searchTerm ? userColor : 'rgba(255,255,255,0.6)',
                '--placeholder-color': getDarkerColor(userColor, 0.4)
              } as React.CSSProperties}
              tabIndex={-1}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:opacity-80 rounded transition-colors"
                aria-label="Clear search"
                style={{ color: getDarkerColor(userColor, 0.6) }}
                tabIndex={-1}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comments Stream */}
      <div 
        ref={streamRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1"
        style={{
          '--scrollbar-color': getDarkerColor(userColor, 0.3),
          '--scrollbar-bg': getDarkerColor(userColor, 0.05),
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
          <div className="text-center text-white/40 py-8">
            <p>{searchTerm ? 'No matching comments' : 'No comments yet. Be the first!'}</p>
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
                  onClick={() => comment.username && addToFilter(comment.username, comment.color || '#60A5FA')}
                  className="text-xs font-medium flex-shrink-0 hover:underline cursor-pointer" 
                  style={{ 
                    lineHeight: '20px',
                    color: getDarkerColor(comment.color || '#60A5FA', 0.6) // Darker username
                  }}
                  tabIndex={-1}
                >
                  {comment.username || 'Anonymous'}:
                </button>
                
                {/* Message with right margin for timestamp */}
                <div className="flex-1 pr-12">
                  <div className="text-sm leading-snug break-words" style={{ 
                    lineHeight: '20px',
                    color: comment.color || '#60A5FA'
                  }}>
                    {parseCommentTextWithHandlers(comment.text)}
                  </div>
                </div>
                
                {/* Timestamp - positioned absolute on right */}
                <span 
                  className="absolute top-0 right-0 text-[10px] border px-1.5 py-0.5 rounded"
                  style={{ 
                    color: getDarkerColor(comment.color || '#60A5FA', 0.7), // Darker text
                    borderColor: getDarkerColor(comment.color || '#60A5FA', 0.3), // Darker border
                    backgroundColor: getDarkerColor(comment.color || '#60A5FA', 0.08) // Darker background
                  }}
                >
                  {mounted ? formatTimestamp(comment.timestamp) : '...'}
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
        
        <form onSubmit={handleSubmit} className="flex gap-2 items-stretch">
          <div className="flex-1 relative">
            {/* Character counter at top of textarea */}
            <div 
              className="absolute top-2 right-2 text-[10px] pointer-events-none z-10"
              style={{ color: getDarkerColor(userColor, 0.6) }}
            >
              {inputText.length}/{MAX_COMMENT_LENGTH}
            </div>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => {
                const newText = e.target.value.substring(0, MAX_COMMENT_LENGTH);
                setInputText(newText);
                
                // Clear pending video if user removes the video text completely
                if (pendingVideoKey && !newText.includes('<-- video')) {
                  setPendingVideoKey(null);
                }
              }}
              onClick={(e) => {
                // If clicking on a video link in the input, play it
                if (pendingVideoKey && inputText.includes('<-- video')) {
                  const playEvent = new CustomEvent('playSharedVideo', {
                    detail: { videoKey: pendingVideoKey }
                  });
                  window.dispatchEvent(playEvent);
                }
              }}
              placeholder="Say what you want..."
              className="w-full h-full px-3 pt-6 pb-2 pr-16 bg-white/5 border border-white/10 rounded-lg resize-none focus:outline-none focus:border-white/30 min-h-[56px] max-h-[120px] text-sm custom-scrollbar"
              style={{
                '--placeholder-color': getDarkerColor(userColor, 0.6), // Match username color
                '--scrollbar-color': getDarkerColor(userColor, 0.6), // Match username color
                '--scrollbar-bg': getDarkerColor(userColor, 0.1), // Very subtle background
                color: userColor, // Always use user's color
                cursor: pendingVideoKey && inputText.includes('<-- video') ? 'pointer' : 'text',
                textDecoration: pendingVideoKey && inputText.includes('<-- video') ? 'underline' : 'none',
                backgroundColor: getDarkerColor(userColor, 0.05), // Very dark version of user color
              } as React.CSSProperties}
              maxLength={MAX_COMMENT_LENGTH}
              disabled={isSubmitting}
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
          <button
            type="submit"
            disabled={isSubmitting || !inputText.trim()}
            className={`aspect-square flex items-center justify-center rounded-lg transition-colors self-stretch ${
              isSubmitting || !inputText.trim()
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:opacity-90'
            }`}
            style={{ 
              minWidth: '56px', // Square based on min-height
              backgroundColor: getDarkerColor(userColor, 0.6), // Username color
              color: userColor // Message text color
            }}
            tabIndex={-1}
          >
            <Send className="w-7 h-7" /> {/* Oversized icon */}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CommentsStream;
