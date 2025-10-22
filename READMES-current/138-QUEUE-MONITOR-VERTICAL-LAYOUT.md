# Queue Monitor - Vertical Collapsible Layout Overhaul

**Date:** October 22, 2025 - 9:00 AM PST  
**Status:** ✅ IMPLEMENTATION COMPLETE - READY FOR TESTING  
**Goal:** Transform horizontal panel layout into vertical collapsible sections with resizable heights

---

## 📋 Implementation Status

### ✅ COMPLETED
1. **ResizableSection Component** - Created `/src/components/ResizableSection.tsx`
   - Drag-to-resize functionality with visual feedback
   - Collapse/expand with chevron animation
   - Min/max height constraints (150px - 80% viewport)
   - Smooth transitions and hover effects
   
2. **useSectionState Hook** - Created `/src/hooks/useSectionState.ts`
   - localStorage persistence for heights
   - localStorage persistence for collapsed states
   - Automatic state synchronization
   - Type-safe with TypeScript

3. **App.tsx Refactor** - Completely rewrote main UI component
   - Vertical flex layout (6 sections in order)
   - SYSTEM STATUS → QUEUE ITEMS → KV STORE → LLM SERVER → PM2 LOGS → DEBUG LOGS
   - All sections use ResizableSection component
   - Copy buttons functional with visual feedback
   - Server badges (Ollama vs LM Studio) with color-coding

4. **Global CSS** - Added Section 14 for resizable sections
   - Drag handle styling with 3-line visual indicator
   - Hover/active states for drag handles
   - Section color themes (cyan, green, orange, magenta)
   - Collapse/expand animations
   - Responsive scrollbars

### 🧪 PENDING - User Testing Required
- Deploy to 10.0.0.100
- Test drag-to-resize functionality
- Verify localStorage persistence (refresh browser)
- Confirm all copy buttons work
- Verify section order and initial heights
- Test collapse/expand for all 6 sections

### 🔧 Cache Fix Applied
**Problem:** Browser was caching old CSS, changes not appearing even after hard refresh.

**Solution:**
1. **Changed port from 5173 → 5174** - Forces fresh browser cache
2. **Added `usePolling: true`** in vite.config.ts - Essential for remote editing via SSH
3. **Added `interval: 100`** - Checks for file changes every 100ms
4. **Moved global.css into `src/`** - Ensures Vite watches it properly

**To restart with new port:**
```bash
ssh ms1281@10.0.0.100
cd ~/Desktop/hm-server-deployment/Queue-Monitor-Deploy
bash stop-monitor.sh
bash start-monitor-background.sh
```

**New URL:** http://10.0.0.100:5174

---

## 🎯 What We Have Now

### Current Architecture (Horizontal Grid Layout)

```
┌─────────────────────────────────────────────────────┐
│ HEADER (full width)                                 │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│ LEFT PANEL   │  QUEUE ITEMS (center)               │
│ (System      │                                      │
│  Status)     │                                      │
│              ├──────────────────────────────────────┤
│              │  KV STORE (top right)               │
│              │                                      │
├──────────────┴──────────────┬───────────────────────┤
│ DEBUG LOGS   │ PM2 LOGS     │ LLM REQUESTS         │
│ (25%)        │ (25%)        │ (50%)                │
└──────────────┴──────────────┴───────────────────────┘
```

**Problems:**
1. **Fixed heights** - Can't adjust section sizes based on need
2. **Horizontal clutter** - Information spread across screen
3. **Split focus** - Eye must scan left-right-left
4. **No prioritization** - PM2 logs (most important) share space with debug logs
5. **Can't hide sections** - Everything always visible, even when not needed
6. **Small text** - Had to increase to 300% to be readable across room
7. **Poor for focus** - Can't maximize the section you're debugging

### Current Code Structure

