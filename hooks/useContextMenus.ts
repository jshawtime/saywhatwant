/**
 * useContextMenus Hook
 * 
 * Manages context menu state and all menu-related handlers
 * Handles both message context menus and title context menus
 */

import { useState, useCallback, useRef } from 'react';
import { Comment } from '@/types';

interface ContextMenuState {
  x: number;
  y: number;
  comment: Comment;
  clickedWord?: string;
  isUsername?: boolean;
}

interface TitleContextMenuState {
  x: number;
  y: number;
}

interface UseContextMenusParams {
  addNegativeWordFilter: (word: string) => void;
  filteredComments: Comment[];
  domainConfigTitle: string;
}

interface UseContextMenusReturn {
  // State
  contextMenu: ContextMenuState | null;
  titleContextMenu: TitleContextMenuState | null;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setTitleContextMenu: (menu: TitleContextMenuState | null) => void;
  
  // Message context menu handlers
  handleContextMenu: (e: React.MouseEvent, comment: Comment, isUsername: boolean) => void;
  handleTouchStart: (e: React.TouchEvent, comment: Comment, isUsername: boolean) => void;
  handleTouchEnd: () => void;
  handleCopy: () => void;
  handleSave: () => void;
  handleBlock: () => void;
  
  // Title context menu handlers
  handleTitleContextMenu: (e: React.MouseEvent) => void;
  handleCopyAll: () => void;
  handleCopyAllVerbose: () => void;
  handleSaveAll: () => void;
}

