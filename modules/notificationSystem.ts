/**
 * Notification System Module
 * Handles audio notifications for filter matches
 * Following "Think, Then Code" philosophy
 */

export type NotificationSound = 'none' | 'delightful' | 'gamer' | 'hello' | 'horn' | 'subtle';

export interface FilterNotificationSettings {
  [filterKey: string]: {
    sound: NotificationSound;
    isUnread: boolean; // Filter is bold when unread
  };
}

class NotificationSystem {
  private audioElements: Map<NotificationSound, HTMLAudioElement> = new Map();
  private lastPlayTime: number = 0;
  private COOLDOWN_MS = 1000;
  private pendingSounds: NotificationSound[] = [];
  private isPlaying = false;

  constructor() {
    this.initializeAudioElements();
  }

  private initializeAudioElements() {
    const sounds: NotificationSound[] = ['delightful', 'gamer', 'hello', 'horn', 'subtle'];
    
    sounds.forEach(sound => {
      const audio = new Audio(`/sww-sfx/${sound}.mp3`);
      audio.preload = 'auto';
      audio.volume = 0.5; // Default 50% volume
      this.audioElements.set(sound, audio);
    });
  }

  /**
   * Play a notification sound with cooldown management
   */
  async playSound(sound: NotificationSound): Promise<void> {
    if (sound === 'none') return;
    
    const audio = this.audioElements.get(sound);
    if (!audio) return;

    // Check cooldown
    const now = Date.now();
    if (now - this.lastPlayTime < this.COOLDOWN_MS) {
      // Queue the sound for later
      this.pendingSounds.push(sound);
      this.processPendingSounds();
      return;
    }

    // Play immediately
    this.lastPlayTime = now;
    try {
      audio.currentTime = 0; // Reset to start
      await audio.play();
      console.log(`[Notification] Played sound: ${sound}`);
    } catch (error) {
      console.warn(`[Notification] Failed to play sound ${sound}:`, error);
    }
  }

  /**
   * Process queued sounds with proper cooldown
   */
  private async processPendingSounds() {
    if (this.isPlaying || this.pendingSounds.length === 0) return;
    
    this.isPlaying = true;
    
    while (this.pendingSounds.length > 0) {
      // Wait for cooldown
      const now = Date.now();
      const timeSinceLastPlay = now - this.lastPlayTime;
      if (timeSinceLastPlay < this.COOLDOWN_MS) {
        await this.sleep(this.COOLDOWN_MS - timeSinceLastPlay);
      }
      
      const nextSound = this.pendingSounds.shift();
      if (nextSound) {
        await this.playSound(nextSound);
      }
    }
    
    this.isPlaying = false;
  }

  /**
   * Play multiple sounds in order (for multiple filter matches)
   */
  async playSoundsInOrder(sounds: NotificationSound[]): Promise<void> {
    // Filter out 'none' and duplicates
    const uniqueSounds = [...new Set(sounds.filter(s => s !== 'none'))];
    
    if (uniqueSounds.length === 0) return;
    
    // Play first immediately, queue the rest
    const [first, ...rest] = uniqueSounds;
    await this.playSound(first);
    
    // Queue remaining sounds
    this.pendingSounds.push(...rest);
    this.processPendingSounds();
  }

  /**
   * Set volume for all notification sounds
   */
  setVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.audioElements.forEach(audio => {
      audio.volume = clampedVolume;
    });
  }

  /**
   * Helper sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if audio is muted globally
   */
  isMuted(): boolean {
    // Check if any audio element is muted
    const firstAudio = this.audioElements.values().next().value;
    return firstAudio ? firstAudio.muted : false;
  }

  /**
   * Set mute state for all sounds
   */
  setMuted(muted: boolean) {
    this.audioElements.forEach(audio => {
      audio.muted = muted;
    });
  }
}

// Singleton instance
let notificationSystem: NotificationSystem | null = null;

export function getNotificationSystem(): NotificationSystem {
  if (!notificationSystem) {
    notificationSystem = new NotificationSystem();
  }
  return notificationSystem;
}

// Helper to generate filter key for localStorage
export function getFilterKey(username: string, color: string): string {
  return `${username}:${color}`;
}

// Load notification settings from localStorage
export function loadNotificationSettings(): FilterNotificationSettings {
  if (typeof window === 'undefined') return {};
  
  try {
    const saved = localStorage.getItem('sww-filter-notifications');
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('[Notification] Failed to load settings:', error);
    return {};
  }
}

// Save notification settings to localStorage
export function saveNotificationSettings(settings: FilterNotificationSettings) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('sww-filter-notifications', JSON.stringify(settings));
  } catch (error) {
    console.error('[Notification] Failed to save settings:', error);
  }
}

// Mark a filter as read (unbold)
export function markFilterAsRead(filterKey: string) {
  const settings = loadNotificationSettings();
  if (settings[filterKey]) {
    settings[filterKey].isUnread = false;
    saveNotificationSettings(settings);
  }
}

// Mark a filter as unread (bold)
export function markFilterAsUnread(filterKey: string) {
  const settings = loadNotificationSettings();
  if (!settings[filterKey]) {
    settings[filterKey] = { sound: 'none', isUnread: true };
  } else {
    settings[filterKey].isUnread = true;
  }
  saveNotificationSettings(settings);
}

// Get or create notification setting for a filter
export function getFilterNotificationSetting(filterKey: string): { sound: NotificationSound; isUnread: boolean } {
  const settings = loadNotificationSettings();
  return settings[filterKey] || { sound: 'none', isUnread: false };
}

// Update notification sound for a filter
export function updateFilterSound(filterKey: string, sound: NotificationSound) {
  const settings = loadNotificationSettings();
  if (!settings[filterKey]) {
    settings[filterKey] = { sound, isUnread: false };
  } else {
    settings[filterKey].sound = sound;
  }
  saveNotificationSettings(settings);
  console.log(`[Notification] Updated ${filterKey} to use sound: ${sound}`);
}
