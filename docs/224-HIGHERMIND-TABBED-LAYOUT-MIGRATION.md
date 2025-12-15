# HigherMind Tabbed Layout Migration

## Overview

This document outlines the migration of the video drawer from `saywhatwant.app` to `highermind.ai`, creating a new tabbed interface with a permanent chat iframe.

---

## Current State

### highermind.ai
```
+------------------------------------------+
|                                          |
|           Gallery Grid                   |
|        (Model Thumbnails)                |
|                                          |
|  Click → Opens fullscreen iframe overlay |
|          with saywhatwant.app            |
|                                          |
+------------------------------------------+
```

### saywhatwant.app
```
+------------------+------------------------+
|                  |                        |
|   Video Drawer   |     Chat Interface     |
|   (9:16 ratio)   |     (Comments Stream)  |
|                  |                        |
|   - Intro videos |                        |
|   - Background   |                        |
|   - Color overlay|                        |
|                  |                        |
+------------------+------------------------+
```

### Current Flow
1. User visits highermind.ai → sees gallery
2. User clicks model thumbnail → iframe overlay opens
3. saywhatwant.app loads with video drawer + chat side by side
4. Intro video plays, then switches to background videos

---

## Proposed State

### New highermind.ai Layout
```
+------+-------------+--------------------------------+
|      |             |                                |
| [🎬] |   Active    |                                |
| [🖼️] |    Tab      |    saywhatwant.app iframe      |
| [ℹ️] |   Content   |    (PERMANENT - always visible)|
|      |             |                                |
|      |  - Video    |    Chat interface only         |
|      |  - Gallery  |    (no video drawer)           |
|      |  - Info     |                                |
|      |             |                                |
+------+-------------+--------------------------------+
  ^         ^                     ^
  |         |                     |
Icons    Left Panel           Right Side
(fixed)  (9:16 ratio)         (flex, fills space)
```

### Layout Specifications

| Element | Width | Behavior |
|---------|-------|----------|
| Icon sidebar | ~48px fixed | Always visible, contains tab icons |
| Left panel | 9:16 aspect ratio | Height = viewport height, width = height × 9/16 |
| Right side (iframe) | Remaining space | `flex: 1` fills available width |

### Three Tabs

#### 1. Video Tab (🎬)
- **Content**: Video player (migrated from saywhatwant.app)
- **Features**:
  - Entity intro videos with audio
  - Background video rotation
  - Color overlay matching user color
  - Brightness/blend mode controls
  - Shuffle/loop modes
  - Breathing animation during buffering
- **Behavior**: Drawer-style animation (slides in/out)
- **Auto-opens**: When user clicks a model in Gallery

#### 2. Gallery Tab (🖼️)
- **Content**: Model thumbnail grid (current homepage content)
- **Features**:
  - Responsive grid of AI model cards
  - Hover effects
  - SEO metadata
- **Behavior**: When clicking a model:
  1. Updates iframe URL to that entity
  2. Auto-switches to Video tab
  3. Plays entity intro video

#### 3. Info Tab (ℹ️)
- **Content**: Empty placeholder (future content)
- **Features**: TBD
- **Behavior**: Standard tab switch

---

## Implementation Plan

### Phase 1: Create Tabbed Layout Structure

#### 1.1 New Components for highermind.ai

```
HIGHERMIND-site/components/
├── Layout/
│   ├── TabSidebar.tsx         # Icon buttons (🎬 🖼️ ℹ️)
│   ├── LeftPanel.tsx          # Container for active tab content
│   └── MainLayout.tsx         # Overall layout wrapper
├── Tabs/
│   ├── VideoTab/
│   │   └── VideoDrawer.tsx    # Migrated video player
│   ├── GalleryTab/
│   │   └── Gallery.tsx        # Model grid (refactored from page.tsx)
│   └── InfoTab/
│       └── InfoPanel.tsx      # Empty placeholder
└── ChatIframe/
    └── PermanentIframe.tsx    # Always-visible saywhatwant iframe
```

#### 1.2 Layout CSS Structure

```css
/* Main container */
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Icon sidebar - fixed width */
.tab-sidebar {
  width: 48px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: /* dark theme */;
}

/* Left panel - 9:16 aspect ratio */
.left-panel {
  height: 100vh;
  width: calc(100vh * 9 / 16);  /* 9:16 from height */
  flex-shrink: 0;
  overflow: hidden;
}

/* Right side - fills remaining space */
.iframe-container {
  flex: 1;
  min-width: 0;
}
```

### Phase 2: Migrate Video Player

#### 2.1 Files to Copy from saywhatwant

