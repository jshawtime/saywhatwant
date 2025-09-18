'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Send, ChevronDown, User, X } from 'lucide-react';
import { Comment, CommentsResponse } from '@/types';

// Configuration
const INITIAL_LOAD_COUNT = 500;
const LAZY_LOAD_BATCH = 50;
const POLLING_INTERVAL = 5000;
const MAX_COMMENT_LENGTH = 1000;
const MAX_USERNAME_LENGTH = 12;

const CommentsStream: React.FC = () => {
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

  // Refs
  const streamRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastFetchTimeRef = useRef<number>(Date.now());
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  // Storage key for localStorage
  const COMMENTS_STORAGE_KEY = 'sww-comments-local';

  // Load username from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem('sww-username');
    if (savedUsername) {
      setUsername(savedUsername);
      setHasClickedUsername(true); // If there's a saved username, treat it as if they've clicked
    }
  }, []);

  // Parse URLs in comment text
  const parseCommentText = useCallback((text: string): React.ReactNode[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }, []);

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
      const newComment: Comment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: inputText.trim(),
        timestamp: Date.now(),
        username: username || undefined,
      };
      
      // Load existing comments
      const existingComments = loadCommentsFromStorage();
      
      // Add new comment and save
      const updatedComments = [...existingComments, newComment];
      saveCommentsToStorage(updatedComments);
      
      // Add to local state immediately
      setAllComments(prev => [...prev, newComment]);
      setDisplayedComments(prev => [...prev, newComment]);
      
      // Clear input
      setInputText('');
      
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

  // Filter comments based on search
  const filteredComments = useMemo(() => {
    if (!searchTerm) return displayedComments;
    
    const searchLower = searchTerm.toLowerCase();
    return displayedComments.filter(comment => 
      comment.text.toLowerCase().includes(searchLower) ||
      (comment.username && comment.username.toLowerCase().includes(searchLower))
    );
  }, [displayedComments, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="p-3 space-y-2">
          {/* Title and Username */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Say What Want</h2>
            
            {/* Username Input - Always Visible */}
            <div className="relative flex items-center gap-2" style={{ width: 'calc(12ch * 1.5 + 60px)' }}>
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <User className="w-4 h-4 text-white/40" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const newUsername = e.target.value.substring(0, MAX_USERNAME_LENGTH);
                  setUsername(newUsername);
                  localStorage.setItem('sww-username', newUsername);
                }}
                onFocus={() => {
                  if (!hasClickedUsername) {
                    setHasClickedUsername(true);
                  }
                }}
                placeholder={hasClickedUsername && username ? "" : "..."}
                className={`flex-1 pl-9 pr-8 py-1.5 bg-white/5 border rounded-lg text-sm focus:outline-none focus:border-white/30 placeholder-white/40 transition-all duration-300 ${
                  usernameFlash 
                    ? 'border-cyan-400 animate-pulse shadow-[0_0_10px_rgba(0,255,255,0.5)]' 
                    : 'border-white/10'
                }`}
                maxLength={MAX_USERNAME_LENGTH}
                style={{ width: '100%' }}
              />
              {username && (
                <button
                  onClick={() => {
                    setUsername('');
                    localStorage.removeItem('sww-username');
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
                  aria-label="Clear username"
                >
                  <X className="w-3 h-3 text-white/60 hover:text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Search Bar - Instant Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-white/30 placeholder-white/40"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3 h-3 text-white/60 hover:text-white" />
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
                <span className="text-xs font-medium text-blue-400 flex-shrink-0" style={{ lineHeight: '20px' }}>
                  {comment.username || 'Anonymous'}:
                </span>
                
                {/* Message with right margin for timestamp */}
                <div className="flex-1 pr-12">
                  <div className="text-sm leading-snug break-words" style={{ lineHeight: '20px' }}>
                    {parseCommentText(comment.text)}
                  </div>
                </div>
                
                {/* Timestamp - positioned absolute on right */}
                <span 
                  className="absolute top-0 right-0 text-[10px] text-white/25 border border-white/10 px-1.5 py-0.5 rounded"
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.03)'
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
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value.substring(0, MAX_COMMENT_LENGTH))}
            placeholder="Say what you want..."
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg resize-none focus:outline-none focus:border-white/30 placeholder-white/40 min-h-[40px] max-h-[120px] text-sm"
            maxLength={MAX_COMMENT_LENGTH}
            disabled={isSubmitting}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting || !inputText.trim()}
            className={`p-2 rounded-lg transition-all hover-scale ${
              isSubmitting || !inputText.trim()
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        
        <div className="mt-1 text-xs text-white/40 text-right">
          {inputText.length}/{MAX_COMMENT_LENGTH}
        </div>
      </div>
    </div>
  );
};

export default CommentsStream;
