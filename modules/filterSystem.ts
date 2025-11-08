// modules/filterSystem.ts
/**
 * Filter System Module
 * Centralized filtering logic for the Say What Want application
 * Handles all aspects of content filtering including username, word, 
 * date/time filters, and URL-based filter state management.
 */

// REMOVED: import { URLFilterManager, SWWFilterState } from '../lib/url-filter-manager';
// filterSystem.ts uses old URL system - needs update or removal if not used

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UsernameFilter {
  username: string;
  color: string;
  messageType?: 'human' | 'AI';  // Track if filter is for human or AI username
}

export interface DateTimeFilter {
  from: string | null;
  to: string | null;
  timeFrom: number | null;
  timeTo: number | null;
}

export interface Comment {
  id: string;
  text: string;
  username?: string;
  color?: string;
  timestamp: string;
  ip?: string;
}

export interface FilterState {
  usernames: UsernameFilter[];
  words: string[];
  negativeWords: string[];
  wordRemove: string[];
  isEnabled: boolean;
  dateTime: DateTimeFilter;
  searchTerms: string[];
}

export interface FilterConfig {
  filterByColorToo?: boolean;
  maxFilterItems?: number;
  persistToLocalStorage?: boolean;
  syncWithURL?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const FILTER_CONSTANTS = {
  STORAGE_KEYS: {
    USERNAMES: 'sww-filter-usernames',
    WORDS: 'sww-filter-words',
    NEGATIVE_WORDS: 'sww-filter-negative-words',
    // REMOVED: ENABLED - URL is now the single source of truth for filter state
  },
  COLORS: {
    NEGATIVE: '#8B0000',
    DATETIME: '#9333EA',
  },
  LIMITS: {
    MAX_USERNAMES: 50,
    MAX_WORDS: 100,
  },
};

// ============================================================================
// FILTER OPERATIONS
// ============================================================================

/**
 * Apply all active filters to a list of comments
 */
export function applyFilters(
  comments: Comment[],
  filterState: FilterState,
  config: FilterConfig = {}
): Comment[] {
  if (!filterState.isEnabled) {
    return comments;
  }

  let filtered = [...comments];

  // Apply username filters
  if (filterState.usernames.length > 0) {
    // Username+Color filtering is always applied (they're atomic)
    filtered = applyUsernameFilters(filtered, filterState.usernames);
  }

  // Apply word inclusion filters
  if (filterState.words.length > 0) {
    filtered = applyWordFilters(filtered, filterState.words, 'include');
  }

  // Apply negative word filters (exclusion)
  if (filterState.negativeWords.length > 0) {
    filtered = applyWordFilters(filtered, filterState.negativeWords, 'exclude');
  }

  // Apply word removal filters (hide specific words)
  if (filterState.wordRemove.length > 0) {
    filtered = applyWordFilters(filtered, filterState.wordRemove, 'remove');
  }

  // Apply date/time filters
  if (hasDateTimeFilter(filterState.dateTime)) {
    filtered = applyDateTimeFilter(filtered, filterState.dateTime);
  }

  return filtered;
}

/**
 * Filter comments by username (and optionally color)
 */
function applyUsernameFilters(
  comments: Comment[],
  filters: UsernameFilter[]
): Comment[] {
  return comments.filter(comment => {
    if (!comment.username) return false;
    if (!comment.color) return false; // Comments must have colors

    return filters.some(filter => {
      // Username+Color is atomic - ALWAYS check both
      const usernameMatches = filter.username === comment.username;
      const colorMatches = filter.color === comment.color;
      return usernameMatches && colorMatches;
    });
  });
}

/**
 * Apply word-based filters (include, exclude, or remove)
 */
function applyWordFilters(
  comments: Comment[],
  words: string[],
  mode: 'include' | 'exclude' | 'remove'
): Comment[] {
  if (words.length === 0) return comments;

  return comments.filter(comment => {
    const commentLower = comment.text.toLowerCase();
    
    switch (mode) {
      case 'include':
        // Include only comments containing ALL words (AND logic)
        return words.every(word => commentLower.includes(word.toLowerCase()));
      
      case 'exclude':
      case 'remove':
        // Exclude comments containing any of the words
        return !words.some(word => commentLower.includes(word.toLowerCase()));
      
      default:
        return true;
    }
  });
}

/**
 * Apply date/time range filters
 */
function applyDateTimeFilter(
  comments: Comment[],
  dateTimeFilter: DateTimeFilter
): Comment[] {
  const now = Date.now();
  
  // Calculate time boundaries
  let fromTime: number | null = null;
  let toTime: number | null = null;
  
  // Handle various time formats
  if (dateTimeFilter.timeFrom !== null) {
    fromTime = now - (dateTimeFilter.timeFrom * 60 * 1000);
  } else if (dateTimeFilter.from) {
    fromTime = parseDateTimeString(dateTimeFilter.from, now);
  }
  
  if (dateTimeFilter.timeTo !== null) {
    toTime = now - (dateTimeFilter.timeTo * 60 * 1000);
  } else if (dateTimeFilter.to) {
    toTime = parseDateTimeString(dateTimeFilter.to, now);
  }
  
  // Apply the filter
  return comments.filter(comment => {
    const commentTime = new Date(comment.timestamp).getTime();
    
    if (fromTime !== null && commentTime < fromTime) {
      return false;
    }
    
    if (toTime !== null && commentTime > toTime) {
      return false;
    }
    
    return true;
  });
}

/**
 * Check if date/time filter has any active criteria
 */
function hasDateTimeFilter(dateTimeFilter: DateTimeFilter): boolean {
  return !!(
    dateTimeFilter.from ||
    dateTimeFilter.to ||
    dateTimeFilter.timeFrom !== null ||
    dateTimeFilter.timeTo !== null
  );
}

/**
 * Parse date/time string into timestamp
 */
function parseDateTimeString(dateStr: string, now: number): number | null {
  // Handle special keywords
  if (dateStr === 'now') {
    return now;
  }
  
  // Handle T notation (T60 = 60 minutes ago)
  if (dateStr.startsWith('T')) {
    const minutes = parseInt(dateStr.substring(1), 10);
    if (!isNaN(minutes)) {
      return now - (minutes * 60 * 1000);
    }
  }
  
  // Try to parse as regular date
  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    return timestamp;
  }
  
