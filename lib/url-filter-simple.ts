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
}

/**
 * Parse URL hash into filter state
 */
export function parseURL(): FilterState {
  if (typeof window === 'undefined') {
    return { users: [], words: [], negativeWords: [], filterActive: false };
  }

  const hash = window.location.hash.slice(1);
  if (!hash) {
    return { users: [], words: [], negativeWords: [], filterActive: false };
  }

  const state: FilterState = {
    users: [],
    words: [],
    negativeWords: [],
    filterActive: false
  };

  // Parse each parameter
  const params = hash.split('&');
  for (const param of params) {
    const [key, value] = param.split('=');
    
    switch (key) {
      case 'filteractive':
        state.filterActive = value === 'true';
        break;
        
      case 'u':
        // Format: username1:color1+username2:color2
        if (value) {
          const userPairs = value.split('+');
          state.users = userPairs.map(pair => {
            const [username, color] = pair.split(':');
            return { 
              username: username || '', 
              color: color || '096165250' // Store as 9-digit, not RGB
            };
          });
        }
        break;
        
      case 'word':
        state.words = value ? value.split('+') : [];
        break;
        
      case '-word':
        state.negativeWords = value ? value.split('+') : [];
        break;
    }
  }

  return state;
}

/**
 * Build URL hash from filter state
 */
export function buildURL(state: FilterState): string {
  const params: string[] = [];

  // Always include filterActive
  params.push(`filteractive=${state.filterActive}`);

  // Add users
  if (state.users.length > 0) {
    const userString = state.users
      .map(u => `${u.username}:${rgbToNineDigit(u.color)}`)
      .join('+');
    params.push(`u=${userString}`);
  }

  // Add words
  if (state.words.length > 0) {
    params.push(`word=${state.words.join('+')}`);
  }

  // Add negative words
  if (state.negativeWords.length > 0) {
    params.push(`-word=${state.negativeWords.join('+')}`);
  }

  return params.length > 0 ? `#${params.join('&')}` : '#filteractive=false';
}

/**
 * Update the URL with new filter state
 */
export function updateURL(state: FilterState): void {
  if (typeof window === 'undefined') return;
  
  const hash = buildURL(state);
  const currentHash = window.location.hash;
  
  if (hash !== currentHash) {
    window.history.pushState(null, '', hash);
    // Dispatch a custom event for React to listen to
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

/**
 * Initialize URL with filterActive if not present
 */
export function ensureFilterActive(): void {
  if (typeof window === 'undefined') return;
  
  const hash = window.location.hash;
  if (!hash || !hash.includes('filteractive')) {
    // Add filteractive=false without creating history entry
    const newHash = hash ? `${hash}&filteractive=false` : '#filteractive=false';
    window.history.replaceState(null, '', newHash);
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
 * Normalize username for comparison
 */
export function normalizeUsername(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, '');
}
