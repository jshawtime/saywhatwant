/**
 * Simple, elegant URL filter utilities
 * No singletons, no complex merging, just pure functions
 */

export interface FilterUser {
  username: string;
  color: string;
}

export interface FilterState {
  users: FilterUser[];
  words: string[];
  negativeWords: string[];
  filterActive: boolean;
  messageType: 'human' | 'AI' | 'ALL' | null;  // Channel type: human, AI, both, or neither
  uis?: string;  // User initial state: username:color or username:random
  ais?: string;  // AI initial state: username:color or username:random (overrides entity default for privacy)
  
  // Bot control parameters (complete URL specification)
  entity?: string;      // Force specific entity ID from config
  priority?: number;    // Queue priority 0-99 (0=highest)
  model?: string;       // Override LLM model selection
  nom?: number | 'ALL'; // Context size override
}

/**
 * Parse URL hash into filter state
 */
export function parseURL(): FilterState {
  if (typeof window === 'undefined') {
    return { users: [], words: [], negativeWords: [], filterActive: false, messageType: 'ALL' };
  }

  const hash = window.location.hash.slice(1);
  if (!hash) {
    return { users: [], words: [], negativeWords: [], filterActive: false, messageType: 'ALL' };
  }

  const state: FilterState = {
    users: [],
    words: [],
    negativeWords: [],
    filterActive: false,
    messageType: null  // Default to null (will be set from URL or default to ALL)
  };

  // Parse each parameter
  const params = hash.split('&');
  for (const param of params) {
    const [key, value] = param.split('=');
    
    switch (key) {
      case 'filteractive':
        state.filterActive = value === 'true';
        break;
        
      case 'mt':
        // Message type: 'human', 'AI', or 'ALL'
        if (value === 'human' || value === 'AI' || value === 'ALL') {
          state.messageType = value;
        }
        break;
        
      case 'u':
        // Format: username1:color1+username2:color2
        if (value) {
          const userPairs = value.split('+');
          state.users = userPairs.map(pair => {
            const [username, color] = pair.split(':');
            return { 
              username: decodeURIComponent(username || ''), 
              color: color || '096165250' // Store as 9-digit, not RGB
            };
          });
        }
        break;
        
      case 'word':
        state.words = value ? value.split('+').map(w => decodeURIComponent(w)) : [];
        break;
        
      case '-word':
        state.negativeWords = value ? value.split('+').map(w => decodeURIComponent(w)) : [];
        break;
        
      case 'uis':
        // User initial state: username:color or username:random
        state.uis = value ? decodeURIComponent(value) : undefined;
        break;
        
      case 'ais':
        // AI initial state: username:color or username:random
        // Overrides entity's default username/color for isolated conversations
        state.ais = value ? decodeURIComponent(value) : undefined;
        break;
        
      case 'entity':
        // Entity ID from URL - must match config exactly (case-sensitive)
        state.entity = value || undefined;
        break;
        
      case 'priority':
        // Queue priority 0-99 (0=highest, 99=lowest)
        const priorityNum = parseInt(value);
        if (!isNaN(priorityNum) && priorityNum >= 0 && priorityNum <= 99) {
          state.priority = priorityNum;
        }
        break;
        
      case 'model':
        // Override LLM model
        state.model = value;
        break;
        
      case 'nom':
        // Number of messages for LLM context
        if (value === 'ALL') {
          state.nom = 'ALL';
        } else {
          const nomNum = parseInt(value);
          if (!isNaN(nomNum) && nomNum > 0) {
            state.nom = nomNum;
          }
        }
        break;
    }
  }
  
  // If no mt parameter found, default to 'ALL' (both ON)
  if (state.messageType === null) {
    state.messageType = 'ALL';
  }

  return state;
}

/**
 * Build URL hash from filter state
 */
