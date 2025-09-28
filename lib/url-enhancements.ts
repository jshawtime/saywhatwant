/**
 * URL Enhancements Module
 * Handles new URL parameters for AI model conversations, filter state, and user initialization
 */

import { URLFilterManager, SWWFilterState, UserWithColor } from './url-filter-manager';

// Extended filter state with new parameters
export interface EnhancedFilterState extends SWWFilterState {
  filterActive?: boolean | null;      // Filter bar active state
  modelConfigs?: ModelConfig[];       // AI models to trigger
  userInitialState?: UserWithColor;   // Human user initial state
  aiInitialState?: UserWithColor;     // AI initial state
  pendingRandomColors?: RandomColorRequest[]; // Colors to generate
}

export interface ModelConfig {
  modelName: string;
  color: string;
  isRandom?: boolean;
}

export interface RandomColorRequest {
  type: 'user' | 'ai' | 'model' | 'filter';
  username?: string;
  modelName?: string;
  originalParam?: string;
}

export class URLEnhancementsManager {
  private static instance: URLEnhancementsManager;
  private urlFilterManager: URLFilterManager;
  
  private constructor() {
    this.urlFilterManager = URLFilterManager.getInstance();
  }
  
  static getInstance(): URLEnhancementsManager {
    if (!URLEnhancementsManager.instance) {
      URLEnhancementsManager.instance = new URLEnhancementsManager();
    }
    return URLEnhancementsManager.instance;
  }
  
  /**
   * Parse enhanced URL parameters
   */
  parseEnhancedHash(): EnhancedFilterState {
    // Start with base state
    const baseState = this.urlFilterManager.parseHash();
    const enhancedState: EnhancedFilterState = {
      ...baseState,
      filterActive: null,
      modelConfigs: [],
      userInitialState: undefined,
      aiInitialState: undefined,
      pendingRandomColors: []
    };
    
    if (typeof window === 'undefined') {
      return enhancedState;
    }
    
    const hash = window.location.hash.slice(1);
    if (!hash) return enhancedState;
    
    const params = hash.split('&');
    const seenParams = new Set<string>();
    
    for (const param of params) {
      const [key, value] = param.split('=');
      if (!key || value === undefined) continue;
      
      // Skip duplicates (first wins)
      if (seenParams.has(key)) continue;
      seenParams.add(key);
      
      switch (key) {
        case 'filteractive':
          // Parse filter bar active state
          enhancedState.filterActive = value === 'true';
          console.log('[URLEnhancements] Parsed filteractive:', enhancedState.filterActive);
          break;
          
        case 'model':
          // Parse model configurations (support multiple with +)
          const models = value.split('+');
          enhancedState.modelConfigs = models.map(modelStr => {
            const [modelName, colorPart] = modelStr.split(':');
            const isRandom = colorPart === 'random';
            
            if (isRandom) {
              enhancedState.pendingRandomColors!.push({
                type: 'model',
                modelName: modelName,
                originalParam: modelStr
              });
            }
            
            return {
              modelName: decodeURIComponent(modelName),
              color: colorPart || '',
              isRandom
            };
          });
          break;
          
        case 'uis':
          // Parse user initial state
          const [username, userColor] = value.split(':');
          const userIsRandom = userColor === 'random';
          
          if (userIsRandom) {
            enhancedState.pendingRandomColors!.push({
              type: 'user',
              username: decodeURIComponent(username),
              originalParam: value
            });
          }
          
          enhancedState.userInitialState = {
            username: decodeURIComponent(username),
            color: userIsRandom ? 'pending' : this.parseColorValue(userColor)
          };
          break;
          
        case 'ais':
          // Parse AI initial state
          const [aiName, aiColor] = value.split(':');
          const aiIsRandom = aiColor === 'random';
          
          if (aiIsRandom) {
            enhancedState.pendingRandomColors!.push({
              type: 'ai',
              username: decodeURIComponent(aiName),
              originalParam: value
            });
          }
          
          enhancedState.aiInitialState = {
            username: decodeURIComponent(aiName),
            color: aiIsRandom ? 'pending' : this.parseColorValue(aiColor)
          };
          break;
      }
    }
    
    // Check for random colors in base filter state too
    this.checkForRandomColors(enhancedState);
    
    return enhancedState;
  }
  
  /**
   * Check base filter state for random color requests
   */
  private checkForRandomColors(state: EnhancedFilterState): void {
    // Check user filters for random colors
    state.users.forEach((user, index) => {
      if (user.color === 'pending' || user.color === 'random') {
        state.pendingRandomColors!.push({
          type: 'filter',
          username: user.username,
          originalParam: `u=${user.username}:random`
        });
      }
    });
  }
  
  /**
   * Parse color value (handles 9-digit format and converts to rgb)
   */
  private parseColorValue(colorStr: string): string {
    if (!colorStr || colorStr === 'random') {
      return 'pending';
    }
    
    // If it's 9 digits, convert to rgb
    if (/^\d{9}$/.test(colorStr)) {
      return this.nineDigitToRgb(colorStr);
    }
    
    // If it's already rgb format, return as-is
    if (colorStr.startsWith('rgb(')) {
      return colorStr;
    }
    
    // Default
    return 'rgb(255, 255, 255)';
  }
  