export function useContextMenus(params: UseContextMenusParams): UseContextMenusReturn {
  const { addNegativeWordFilter, filteredComments, domainConfigTitle } = params;
  
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [titleContextMenu, setTitleContextMenu] = useState<TitleContextMenuState | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Message context menu handlers
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
          clickedWord = selectedText.replace(/[^a-zA-Z0-9]/g, '');
        }
      }
      
      if (!clickedWord) {
        const target = e.target as HTMLElement;
        const text = target.textContent || '';
        const words = text.trim().split(/\s+/);
        if (words.length <= 5) {
          clickedWord = undefined;
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
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    longPressTimer.current = setTimeout(() => {
      e.preventDefault();
      
      let clickedWord: string | undefined;
      
      if (!isUsername) {
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
      
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }, 500);
  }, []);
  
  const handleTouchEnd = useCallback(() => {
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
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
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
      addNegativeWordFilter(clickedWord);
      console.log('[Context Menu] Blocked word:', clickedWord);
    } else {
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
    if (filteredComments.length === 0) return;
    
    // Get first message timestamp for header
    const firstTimestamp = new Date(filteredComments[0].timestamp).toLocaleString();
    
    // Detect participants (human and AI)
    const humanMessage = filteredComments.find(c => c['message-type'] === 'human');
    const aiMessage = filteredComments.find(c => c['message-type'] === 'AI');
    
    const humanName = humanMessage?.username || 'Human';
    const humanColor = humanMessage?.color || 'unknown';
    const aiName = aiMessage?.username || null;
    const aiColor = aiMessage?.color || 'unknown';
    
    // Build header with participant info
    let header = aiName 
      ? `HigherMind.ai conversation with ${aiName} that began on ${firstTimestamp}\n`
      : `HigherMind.ai conversation that began on ${firstTimestamp}\n`;
    
    header += `${'='.repeat(50)}\n`;
    header += `Human: ${humanName}:${humanColor}\n`;
    if (aiName) {
      header += `AI: ${aiName}:${aiColor}\n`;
    }
    header += `${'='.repeat(50)}\n\n`;
    
    // Format messages (compact - no timestamps)
    const messages = filteredComments.map(comment => {
      return `${comment.username || 'anonymous'}: ${comment.text}`;
    }).join('\n\n');
    
    const fullText = header + messages;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = fullText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    
    console.log(`[Title Context Menu] Copied ${filteredComments.length} messages to clipboard (compact)`);
  }, [filteredComments]);
  
  const handleCopyAllVerbose = useCallback(() => {
    const currentUrl = window.location.href;
    
    const header = `${'='.repeat(50)}
SAY WHAT WANT - DEBUG EXPORT
URL: ${currentUrl}
Exported: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
Total Messages: ${filteredComments.length}
${'='.repeat(50)}

`;

    const messages = filteredComments.map(msg => {
      const lines = [];
      
      // Header line with ID
      lines.push(`${msg.username || 'Anonymous'} [${msg.id}]`);
      
      // Metadata (UTC time to match KV/PM2)
      const utcTime = new Date(msg.timestamp).toISOString().replace('T', ' ').substring(0, 19);
      lines.push(`  Time: ${utcTime} UTC`);
      lines.push(`  Color: ${msg.color || 'N/A'}`);
      
      // For human messages - show botParams
      if (msg['message-type'] === 'human' && msg.botParams) {
        if (msg.botParams.entity) lines.push(`  Entity: ${msg.botParams.entity}`);
        if (msg.botParams.status) lines.push(`  Status: ${msg.botParams.status}`);
        if (msg.botParams.priority !== undefined) lines.push(`  Priority: ${msg.botParams.priority}`);
        if (msg.botParams.ais) lines.push(`  AIS: ${msg.botParams.ais}`);
      }
      
      // For AI messages - show replyTo
      if (msg['message-type'] === 'AI' && msg.replyTo) {
        lines.push(`  ReplyTo: ${msg.replyTo}`);
      }
      
      // Message text
      lines.push(`  Text: ${msg.text}`);
      lines.push(''); // Blank line between messages
      
      return lines.join('\n');
    }).join('\n');

    const fullText = header + messages + '\n' + '='.repeat(50);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = fullText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    
    console.log(`[Title Context Menu] Copied ${filteredComments.length} messages (verbose) to clipboard`);
  }, [filteredComments]);
  
  const handleSaveAll = useCallback(() => {
    if (filteredComments.length === 0) return;
    
    // Get first message timestamp for header
    const firstTimestamp = new Date(filteredComments[0].timestamp).toLocaleString();
    
    // Detect participants (human and AI)
    const humanMessage = filteredComments.find(c => c['message-type'] === 'human');
    const aiMessage = filteredComments.find(c => c['message-type'] === 'AI');
    
    const humanName = humanMessage?.username || 'Human';
    const humanColor = humanMessage?.color || 'unknown';
    const aiName = aiMessage?.username || null;
    const aiColor = aiMessage?.color || 'unknown';
    
    // Build header with participant info
    let header = aiName 
      ? `HigherMind.ai conversation with ${aiName} that began on ${firstTimestamp}\n`
      : `HigherMind.ai conversation that began on ${firstTimestamp}\n`;
    
    header += `${'='.repeat(50)}\n`;
    header += `Human: ${humanName}:${humanColor}\n`;
    if (aiName) {
      header += `AI: ${aiName}:${aiColor}\n`;
    }
    header += `${'='.repeat(50)}\n\n`;
    
    // Format messages (compact - no timestamps)
    const messages = filteredComments.map(comment => {
      return `${comment.username || 'anonymous'}: ${comment.text}`;
    }).join('\n\n');
    
    const fullText = header + messages;
    
    // Build filename with participants and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = aiName
      ? `${aiName}${aiColor}${humanName}${humanColor}_${timestamp}.txt`
      : `${humanName}${humanColor}_${timestamp}.txt`;
    
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
  }, [filteredComments, domainConfigTitle]);
  
  return {
    contextMenu,
    titleContextMenu,
    setContextMenu,
    setTitleContextMenu,
    handleContextMenu,
    handleTouchStart,
    handleTouchEnd,
    handleCopy,
    handleSave,
    handleBlock,
    handleTitleContextMenu,
    handleCopyAll,
    handleCopyAllVerbose,
    handleSaveAll,
  };
}

