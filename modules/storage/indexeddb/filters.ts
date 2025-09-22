/**
 * Filter Memory Logic
 * Handles lifetime filter tracking and message retention decisions
 */

import { Message, LifetimeFilters, FilterState } from '../interface';

/**
 * Normalize text for matching (remove all non-alphanumeric, lowercase)
 * Matches the normalization used in URLFilterManager
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Check if a message matches any lifetime filter
 * Uses OR logic - if message matches ANY filter, it should be kept permanently
 */
export function matchesLifetimeFilters(message: Message, filters: LifetimeFilters): boolean {
  if (!filters || (!filters.users?.length && !filters.words?.length && !filters.searchTerms?.length)) {
    return false;
  }
  
  // Normalize username for comparison
  const normalizedUsername = normalize(message.username);
  
  // Check user filters
  if (filters.users?.length > 0) {
    const normalizedUsers = filters.users.map(u => normalize(u));
    if (normalizedUsers.includes(normalizedUsername)) {
      return true;
    }
  }
  
  // Check word filters (exact word match)
  if (filters.words?.length > 0) {
    const messageWords = message.text.toLowerCase().split(/\s+/);
    for (const filterWord of filters.words) {
      if (messageWords.includes(filterWord.toLowerCase())) {
        return true;
      }
    }
  }
  
  // Check search terms (partial match)
  if (filters.searchTerms?.length > 0) {
    const lowerText = message.text.toLowerCase();
    for (const searchTerm of filters.searchTerms) {
      if (lowerText.includes(searchTerm.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get which filters a message matches
 * Returns array of filter strings for tracking
 */
export function getMatchedFilters(message: Message, filters: LifetimeFilters): string[] {
  const matched: string[] = [];
  
  if (!filters) return matched;
  
  // Normalize username for comparison
  const normalizedUsername = normalize(message.username);
  
  // Check user filters
  if (filters.users?.length > 0) {
    const normalizedUsers = filters.users.map(u => normalize(u));
    if (normalizedUsers.includes(normalizedUsername)) {
      matched.push(`user:${message.username}`);
    }
  }
  
  // Check word filters
  if (filters.words?.length > 0) {
    const messageWords = message.text.toLowerCase().split(/\s+/);
    for (const filterWord of filters.words) {
      if (messageWords.includes(filterWord.toLowerCase())) {
        matched.push(`word:${filterWord}`);
      }
    }
  }
  
  // Check search terms
  if (filters.searchTerms?.length > 0) {
    const lowerText = message.text.toLowerCase();
    for (const searchTerm of filters.searchTerms) {
      if (lowerText.includes(searchTerm.toLowerCase())) {
        matched.push(`search:${searchTerm}`);
      }
    }
  }
  
  return matched;
}

/**
 * Merge new filters into lifetime filters
 * Adds new filters but never removes existing ones
 */
export function mergeFilters(existing: LifetimeFilters, newFilters: Partial<FilterState>): LifetimeFilters {
  const merged: LifetimeFilters = {
    users: [...(existing.users || [])],
    words: [...(existing.words || [])],
    searchTerms: [...(existing.searchTerms || [])],
    metadata: existing.metadata || {
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messageCount: 0
    }
  };
  
  // Add new users (normalized and deduplicated)
  if (newFilters.users?.length) {
    const normalizedNewUsers = newFilters.users.map(u => normalize(u));
    const normalizedExisting = merged.users.map(u => normalize(u));
    
    for (let i = 0; i < newFilters.users.length; i++) {
      if (!normalizedExisting.includes(normalizedNewUsers[i])) {
        merged.users.push(newFilters.users[i]); // Keep original case
      }
    }
  }
  
  // Add new words (deduplicated, case-insensitive)
  if (newFilters.words?.length) {
    const existingLower = merged.words.map(w => w.toLowerCase());
    for (const word of newFilters.words) {
      if (!existingLower.includes(word.toLowerCase())) {
        merged.words.push(word);
      }
    }
  }
  
  // Add new search terms (deduplicated, case-insensitive)
  if (newFilters.searchTerms?.length) {
    const existingLower = merged.searchTerms.map(s => s.toLowerCase());
    for (const term of newFilters.searchTerms) {
      if (!existingLower.includes(term.toLowerCase())) {
        merged.searchTerms.push(term);
      }
    }
  }
  
  // Update metadata
  if (merged.metadata) {
    merged.metadata.lastUpdated = new Date().toISOString();
  }
  
  return merged;
}

/**
 * Remove specific filters from lifetime filters
 */
export function removeFilters(existing: LifetimeFilters, toRemove: Partial<FilterState>): LifetimeFilters {
  const updated: LifetimeFilters = {
    users: [...(existing.users || [])],
    words: [...(existing.words || [])],
    searchTerms: [...(existing.searchTerms || [])],
    metadata: existing.metadata
  };
  
  // Remove users
  if (toRemove.users?.length) {
    const normalizedToRemove = toRemove.users.map(u => normalize(u));
    updated.users = updated.users.filter(u => 
      !normalizedToRemove.includes(normalize(u))
    );
  }
  
  // Remove words
  if (toRemove.words?.length) {
    const lowerToRemove = toRemove.words.map(w => w.toLowerCase());
    updated.words = updated.words.filter(w => 
      !lowerToRemove.includes(w.toLowerCase())
    );
  }
  
  // Remove search terms
  if (toRemove.searchTerms?.length) {
    const lowerToRemove = toRemove.searchTerms.map(s => s.toLowerCase());
    updated.searchTerms = updated.searchTerms.filter(s => 
      !lowerToRemove.includes(s.toLowerCase())
    );
  }
  
  // Update metadata
  if (updated.metadata) {
    updated.metadata.lastUpdated = new Date().toISOString();
  }
  
  return updated;
}

/**
 * Calculate filter efficiency score for cleanup decisions
 * Score = matchCount / daysSinceCreated
 */
export function calculateFilterScore(matchCount: number, created: string): number {
  const now = Date.now();
  const createdTime = new Date(created).getTime();
  const daysSinceCreated = Math.max(1, (now - createdTime) / (24 * 60 * 60 * 1000));
  
  return matchCount / daysSinceCreated;
}
