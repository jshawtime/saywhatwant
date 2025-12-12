# Doc 222: Adding Iframe Embed to Other Domains

> **Created**: December 12, 2025  
> **Status**: Reference Documentation  
> **Purpose**: How to add saywhatwant.app iframe embed to new domains

---

## Overview

This document explains how to manually add the saywhatwant.app iframe embed to domains other than highermind.ai. The iframe approach enables **autoplay with audio** for intro videos.

---

## Why Iframe?

| Approach | Autoplay with Audio |
|----------|---------------------|
| New tab / redirect | ❌ Blocked by browser |
| Iframe with `allow="autoplay"` | ✅ Works |

User clicks on host site → User gesture grants autoplay permission to iframe.

---

## Architecture

```
┌─────────────────────────┐      ┌─────────────────────────┐
│     HOST SITE           │      │     CHAT BACKEND        │
│  (your new domain)      │      │   (always the same)     │
├─────────────────────────┤      ├─────────────────────────┤
│  newdomain.com          │ ───► │  saywhatwant.app        │
│  mybrand.io             │      │                         │
└─────────────────────────┘      └─────────────────────────┘
         │                                   │
    User clicks                        Loaded in iframe
    (grants autoplay)                  (inherits permission)
```

---

## Required Components

### 1. ChatOverlay Component

Full-screen overlay containing the iframe.

**Key attributes:**
```html
<iframe
  src="https://saywhatwant.app/#entity=ENTITY&intro-video=true&..."
  allow="autoplay *; fullscreen; microphone; camera; clipboard-write"
  allowFullScreen
  style="width: 100%; height: 100%; border: none;"
/>
```

The `allow="autoplay *"` is critical - it grants autoplay permission.

### 2. Context/State Management

Track overlay open/close state and the URL to load.

### 3. Click Handler

When user clicks a trigger (button, card, etc.), open the overlay with the appropriate URL.

---

## URL Format

```
https://saywhatwant.app/#u=Human:COLOR1+DisplayName:COLOR2&filteractive=true&mt=ALL&uis=Human:COLOR1&ais=DisplayName:COLOR2&priority=5&entity=ENTITY&intro-video=true
```

### Parameters

| Param | Purpose | Example |
|-------|---------|---------|
| `u` | User filter | `Human:222201080-xxx+TheEternal:080227228-xxx` |
| `filteractive` | Always `true` | `true` |
| `mt` | Message type | `ALL` |
| `uis` | Human identity | `Human:222201080-xxx` |
| `ais` | AI identity | `TheEternal:080227228-xxx` |
| `priority` | Queue priority | `5` |
| `entity` | AI entity ID | `the-eternal` |
| `intro-video` | Play intro | `true` |

### Color Format

19 characters: `RRRGGGBBB-XXXXXXXXXX`

- `RRRGGGBBB`: 9-digit RGB (000-255 each, zero-padded)
- `-`: Separator
- `XXXXXXXXXX`: 10-char alphanumeric suffix

---

## Implementation Steps for New Domain

### Step 1: Create Overlay Component

```typescript
// components/ChatOverlay.tsx
'use client';

import React, { useEffect, useCallback } from 'react';

interface ChatOverlayProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
}

const ChatOverlay: React.FC<ChatOverlayProps> = ({ isOpen, url, onClose }) => {
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[60] p-3 rounded-full bg-white/10 hover:bg-white/20"
        aria-label="Close"
      >
        ✕
      </button>

      {/* Iframe */}
      <iframe
        src={url}
        allow="autoplay *; fullscreen; microphone; camera; clipboard-write"
        allowFullScreen
        className="w-full h-full border-none"
        title="Chat"
      />
    </div>
  );
};

export default ChatOverlay;
```

### Step 2: Create Context (Optional)

```typescript
// context/ChatOverlayContext.tsx
'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

const ChatOverlayContext = createContext(null);

export function ChatOverlayProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');

  const openChat = useCallback((chatUrl: string) => {
    setUrl(chatUrl);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <ChatOverlayContext.Provider value={{ isOpen, url, openChat, closeChat }}>
      {children}
    </ChatOverlayContext.Provider>
  );
}

export const useChatOverlay = () => useContext(ChatOverlayContext);
```

### Step 3: Build URL Function

```typescript
// lib/urlBuilder.ts

function generateColor(): string {
  const r = Math.floor(Math.random() * 256).toString().padStart(3, '0');
  const g = Math.floor(Math.random() * 256).toString().padStart(3, '0');
  const b = Math.floor(Math.random() * 256).toString().padStart(3, '0');
  const suffix = Math.random().toString(36).substring(2, 12);
  return `${r}${g}${b}-${suffix}`;
}

export function buildChatURL(displayName: string, entity: string): string {
  const userColor = generateColor();
  const aiColor = generateColor();
  
  const params = [
    `u=Human:${userColor}+${displayName}:${aiColor}`,
    `filteractive=true`,
    `mt=ALL`,
    `uis=Human:${userColor}`,
    `ais=${displayName}:${aiColor}`,
    `priority=5`,
    `entity=${entity}`,
    `intro-video=true`,
  ].join('&');
  
  return `https://saywhatwant.app/#${params}`;
}
```

### Step 4: Trigger on Click

```typescript
// In your component
const { openChat } = useChatOverlay();

const handleClick = () => {
  const url = buildChatURL('TheEternal', 'the-eternal');
  openChat(url);
};
```

### Step 5: Add to Layout

```tsx
// app/layout.tsx
import { ChatOverlayProvider } from '@/context/ChatOverlayContext';
import ChatOverlay from '@/components/ChatOverlay';

export default function Layout({ children }) {
  return (
    <ChatOverlayProvider>
      {children}
      <ChatOverlayComponent />
    </ChatOverlayProvider>
  );
}

function ChatOverlayComponent() {
  const { isOpen, url, closeChat } = useChatOverlay();
  return <ChatOverlay isOpen={isOpen} url={url} onClose={closeChat} />;
}
```

---

## Reference Implementation

See `HIGHERMIND-site/` for complete working implementation:

| File | Purpose |
|------|---------|
| `components/ChatOverlay/ChatOverlay.tsx` | Overlay component |
| `components/ChatOverlay/ChatOverlayContext.tsx` | State management |
| `lib/urlBuilder.ts` | URL construction |
| `lib/colorSystem.ts` | Color generation |
| `components/Gallery/ModelCard.tsx` | Click handler example |

---

## Bookmarkability (Optional)

To make conversations bookmarkable, sync the hash params to the host URL:

```typescript
// When opening chat
const openChat = (url: string) => {
  const hash = new URL(url).hash;
  window.history.pushState({ chat: true }, '', hash);
  setUrl(url);
  setIsOpen(true);
};

// On page load, check for hash
useEffect(() => {
  if (window.location.hash.includes('entity=')) {
    const url = `https://saywhatwant.app/${window.location.hash}`;
    openChat(url);
  }
}, []);
```

---

## Checklist for New Domain

```
☐ Create ChatOverlay component
☐ Create context/state management
☐ Create URL builder function
☐ Add click handler to trigger
☐ Wrap app in provider
☐ Test autoplay with audio
☐ Test close button / ESC key
☐ Test on mobile
☐ Deploy
```