export function buildURL(state: FilterState): string {
  const params: string[] = [];
  
  // Check if we have any content filters
  const hasFilters = state.users.length > 0 || 
                     state.words.length > 0 || 
                     state.negativeWords.length > 0;

  // Add users
  if (state.users.length > 0) {
    const userString = state.users
      .map(u => `${encodeURIComponent(u.username)}:${rgbToNineDigit(u.color)}`)
      .join('+');
    params.push(`u=${userString}`);
  }

  // Add words
  if (state.words.length > 0) {
    params.push(`word=${state.words.map(w => encodeURIComponent(w)).join('+')}`);
  }

  // Add negative words
  if (state.negativeWords.length > 0) {
    params.push(`-word=${state.negativeWords.map(w => encodeURIComponent(w)).join('+')}`);
  }

  // Add filterActive if we have filters OR if it's explicitly set to true
  if (hasFilters || state.filterActive) {
    params.push(`filteractive=${state.filterActive}`);
  }

  // ALWAYS add messageType to prevent state conflicts
  // (Removing it causes React to re-parse before state updates)
  // Only add mt parameter if not null (both OFF = no parameter)
  if (state.messageType !== null) {
    params.push(`mt=${state.messageType}`);
  }
  
  // Add uis if present (user initial state)
  if (state.uis) {
    params.push(`uis=${encodeURIComponent(state.uis)}`);
  }
  
  // Add ais if present (AI initial state - critical for privacy)
  if (state.ais) {
    params.push(`ais=${encodeURIComponent(state.ais)}`);
  }
  
  // Add bot control parameters if present
  if (state.entity) {
    params.push(`entity=${state.entity}`);
  }
  if (state.priority !== undefined) {
    params.push(`priority=${state.priority}`);
  }
  if (state.model) {
    params.push(`model=${state.model}`);
  }
  if (state.nom !== undefined) {
    params.push(`nom=${state.nom}`);
  }

  return params.length > 0 ? `#${params.join('&')}` : '';
}

/**
 * Update the URL with new filter state
 */
export function updateURL(state: FilterState): void {
  if (typeof window === 'undefined') return;
  
  const hash = buildURL(state);
  const currentHash = window.location.hash;
  
  console.log('[url-filter-simple] updateURL called');
  console.log('[url-filter-simple] Built hash:', hash);
  console.log('[url-filter-simple] Current hash:', currentHash);
  console.log('[url-filter-simple] Will update?', hash !== currentHash);
  
  if (hash !== currentHash) {
    console.log('[url-filter-simple] Updating URL to:', hash);
    window.history.pushState(null, '', hash);
    // Dispatch a custom event for React to listen to
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    console.log('[url-filter-simple] Skipping update - hash unchanged');
  }
}

/**
 * Simple color conversion utilities
 */
export function rgbToNineDigit(color: string): string {
  // Already in 9-digit format
  if (/^\d{9}$/.test(color)) return color;
  
  // Parse rgb(r, g, b) format
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return '096165250'; // Default blue
  
  const [, r, g, b] = match;
  return r.padStart(3, '0') + g.padStart(3, '0') + b.padStart(3, '0');
}

export function nineDigitToRgb(digits: string): string {
  if (!/^\d{9}$/.test(digits)) return 'rgb(96, 165, 250)';
  
  const r = parseInt(digits.slice(0, 3), 10);
  const g = parseInt(digits.slice(3, 6), 10);
  const b = parseInt(digits.slice(6, 9), 10);
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Normalize username for URL encoding (preserve case)
 * Only removes special characters, keeps original case from DB
 */
export function normalizeUsername(username: string): string {
  return username.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Parse nom (number of messages) parameter from URL
 * Controls how many messages are sent as context to LLM
 * NOT related to UI filtering - this is for AI bot context only
 * 
 * @returns number | 'ALL' | null
 */
export function parseNOM(): number | 'ALL' | null {
  if (typeof window === 'undefined') return null;
  
  const hash = window.location.hash.slice(1);
  const params = hash.split('&');
  
  for (const param of params) {
    const [key, value] = param.split('=');
    if (key === 'nom') {
      if (value === 'ALL') return 'ALL';
      const num = parseInt(value);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  
  return null;  // Not specified in URL
}

/**
 * Parse priority parameter from URL
 * Controls queue priority (0-99, where 0 is highest)
 * Priority 0-9 bypasses router for direct conversations
 * 
 * @returns number (0-99) | null
 */
export function parsePriority(): number | null {
  if (typeof window === 'undefined') return null;
  
  const hash = window.location.hash.slice(1);
  const params = hash.split('&');
  
  for (const param of params) {
    const [key, value] = param.split('=');
    if (key === 'priority') {
      const num = parseInt(value);
      if (!isNaN(num) && num >= 0 && num <= 99) return num;
    }
  }
  
  return null;  // Not specified in URL
}