  /**
   * Convert 9-digit format to rgb (copied from URLFilterManager)
   */
  private nineDigitToRgb(digits: string): string {
    if (!/^\d{9}$/.test(digits)) {
      return 'rgb(255, 255, 255)';
    }
    
    const r = parseInt(digits.slice(0, 3), 10);
    const g = parseInt(digits.slice(3, 6), 10);
    const b = parseInt(digits.slice(6, 9), 10);
    
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  /**
   * Convert rgb to 9-digit format
   */
  private rgbToNineDigit(color: string): string {
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = rgbMatch[1].padStart(3, '0');
      const g = rgbMatch[2].padStart(3, '0');
      const b = rgbMatch[3].padStart(3, '0');
      return `${r}${g}${b}`;
    }
    return '255255255';
  }
  
  /**
   * Generate random color in rgb format
   */
  generateRandomColor(): string {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  /**
   * Process pending random colors and update URL
   */
  async processRandomColors(state: EnhancedFilterState): Promise<EnhancedFilterState> {
    if (!state.pendingRandomColors || state.pendingRandomColors.length === 0) {
      return state;
    }
    
    const updatedState = { ...state };
    const colorMap = new Map<string, string>();
    
    // Generate colors for all pending requests
    for (const request of state.pendingRandomColors) {
      const color = this.generateRandomColor();
      colorMap.set(request.originalParam || '', color);
      
      // Update the state with generated colors
      switch (request.type) {
        case 'user':
          if (updatedState.userInitialState) {
            updatedState.userInitialState.color = color;
          }
          break;
          
        case 'ai':
          if (updatedState.aiInitialState) {
            updatedState.aiInitialState.color = color;
          }
          break;
          
        case 'model':
          const modelConfig = updatedState.modelConfigs?.find(
            m => m.modelName === request.modelName
          );
          if (modelConfig) {
            modelConfig.color = color;
            modelConfig.isRandom = false;
          }
          break;
          
        case 'filter':
          const userFilter = updatedState.users.find(
            u => u.username === request.username
          );
          if (userFilter) {
            userFilter.color = color;
          }
          break;
      }
    }
    
    // Clear pending colors
    updatedState.pendingRandomColors = [];
    
    // Update URL with generated colors
    this.updateURLWithColors(updatedState);
    
    return updatedState;
  }
  
  /**
   * Build enhanced URL hash with all parameters
   */
  buildEnhancedHash(state: EnhancedFilterState): string {
    const params: string[] = [];
    
    // Add filteractive parameter
    if (state.filterActive !== null && state.filterActive !== undefined) {
      params.push(`filteractive=${state.filterActive}`);
    }
    
    // Add model configurations
    if (state.modelConfigs && state.modelConfigs.length > 0) {
      const modelStrings = state.modelConfigs.map(model => {
        if (model.color && model.color !== 'pending') {
          const colorDigits = this.rgbToNineDigit(model.color);
          return `${encodeURIComponent(model.modelName)}:${colorDigits}`;
        }
        return encodeURIComponent(model.modelName);
      });
      params.push(`model=${modelStrings.join('+')}`);
    }
    
    // Add user initial state
    if (state.userInitialState) {
      const colorPart = state.userInitialState.color === 'pending' 
        ? 'random' 
        : this.rgbToNineDigit(state.userInitialState.color);
      params.push(`uis=${encodeURIComponent(state.userInitialState.username)}:${colorPart}`);
    }
    
    // Add AI initial state
    if (state.aiInitialState) {
      const colorPart = state.aiInitialState.color === 'pending' 
        ? 'random' 
        : this.rgbToNineDigit(state.aiInitialState.color);
      params.push(`ais=${encodeURIComponent(state.aiInitialState.username)}:${colorPart}`);
    }
    
    // Add base filter state parameters
    const baseHash = this.urlFilterManager.buildHash(state);
    if (baseHash) {
      params.push(baseHash.slice(1)); // Remove leading #
    }
    
    return params.length > 0 ? '#' + params.join('&') : '';
  }
  
  /**
   * Update URL with generated colors
   */
  private updateURLWithColors(state: EnhancedFilterState): void {
    if (typeof window === 'undefined') return;
    
    const hash = this.buildEnhancedHash(state);
    
    // Update URL without triggering hashchange if it's the same
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash || '#');
    }
  }
  
  /**
   * Check if random colors need to be generated
   */
  hasRandomColors(state: EnhancedFilterState): boolean {
    return !!(state.pendingRandomColors && state.pendingRandomColors.length > 0);
  }
  
  /**
   * Merge enhanced state with existing state
   */
  mergeEnhancedState(
    existing: EnhancedFilterState, 
    updates: Partial<EnhancedFilterState>
  ): EnhancedFilterState {
    const merged: EnhancedFilterState = { ...existing };
    
    // Handle filterActive (explicit value takes priority)
    if (updates.filterActive !== undefined) {
      merged.filterActive = updates.filterActive;
    }
    
    // Merge model configs (additive)
    if (updates.modelConfigs) {
      const existingModels = new Set(merged.modelConfigs?.map(m => m.modelName) || []);
      const newModels = updates.modelConfigs.filter(m => !existingModels.has(m.modelName));
      merged.modelConfigs = [...(merged.modelConfigs || []), ...newModels];
    }
    
    // Override user/AI initial states
    if (updates.userInitialState) {
      merged.userInitialState = updates.userInitialState;
    }
    if (updates.aiInitialState) {
      merged.aiInitialState = updates.aiInitialState;
    }
    
    // Merge base filter state
    Object.keys(updates).forEach(key => {
      if (!['filterActive', 'modelConfigs', 'userInitialState', 'aiInitialState', 'pendingRandomColors'].includes(key)) {
        (merged as any)[key] = (updates as any)[key];
      }
    });
    
    return merged;
  }
}