**Files:**
- `App.tsx` - 483 lines with grid layout logic
- `LeftPanel.tsx` - System status component
- `QueueList.tsx` - Queue items component  
- `QueueItem.tsx` - Individual queue item
- CSS in `terminal.module.css` - Grid positioning
- Inline styles throughout

**State Management:**
- WebSocket connection in `useWebSocket` hook
- Expanded/collapsed states for individual items
- No section-level state management
- No height persistence

---

## 🚀 What We Want

### New Architecture (Vertical Collapsible Sections)

```
┌─────────────────────────────────────────────────────┐
│ HEADER (full width, fixed)                          │
├─────────────────────────────────────────────────────┤
│ ▼ SYSTEM STATUS (250px) [CLICK TO COLLAPSE]        │
│   PM2_BOT: RUNNING | LM_SRV: 10.0.0.100            │
│   Priority Bands, PM2 Controls...                   │
├─────────────────────────────────────────────────────┤
│ ▼ QUEUE ITEMS (400px) [DRAG TO RESIZE ═]          │
│   #1 P5 alcohol-addiction [PROC] [OLLAMA 10.0.0.100]│
│   "Hello, I need help..."                           │
├─────────────────────────────────────────────────────┤
│ ▼ KV STORE (300px) [DRAG TO RESIZE ═]             │
│   #1 - 1351654099811 [COPY] ▼                      │
│   {message data...}                                 │
├─────────────────────────────────────────────────────┤
│ ▼ LLM SERVER REQUESTS (300px) [DRAG TO RESIZE ═]  │
│   [8:45:23] #1 - alcohol-addiction | model...      │
├─────────────────────────────────────────────────────┤
│ ▼ PM2 LOGS (500px - PRIMARY FOCUS) [DRAG ═]       │
│   [8:45:20] #409 - Posted as Ulysses...            │
│   (BIG TEXT - 33px, 3 lines per entry)             │
├─────────────────────────────────────────────────────┤
│ ▼ DEBUG LOGS (200px) [DRAG TO RESIZE ═]           │
│   [Dashboard] WebSocket connected...                │
└─────────────────────────────────────────────────────┘
```

**Benefits:**
1. ✅ **Resizable heights** - Drag bottom edge of each section
2. ✅ **Collapsible** - Click header to hide/show (50px when collapsed)
3. ✅ **Full-width sections** - No left-right eye scanning
4. ✅ **Prioritized layout** - PM2 logs get 500px (most important)
5. ✅ **Focus mode** - Collapse everything except what you're debugging
6. ✅ **Independent scrolling** - Each section scrolls its own content
7. ✅ **Persistent state** - Heights and collapsed states saved to localStorage
8. ✅ **Visual feedback** - Drag handle lights up when dragging
9. ✅ **Touch-friendly** - Large headers for clicking
10. ✅ **Logical order** - Top to bottom: Status → Queue → Data → Logs

---

## 🔧 How To Implement

### Phase 1: Create Core Components

#### **A. ResizableSection Component**
**File:** `src/components/ResizableSection.tsx`

**Props:**
```typescript
interface ResizableSectionProps {
  id: string;                  // 'system-status', 'queue-items', etc.
  title: string;               // Display name
  count?: number;              // Optional count (for "QUEUE (2)")
  initialHeight: number;       // Default height in pixels
  children: React.ReactNode;   // Content to render
  headerColor?: string;        // Border/text color (#00FF00, #FF00FF, etc.)
  onHeightChange?: (id, height) => void;  // Callback when dragged
  onToggleCollapse?: (id, collapsed) => void;  // Callback when clicked
  isCollapsed?: boolean;       // Current collapsed state
}
```

**Features:**
- Click header → Toggle collapse (smooth 0.3s transition)
- Drag bottom edge → Resize height
- Min height: 150px, Max height: 80% viewport
- Collapsed height: 50px (header only)
- Visual feedback: Drag handle changes color when dragging
- Mouse events: `onMouseDown` → `onMouseMove` → `onMouseUp`
- Cursor changes to `ns-resize` during drag