| Source File | Destination | Notes |
|-------------|-------------|-------|
| `components/VideoPlayer.tsx` | `HIGHERMIND-site/components/Tabs/VideoTab/VideoDrawer.tsx` | Main component (~800 lines) |
| `config/video-source.ts` | `HIGHERMIND-site/lib/videoSource.ts` | R2 config |
| `modules/colorSystem.ts` | `HIGHERMIND-site/lib/colorSystem.ts` | Color utilities |
| `modules/colorOpacity.ts` | `HIGHERMIND-site/lib/colorOpacity.ts` | Opacity levels |
| `types/index.ts` (VideoItem, VideoManifest) | `HIGHERMIND-site/types/video.ts` | Type definitions |

#### 2.2 Video Drawer Features to Preserve
- [x] R2 video manifest fetching with cache-busting
- [x] Entity intro video detection (`intro-video=true`, `entity=xxx`)
- [x] Background video rotation (shuffle/loop modes)
- [x] Color overlay with user color (RGB)
- [x] Brightness control
- [x] Blend mode selection
- [x] Buffering "breathing" animation
- [x] `canplaythrough` detection before playback
- [x] Muted autoplay → unmute attempt
- [x] Video preloading

#### 2.3 Video Drawer Modifications
- Remove dependencies on saywhatwant URL hash parsing
- Accept props for: `entity`, `userColor`, `showIntro`
- Add drawer animation (slide in/out from left)
- Emit events when intro completes → can notify parent

### Phase 3: Update saywhatwant.app

#### 3.1 Hide Video Drawer When Embedded

Add detection for iframe embedding:

```typescript
// In saywhatwant.app page.tsx or VideoPlayer.tsx
const isEmbedded = window !== window.top; // true if in iframe

// Conditionally render video drawer
{!isEmbedded && showVideo && <VideoPlayer ... />}
```

Or use URL parameter:
```
https://saywhatwant.app/#...&embedded=true
```

```typescript
const isEmbedded = window.location.hash.includes('embedded=true');
```

#### 3.2 Adjust Layout When Embedded
When embedded, chat takes full width (no video column):

```typescript
// page.tsx
const isEmbedded = /* detection */;

return (
  <main className="flex h-screen">
    {!isEmbedded && showVideo && (
      <div style={{ width: 'calc(100vh * 9 / 16)' }}>
        <VideoPlayer ... />
      </div>
    )}
    <div className="flex-1">
      <CommentsStream ... />
    </div>
  </main>
);
```

### Phase 4: Wire Up Tab Interactions

#### 4.1 State Management

```typescript
// In MainLayout.tsx or context
const [activeTab, setActiveTab] = useState<'video' | 'gallery' | 'info'>('gallery');
const [currentEntity, setCurrentEntity] = useState('tsc-grimms-fairy-tales');
const [iframeUrl, setIframeUrl] = useState(buildInitialUrl());

// When model is clicked in Gallery
const handleModelClick = (entity: string, displayName: string) => {
  setCurrentEntity(entity);
  setIframeUrl(buildSayWhatWantURL(displayName, entity));
  setActiveTab('video'); // Auto-switch to video tab
};
```

#### 4.2 Drawer Animation

```typescript
// VideoDrawer with animation
const VideoDrawer = ({ isOpen, entity, userColor }) => {
  return (
    <div 
      className={`
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* Video player content */}
    </div>
  );
};
```

#### 4.3 Communication Between Components

```typescript
// Gallery → Parent → VideoDrawer
// 1. Gallery emits: onModelSelect(entity, displayName)
// 2. Parent updates: currentEntity, iframeUrl, activeTab
// 3. VideoDrawer receives: entity prop, plays intro

