/**
 * Message Utility Functions
 * 
 * Global utilities for message handling with consistent behavior.
 * Use these EVERYWHERE to ensure consistent message ordering.
 */

import { Comment } from '@/types';

/**
 * CANONICAL MESSAGE SORT ORDER
 * 
 * Messages are ALWAYS sorted oldest→newest (ascending by timestamp)
 * This is "chat style" - oldest at top, newest at bottom
 * 
 * **NEVER use descending sort (b - a) for messages in this app!**
 */

/**
 * Sort messages in canonical order (oldest→newest)
 * 
 * USE THIS FUNCTION for all message sorting to ensure consistency.
 * 
 * @param messages - Array of messages to sort (modifies in place)
 * @returns The same array, sorted oldest→newest
 * 
 * @example
 * const sorted = sortMessagesOldestFirst(messages);
 * // Oldest message at index 0, newest at end
 */
export function sortMessagesOldestFirst(messages: Comment[]): Comment[] {
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Message timestamp comparator for canonical order
 * 
 * Use with Array.sort() for consistent ordering.
 * 
 * @example
 * messages.sort(MESSAGE_TIMESTAMP_COMPARATOR);
 */
export const MESSAGE_TIMESTAMP_COMPARATOR = (a: Comment, b: Comment): number => {
  return a.timestamp - b.timestamp;
};

/**
 * Merge two message arrays and sort in canonical order
 * Removes duplicates based on message ID
 * 
 * @param messages1 - First array of messages
 * @param messages2 - Second array of messages
 * @returns Merged array, sorted oldest→newest, no duplicates
 * 
 * @example
 * const merged = mergeAndSortMessages(existing, newMessages);
 */
export function mergeAndSortMessages(
  messages1: Comment[],
  messages2: Comment[]
): Comment[] {
  // Use Map to remove duplicates
  const messageMap = new Map<string, Comment>();
  
  // Add all messages (later additions overwrite if duplicate ID)
  messages1.forEach(msg => messageMap.set(msg.id, msg));
  messages2.forEach(msg => messageMap.set(msg.id, msg));
  
  // Convert to array and sort
  return Array.from(messageMap.values()).sort(MESSAGE_TIMESTAMP_COMPARATOR);
}

/**
 * Check if two message arrays have same messages (by ID)
 * 
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns true if same message IDs in same order
 */
export function messagesEqual(arr1: Comment[], arr2: Comment[]): boolean {
  if (arr1.length !== arr2.length) return false;
  
  return arr1.every((msg, index) => msg.id === arr2[index].id);
}

/**
 * Get newest N messages from array (assumes already sorted)
 * 
 * @param messages - Sorted array of messages
 * @param count - Number of newest messages to get
 * @returns Array of newest N messages, maintaining sort order
 * 
 * @example
 * const newest50 = getNewestMessages(allMessages, 50);
 * // Returns last 50 messages, still sorted oldest→newest
 */
export function getNewestMessages(messages: Comment[], count: number): Comment[] {
  if (messages.length <= count) return messages;
  
  return messages.slice(-count); // Last N messages
}

/**
 * Get oldest N messages from array (assumes already sorted)
 * 
 * @param messages - Sorted array of messages
 * @param count - Number of oldest messages to get
 * @returns Array of oldest N messages, maintaining sort order
 */
export function getOldestMessages(messages: Comment[], count: number): Comment[] {
  if (messages.length <= count) return messages;
  
  return messages.slice(0, count); // First N messages
}