**Structure:**
```jsx
<div style={{ height: currentHeight }}>
  <div onClick={toggleCollapse}>  {/* Header */}
    <span>{title} ({count})</span>
    <span>{chevron}</span>
  </div>
  
  {!isCollapsed && (
    <div style={{ flex: 1, overflow: 'auto' }}>  {/* Content */}
      {children}
    </div>
  )}
  
  {!isCollapsed && (
    <div onMouseDown={handleDrag}>  {/* Resize Handle */}
      <div style={{ width: '60px', height: '3px' }} />
    </div>
  )}
</div>
```

#### **B. useSectionState Hook**
**File:** `src/hooks/useSectionState.ts`

**Purpose:** Manage section heights and collapsed states with localStorage persistence

**State Structure:**
```typescript
{
  'system-status': { height: 250, isCollapsed: false },
  'queue-items': { height: 400, isCollapsed: false },
  'kv-store': { height: 300, isCollapsed: false },
  'llm-server': { height: 300, isCollapsed: false },
  'pm2-logs': { height: 500, isCollapsed: false },
  'debug-logs': { height: 200, isCollapsed: false }
}
```

**API:**
```typescript
const {
  sections,         // Current state
  updateHeight,     // (id, height) => void
  toggleCollapse,   // (id, isCollapsed) => void
  resetAll          // () => void - clear localStorage
} = useSectionState();
```

**Storage Key:** `'queue-monitor-sections'`

---

### Phase 2: Refactor App.tsx

#### **Current Structure (Lines 165-478):**
```jsx
<div className={styles.terminal}>
  <Header />
  <LeftPanel />
  <QueueList />
  <div className={styles.rightPanel}>  {/* KV Store */}
  <div className={styles.bottomSection}>  {/* 3 panels */}
  <Footer />
</div>
```

#### **New Structure:**
```jsx
import { ResizableSection } from './components/ResizableSection';
import { useSectionState } from './hooks/useSectionState';

function App() {
  // ... all existing state and logic stays the same ...
  
  const { sections, updateHeight, toggleCollapse } = useSectionState();
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      overflow: 'hidden',
      background: '#000'
    }}>
      {/* Fixed Header */}
      <Header connected={connected} configVersion={stats.configVersion} />
      
      {/* Scrollable Sections Container */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        
        {/* SECTION 1: SYSTEM STATUS */}
        <ResizableSection
          id="system-status"
          title="SYSTEM STATUS"
          initialHeight={sections['system-status'].height}
          headerColor="#00FF00"
          onHeightChange={updateHeight}
          onToggleCollapse={toggleCollapse}
          isCollapsed={sections['system-status'].isCollapsed}
        >
          <LeftPanel stats={stats} />
        </ResizableSection>
        
        {/* SECTION 2: QUEUE ITEMS */}
        <ResizableSection
          id="queue-items"
          title="QUEUE ITEMS"
          count={queue.length}
          initialHeight={sections['queue-items'].height}
          headerColor="#00FFFF"
          onHeightChange={updateHeight}
          onToggleCollapse={toggleCollapse}
          isCollapsed={sections['queue-items'].isCollapsed}
        >
          <QueueList 
            queue={queue}
            onDelete={deleteItem}
            onClearAll={clearQueue}
          />
        </ResizableSection>
        
        {/* SECTION 3: KV STORE */}
        <ResizableSection
          id="kv-store"
          title="KV STORE - NEWEST FIRST"
          count={kvMessages.length}
          initialHeight={sections['kv-store'].height}
          headerColor="#00FF00"
          onHeightChange={updateHeight}
          onToggleCollapse={toggleCollapse}
          isCollapsed={sections['kv-store'].isCollapsed}
        >
          {/* Move existing KV Store JSX here (lines 188-256) */}
        </ResizableSection>
        
        {/* SECTION 4: LLM SERVER REQUESTS */}
        <ResizableSection
          id="llm-server"
          title="LLM SERVER REQUESTS - NEWEST FIRST"
          count={llmRequests.length}
          initialHeight={sections['llm-server'].height}
          headerColor="#FFAA00"
          onHeightChange={updateHeight}
          onToggleCollapse={toggleCollapse}
          isCollapsed={sections['llm-server'].isCollapsed}
        >
          {/* Move existing LLM Requests JSX here (lines 404-475) */}
        </ResizableSection>
        
        {/* SECTION 5: PM2 LOGS (PRIMARY FOCUS) */}
        <ResizableSection
          id="pm2-logs"
          title="PM2 SERVER LOGS"
          count={parsedPm2Logs.length}
          initialHeight={sections['pm2-logs'].height}
          headerColor="#FF00FF"
          onHeightChange={updateHeight}
          onToggleCollapse={toggleCollapse}
          isCollapsed={sections['pm2-logs'].isCollapsed}
        >
          {/* Move existing PM2 Logs JSX here (lines 288-397) */}
          {/* Keep CLEAR, REFRESH, COPY ALL buttons */}
        </ResizableSection>
        
        {/* SECTION 6: DEBUG LOGS */}
        <ResizableSection
          id="debug-logs"
          title="DEBUG LOGS - NEWEST FIRST"
          count={logs.length}
          initialHeight={sections['debug-logs'].height}
          headerColor="#00FF00"
          onHeightChange={updateHeight}
          onToggleCollapse={toggleCollapse}
          isCollapsed={sections['debug-logs'].isCollapsed}
        >
          {/* Move existing Debug Logs JSX here (lines 262-283) */}
        </ResizableSection>
        
      </div>
      
      {/* Optional Footer - could be removed or made collapsible */}
      <Footer connected={connected} lastUpdate={lastUpdate} />
    </div>
  );
}
```