// VideoDrawer → Parent
// 1. VideoDrawer emits: onIntroComplete()
// 2. Parent can trigger other actions if needed
```

### Phase 5: Default/Initial State

#### 5.1 Initial Iframe URL
```typescript
const DEFAULT_IFRAME_URL = 'https://saywhatwant.app/#u=Human:222080190-JWOfRZFPZa+GrimmsTales:080155169-hcATkEo4s5&filteractive=true&mt=ALL&uis=Human:222080190-JWOfRZFPZa&ais=GrimmsTales:080155169-hcATkEo4s5&priority=5&entity=tsc-grimms-fairy-tales&embedded=true';
```

#### 5.2 Initial Tab State
- Default tab: Gallery (user sees models first)
- Video drawer: Closed initially
- When user clicks model: Video tab opens with drawer animation

---

## Technical Considerations

### User Color Synchronization
The video overlay color should match the user's color in the chat:
- Option A: Pass color via URL param to highermind.ai
- Option B: Use postMessage between iframe and parent
- Option C: Both sites read from localStorage (same-origin won't work)

**Recommended**: Use URL hash params. When iframe URL is built, include user color.

### Video Manifest Access
- R2 bucket is public: `https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/`
- No CORS issues - highermind.ai can fetch manifest directly
- Same cache-busting approach: `?_=${Date.now()}`

### Entity Intro Video Matching
- Manifest has `isIntro: true` and `entityId: "the-eternal"` fields
- VideoDrawer receives `entity` prop, finds matching intro video
- Falls back to random background if no intro exists

### Mobile Considerations
- Current saywhatwant.app blocks mobile with `MobileBlockScreen`
- New layout: Consider responsive behavior
- Options: Stack vertically on mobile, or maintain mobile block

---

## File Changes Summary

### New Files (HIGHERMIND-site)
```
components/Layout/TabSidebar.tsx
components/Layout/LeftPanel.tsx
components/Layout/MainLayout.tsx
components/Tabs/VideoTab/VideoDrawer.tsx
components/Tabs/GalleryTab/Gallery.tsx
components/Tabs/InfoTab/InfoPanel.tsx
components/ChatIframe/PermanentIframe.tsx
lib/videoSource.ts
lib/colorSystem.ts
lib/colorOpacity.ts
types/video.ts
```

### Modified Files (HIGHERMIND-site)
```
app/page.tsx              # Replace with new MainLayout
app/layout.tsx            # May need adjustments
components/Gallery/*      # Refactor into GalleryTab
```

### Modified Files (saywhatwant)
```
app/page.tsx              # Add embedded detection, hide video when embedded
components/VideoPlayer.tsx # (stays, but unused when embedded)
```

---

## Implementation Checklist

### Phase 1: Layout Structure
- [ ] Create TabSidebar component with 3 icon buttons
- [ ] Create LeftPanel container with 9:16 aspect ratio
- [ ] Create MainLayout wrapper
- [ ] Create PermanentIframe component
- [ ] Set up basic tab switching state

### Phase 2: Video Migration
- [ ] Copy VideoPlayer.tsx to VideoDrawer.tsx
- [ ] Copy supporting modules (colorSystem, etc.)
- [ ] Adapt VideoDrawer to accept props instead of URL parsing
- [ ] Add drawer slide animation
- [ ] Test video playback independently

### Phase 3: Gallery Refactor
- [ ] Extract Gallery from current page.tsx
- [ ] Create Gallery component in GalleryTab
- [ ] Wire up model click → iframe URL update
- [ ] Wire up model click → switch to Video tab

### Phase 4: saywhatwant.app Changes
- [ ] Add embedded detection
- [ ] Hide video drawer when embedded
- [ ] Adjust layout when embedded
- [ ] Test in iframe context

### Phase 5: Integration
- [ ] Test full flow: Gallery → Video → Chat
- [ ] Test intro video playback
- [ ] Test user color synchronization
- [ ] Test back button behavior
- [ ] Deploy and verify

---

## Open Questions

1. **User color source**: Where does highermind.ai get the user color for video overlay?
   - Generate random on highermind.ai?
   - Pass in URL when navigating to highermind.ai?
   
2. **Bookmarkability**: Should URL reflect current tab and entity?
   - e.g., `highermind.ai/#tab=video&entity=the-eternal`

3. **Tab icons**: Use lucide-react icons or custom SVGs?
   - 🎬 → `Film` or `Play`
   - 🖼️ → `Grid` or `LayoutGrid`
   - ℹ️ → `Info`

4. **Drawer behavior**: 
   - Does clicking Video icon toggle drawer open/closed?
   - Or does it always open (click elsewhere to close)?

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|---------------|
| Phase 1: Layout Structure | 2-3 hours |
| Phase 2: Video Migration | 3-4 hours |
| Phase 3: Gallery Refactor | 1-2 hours |
| Phase 4: saywhatwant Changes | 1 hour |
| Phase 5: Integration & Testing | 2-3 hours |
| **Total** | **9-13 hours** |

---

## Related Documentation

- `221-VIDEO-SYSTEM-AND-ENTITY-INTROS.md` - Current video system
- `222-IFRAME-EMBED-OTHER-DOMAINS.md` - Iframe embedding approach
- `223-VIDEO-SYNC-R2-TROUBLESHOOTING.md` - Video sync and manifest
- `00-GIT-CLOUDFLARE-DEPLOYMENT-GUIDE.md` - Deployment procedures