  return null;
}

// ============================================================================
// FILTER STATE MANAGEMENT
// ============================================================================

export class FilterManager {
  private state: FilterState;
  private config: FilterConfig;
  private urlManager: any | null = null;  // Stubbed - was URLFilterManager

  constructor(config: FilterConfig = {}) {
    this.config = {
      filterByColorToo: false,
      maxFilterItems: 100,
      persistToLocalStorage: true,
      syncWithURL: true,
      ...config
    };

    this.state = this.loadInitialState();
    
    if (this.config.syncWithURL && typeof window !== 'undefined') {
      // REMOVED: URLFilterManager.getInstance() - old system
      // URL sync now handled by useSimpleFilters in components
      this.urlManager = null;
    }
  }

  /**
   * Load initial filter state from localStorage and URL
   */
  private loadInitialState(): FilterState {
    const state: FilterState = {
      usernames: [],
      words: [],
      negativeWords: [],
      wordRemove: [],
      isEnabled: false,
      dateTime: {
        from: null,
        to: null,
        timeFrom: null,
        timeTo: null,
      },
      searchTerms: [],
    };

    if (typeof window === 'undefined') {
      return state;
    }

    // Load from localStorage if enabled
    if (this.config.persistToLocalStorage) {
      try {
        const savedUsernames = localStorage.getItem(FILTER_CONSTANTS.STORAGE_KEYS.USERNAMES);
        const savedWords = localStorage.getItem(FILTER_CONSTANTS.STORAGE_KEYS.WORDS);
        const savedNegativeWords = localStorage.getItem(FILTER_CONSTANTS.STORAGE_KEYS.NEGATIVE_WORDS);
        // Filter enabled state is now managed through URL only - removed localStorage check

        if (savedUsernames) {
          state.usernames = JSON.parse(savedUsernames);
        }
        if (savedWords) {
          state.words = JSON.parse(savedWords);
        }
        if (savedNegativeWords) {
          state.negativeWords = JSON.parse(savedNegativeWords);
        }
        // isEnabled state comes from URL, not localStorage
      } catch (error) {
        console.error('Error loading filter state from localStorage:', error);
      }
    }

    return state;
  }

  /**
   * Sync filter state with URL
   * STUBBED: URL sync now handled by useSimpleFilters in components
   */
  private syncWithURL(): void {
    // No longer used - URL management moved to useSimpleFilters
    return;
  }

  /**
   * Get current filter state
   */
  getState(): FilterState {
    return { ...this.state };
  }

  /**
   * Toggle filter enabled state
   */
  toggleEnabled(): void {
    this.state.isEnabled = !this.state.isEnabled;
    this.persist();
  }

  /**
   * Add username to filter
   */
  addUsernameFilter(username: string, color: string): void {
    // Check if already exists
    const exists = this.state.usernames.some(
      f => f.username === username && f.color === color
    );

    if (!exists && this.state.usernames.length < FILTER_CONSTANTS.LIMITS.MAX_USERNAMES) {
      this.state.usernames.push({ username, color });
      this.persist();
    }
  }