---

### Phase 3: Update CSS (global.css)

**Add new sections:**

```css
/* ============================================
   SECTION 14: RESIZABLE SECTIONS
   ============================================ */

.resizable-section {
  border-bottom: 2px solid #333;
  background: #000;
}

.resizable-section-header {
  height: 50px;
  padding: 0 20px;
  background: #0a0a0a;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.resizable-section-header:hover {
  background: #111;
}

.resizable-section-content {
  flex: 1;
  overflow: auto;
  background: #000;
}

.resize-handle {
  height: 8px;
  background: #222;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.resize-handle:hover {
  background: #444;
}

.resize-handle-active {
  background: var(--color-text-primary);
}

.resize-handle-bar {
  width: 60px;
  height: 3px;
  background: #444;
  border-radius: 2px;
}

.resize-handle-active .resize-handle-bar {
  background: #fff;
}
```

---

### Phase 4: Testing & Validation

**Test Cases:**

1. **Resize Functionality**
   - Drag each section's bottom edge
   - Verify height changes
   - Verify min/max height constraints
   - Verify cursor changes to `ns-resize`

2. **Collapse/Expand**
   - Click each section header
   - Verify smooth animation (0.3s)
   - Verify collapsed height = 50px
   - Verify chevron rotates -90deg

3. **Data Flow**
   - WebSocket updates while section collapsed
   - Data appears when re-expanded
   - No data loss during collapse/expand
   - Counts update in collapsed headers

4. **localStorage Persistence**
   - Resize sections, refresh page → heights restored
   - Collapse sections, refresh page → states restored
   - Clear browser data → defaults restored

5. **Edge Cases**
   - Drag during WebSocket update → no crash
   - Collapse all sections → still navigable
   - Rapid collapse/expand clicks → no race condition
   - Very small viewport → min heights respected

6. **Performance**
   - 60fps during drag (check Chrome DevTools)
   - No jank during collapse animation
   - Memory doesn't grow with resize
   - CPU usage stays low

---

## 📝 Migration Strategy

### Step 1: Create New Components (No Breaking Changes)
- Build `ResizableSection.tsx`
- Build `useSectionState.ts`
- Test in isolation with mock data

### Step 2: Backup Current App.tsx
```bash
cp src/App.tsx src/App.tsx.backup
```

### Step 3: Refactor App.tsx
- Keep ALL existing logic (state, effects, callbacks)
- Only change JSX structure (layout)
- Move content blocks into `<ResizableSection>` wrappers

### Step 4: Update CSS
- Add resizable section styles to `global.css`
- Remove grid layout styles from `terminal.module.css` (if any)

### Step 5: Test Locally
```bash
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy"
npm run dev
```

### Step 6: Deploy to 10.0.0.100
```bash
bash stop-monitor.sh
bash start-monitor-background.sh
```

### Step 7: Validate Production
- Open `http://10.0.0.100:5173`
- Run all test cases
- Monitor for 15 minutes
- Check browser console for errors

---

## 🎯 Success Criteria

✅ **Must Have:**
1. All 6 sections collapsible with click
2. All 6 sections resizable with drag
3. Heights persist in localStorage
4. Collapsed states persist in localStorage
5. PM2 logs text = 33px (readable from across room)
6. No data loss during collapse/expand
7. WebSocket continues working
8. All copy buttons still function
9. No console errors
10. Smooth animations (no jank)

✅ **Should Have:**
1. Visual feedback during drag (handle color change)
2. Cursor changes during drag
3. Smooth collapse animation (0.3s ease)
4. Min/max height constraints enforced
5. Section headers clearly clickable (hover effect)

✅ **Nice to Have:**
1. Keyboard shortcuts to collapse/expand (Ctrl+1, Ctrl+2, etc.)
2. "Reset Layout" button to restore defaults
3. Double-click header to maximize section
4. Drag-to-reorder sections (future enhancement)

---

## 🚨 Known Risks & Mitigations

### Risk 1: Drag Interferes with Scroll
**Problem:** Mouse down on handle might trigger scroll  
**Mitigation:** `e.preventDefault()` on drag start, set `userSelect: 'none'` on body

### Risk 2: WebSocket Update During Drag
**Problem:** New data arrives while user is dragging  
**Mitigation:** State updates don't affect resize handler; height controlled locally during drag

### Risk 3: localStorage Full
**Problem:** Browser storage quota exceeded  
**Mitigation:** Try/catch around localStorage operations, fall back to defaults

### Risk 4: Rapid Clicks Cause Race Condition
**Problem:** Click header multiple times quickly  
**Mitigation:** Collapse state controlled by single source of truth, transitions handle timing

### Risk 5: Very Large Sections Cause Performance Issues
**Problem:** 10,000 PM2 log entries in one section  
**Mitigation:** Already have `useMemo` for parsed logs, virtualization possible in future

---

## 📚 Related Documentation

- `000-READMES-SUMMARIES-ALL.md` - Master index
- `137-QUEUE-MONITOR-ON-10.0.0.100.md` - Deployment guide
- `136-OLLAMA-HM-QUICK-START.md` - Server setup
- `global.css` - Complete stylesheet with all typography

---

## 🔄 Rollback Plan

**If something breaks:**

1. **Quick Fix (restore backup):**
```bash
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy"
cp src/App.tsx.backup src/App.tsx
bash stop-monitor.sh
bash start-monitor-background.sh
```

2. **Clear localStorage (if state corrupted):**
```javascript
// In browser console:
localStorage.removeItem('queue-monitor-sections');
location.reload();
```

3. **Nuclear option (fresh install):**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1
scp -r saywhatwant/dashboards/queue-monitor \
  ms1281@10.0.0.100:"/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy-NEW"
# Then test new version, swap when confirmed working
```

---

**Implementation Status:** DOCUMENTED - Ready to code  
**Estimated Time:** 2-3 hours (think thoroughly, code carefully)  
**Risk Level:** Medium (major layout change, but no data flow changes)

---

*"Think, Then Code. Logic Over Rules. Simple Strong Solid."*