  /**
   * Remove username from filter
   */
  removeUsernameFilter(username: string, color: string): void {
    this.state.usernames = this.state.usernames.filter(
      f => !(f.username === username && f.color === color)
    );
    this.persist();
  }

  /**
   * Add word to inclusion filter
   */
  addWordFilter(word: string): void {
    const normalized = word.toLowerCase();
    if (!this.state.words.includes(normalized) && 
        this.state.words.length < FILTER_CONSTANTS.LIMITS.MAX_WORDS) {
      this.state.words.push(normalized);
      this.persist();
    }
  }

  /**
   * Remove word from inclusion filter
   */
  removeWordFilter(word: string): void {
    const normalized = word.toLowerCase();
    this.state.words = this.state.words.filter(w => w !== normalized);
    this.persist();
  }

  /**
   * Add word to exclusion filter
   */
  addNegativeWordFilter(word: string): void {
    const normalized = word.toLowerCase();
    if (!this.state.negativeWords.includes(normalized) && 
        this.state.negativeWords.length < FILTER_CONSTANTS.LIMITS.MAX_WORDS) {
      this.state.negativeWords.push(normalized);
      this.persist();
    }
  }

  /**
   * Remove word from exclusion filter
   */
  removeNegativeWordFilter(word: string): void {
    const normalized = word.toLowerCase();
    this.state.negativeWords = this.state.negativeWords.filter(w => w !== normalized);
    this.persist();
  }

  /**
   * Update date/time filter
   */
  updateDateTimeFilter(dateTimeFilter: Partial<DateTimeFilter>): void {
    this.state.dateTime = {
      ...this.state.dateTime,
      ...dateTimeFilter
    };
    this.persist();
  }

  /**
   * Clear date/time filter
   */
  clearDateTimeFilter(): void {
    this.state.dateTime = {
      from: null,
      to: null,
      timeFrom: null,
      timeTo: null,
    };
    this.persist();
  }

  /**
   * Check if any filters are active
   */
  hasActiveFilters(): boolean {
    return !!(
      this.state.usernames.length > 0 ||
      this.state.words.length > 0 ||
      this.state.negativeWords.length > 0 ||
      this.state.wordRemove.length > 0 ||
      hasDateTimeFilter(this.state.dateTime)
    );
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.state = {
      usernames: [],
      words: [],
      negativeWords: [],
      wordRemove: [],
      isEnabled: false,
      dateTime: {
        from: null,
        to: null,
        timeFrom: null,
        timeTo: null,
      },
      searchTerms: [],
    };
    this.persist();
  }

  /**
   * Persist filter state to localStorage
   */
  private persist(): void {
    if (!this.config.persistToLocalStorage || typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(
        FILTER_CONSTANTS.STORAGE_KEYS.USERNAMES,
        JSON.stringify(this.state.usernames)
      );
      localStorage.setItem(
        FILTER_CONSTANTS.STORAGE_KEYS.WORDS,
        JSON.stringify(this.state.words)
      );
      localStorage.setItem(
        FILTER_CONSTANTS.STORAGE_KEYS.NEGATIVE_WORDS,
        JSON.stringify(this.state.negativeWords)
      );
      // Filter enabled state is now managed through URL only - no localStorage
    } catch (error) {
      console.error('Error persisting filter state:', error);
    }
  }

  /**
   * Apply filters to comments
   */
  applyFilters(comments: Comment[]): Comment[] {
    return applyFilters(comments, this.state, this.config);
  }
}

// ============================================================================
// REACT INTEGRATION HELPERS
// ============================================================================

/**
 * Create a filter manager instance for use in React components
 */
export function createFilterManager(config?: FilterConfig): FilterManager {
  return new FilterManager(config);
}

/**
 * Parse filter words from text selection
 */
export function parseFilterWord(selectedText: string): string | null {
  // Remove leading/trailing whitespace
  const trimmed = selectedText.trim();
  
  // Don't allow empty strings or very long selections
  if (!trimmed || trimmed.length > 50) {
    return null;
  }
  
  // Return the normalized word
  return trimmed.toLowerCase();
}

/**
 * Get filter display color based on type
 */
export function getFilterColor(type: 'username' | 'word' | 'negative' | 'datetime'): string {
  switch (type) {
    case 'negative':
      return FILTER_CONSTANTS.COLORS.NEGATIVE;
    case 'datetime':
      return FILTER_CONSTANTS.COLORS.DATETIME;
    default:
      return '#60A5FA'; // Default blue
  }
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export const FilterSystem = {
  FilterManager,
  createFilterManager,
  applyFilters,
  parseFilterWord,
  getFilterColor,
  FILTER_CONSTANTS,
};

export default FilterSystem;
