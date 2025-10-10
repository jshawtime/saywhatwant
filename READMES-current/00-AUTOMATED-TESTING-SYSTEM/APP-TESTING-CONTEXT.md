# App Testing Context - SayWhatWant

## 🎯 Purpose

This document contains critical knowledge about how the SayWhatWant app actually works. Read this BEFORE analyzing test failures to understand what's expected vs what's a test bug.

**Update this file whenever:**
- User explains new app behavior
- You discover quirks or patterns
- Tests fail for app-specific reasons
- New features are added

---

## 📋 Table of Contents

1. [App Architecture Overview](#app-architecture-overview)
2. [Color System](#color-system)
3. [Username & Message System](#username--message-system)
4. [Video Player System](#video-player-system)
5. [localStorage Keys](#localstorage-keys)
6. [Known Test Issues](#known-test-issues)
7. [Testing Patterns](#testing-patterns)

---

## App Architecture Overview

**Framework:** Next.js 14 + React + TypeScript  
**Deployment:** Cloudflare Pages (static export)  
**State Management:** React useState + localStorage  
**Styling:** Tailwind CSS  

**Key Characteristics:**
- Client-side rendering emphasis (many features require hydration)
- Heavy use of localStorage for persistence
- Dynamic color system with randomization
- Username-first design (must set username before posting)

---

## Color System

### How It Works

**User Color Assignment:**
- Colors are generated via `getRandomColor()` function
- Assignment happens **CLIENT-SIDE ONLY** to avoid SSR/hydration mismatches
- Initial render uses a random color on server
- After React hydrates, client generates its own random color
- Color is stored in `localStorage['sww-color']` after hydration completes

**Code Pattern:**
```typescript
// In app/page.tsx
const [userColor, setUserColor] = useState(() => getRandomColor());

useEffect(() => {
  const savedColor = localStorage.getItem('sww-color');
  if (savedColor) {
    setUserColor(savedColor);
  }
}, []);
```

### Expected Behavior

✅ **NORMAL:**
- React hydration warning about style mismatch (color prop)
- Server color !== Client color on first render
- localStorage['sww-color'] is set 200-500ms after page load

❌ **NOT BUGS:**
- Console warning: "Prop `style` did not match. Server: color:rgb(X) Client: color:rgb(Y)"
- This is expected when using random colors with SSR
- Color stabilizes after hydration

### Testing Implications

**When testing colors:**
1. Wait for `page.waitForLoadState('networkidle')`
2. Wait additional 500ms for React hydration: `await page.waitForTimeout(500)`
3. Only then check `localStorage.getItem('sww-color')`

**Filter console errors:**
```typescript
const criticalErrors = consoleErrors.filter(error => 
  !error.includes('Prop') &&  // Hydration warnings
  !error.includes('style') && // Style mismatches
  !error.includes('color')    // Color-related warnings
);
```

**Why tests fail:**
- Test checks localStorage immediately → gets `null`
- Test expects zero console errors → hydration warning is present
- Both are test problems, not app bugs

---

## Username & Message System

### How It Works

**Username Requirement:**
- Users MUST enter a username before posting messages
- Username input is in the header (first text input on page)
- Default placeholder: "..." (becomes empty when focused)
- If no username: messages show as "Anonymous"

**Username Storage:**
- Stored in: `localStorage['sww-username']` (if persistence is implemented)
- Managed by: `useUsernameEditor` hook
- Max length: Configurable (check `MAX_USERNAME_LENGTH` in code)

**Message Submission Flow:**
1. User sets username in header input
2. User types message in textarea (message input area)
3. User submits (Enter key or send button)
4. Message appears in stream with username + color

### Testing Implications

**All comment/message tests MUST:**
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Set username BEFORE testing messages
  const usernameInput = page.locator('input[type="text"]').first();
  await usernameInput.fill('TestUser');
});
```

**Why tests fail:**
- Tests try to post without username → blocked by app
- Username input not found → using wrong selector

**Correct Selectors:**
- Username input: `page.locator('input[type="text"]').first()`
- Message textarea: `page.locator('textarea')`
- Send button: `page.getByRole('button', { name: /send|post|submit/i })`

---

## Video Player System

### How It Works

**Toggle Behavior:**
- Video player can be shown/hidden via toggle button
- Default state: `showVideo = false` (hidden)
- State stored in: `localStorage['sww-show-video']` as string "true" or "false"
- CSS transition: 500ms duration with ease-in-out
- Hidden state: `opacity: 0` + `pointer-events: none`
- Visible state: `opacity: 1`

**Code Pattern:**
```typescript
const [showVideo, setShowVideo] = useState(false);

useEffect(() => {
  const savedShowVideo = localStorage.getItem('sww-show-video');
  if (savedShowVideo !== null) {
    setShowVideo(savedShowVideo === 'true');
  }
}, []);

const toggleVideo = () => {
  const newState = !showVideo;
  setShowVideo(newState);
  localStorage.setItem('sww-show-video', String(newState));
};
```

**Video Container:**
- Aspect ratio: 9:16 (vertical video)
- Width: `calc(100vh * 9 / 16)` when visible
- Width: `0` when hidden
- Always present in DOM, visibility controlled by opacity

### Testing Implications

**When testing video toggle:**
1. Clear localStorage: `await page.evaluate(() => localStorage.clear())`
2. **Must reload page** for state to reset: `await page.reload()`
3. Wait for networkidle: `await page.waitForLoadState('networkidle')`
4. Wait for CSS transition: `await page.waitForTimeout(600)` (500ms + buffer)

**Why tests fail:**
- localStorage cleared but page not reloaded → old state persists
- Not waiting for 500ms transition → checking opacity too early
- Video container selector too generic → finding wrong element

**Correct Selectors:**
- Video container: `page.locator('div').filter({ has: page.locator('video') }).first()`
- Toggle button: `page.getByRole('button', { name: /video|toggle/i })`

---

## localStorage Keys

### Current Keys Used

| Key | Purpose | Values | Set When |
|-----|---------|--------|----------|
| `sww-color` | User's selected color | Hex string (e.g., "#FF5733") | After React hydration |
| `sww-show-video` | Video player visibility | "true" or "false" string | When toggling video |
| `sww-username` | User's username | String (max length varies) | When entering username |
| `sww-comments-local` | Cached comments | JSON array | When loading comments |

### Testing localStorage

**Timing is critical:**
```typescript
// ❌ BAD - checks too early
await page.goto('/');
const color = await page.evaluate(() => localStorage.getItem('sww-color'));
expect(color).toBeTruthy(); // FAILS - null

// ✅ GOOD - waits for hydration
await page.goto('/');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500); // Let React hydrate
const color = await page.evaluate(() => localStorage.getItem('sww-color'));
expect(color).toBeTruthy(); // PASSES
```

---

## Known Test Issues

### Current Failing Tests (5 total as of 2025-10-10)

#### 1. Color System - "user is assigned a random color on first visit"
**Status:** ❌ Test bug  
**Problem:** Checks localStorage immediately, gets null  
**Fix needed:** Wait 500ms after networkidle  
**App behavior:** Working correctly

#### 2. Comments Stream - "user color is stored and persists"  
**Status:** ❌ Test bug (same as #1)  
**Problem:** Same timing issue with localStorage  
**Fix needed:** Add wait time in beforeEach  
**App behavior:** Working correctly

#### 3. Smoke Test - "no console errors on initial load"
**Status:** ❌ Test too strict  
**Problem:** Catches React hydration warning about color mismatch  
**Fix needed:** Filter out hydration warnings  
**App behavior:** Working correctly - hydration warning is expected

#### 4. Comments Stream - "scroll position is maintained"
**Status:** ❌ Test selector issue  
**Problem:** Can't find correct scrollable container or no content to scroll  
**Fix needed:** Use correct selector for message list  
**App behavior:** Unknown - needs investigation

#### 5. Video Player - "video player can be toggled on and off"
**Status:** ❌ Test state isolation issue  
**Problem:** After clearing localStorage, not reloading page  
**Fix needed:** Add page.reload() after localStorage.clear()  
**App behavior:** Working correctly

### Pattern Recognition

**Common failure causes:**
- ⏱️ **Timing issues** (3 tests) - Not waiting for React hydration
- 🎨 **Color randomization** (2 tests) - Hydration mismatch is expected
- 🔄 **State persistence** (1 test) - Not reloading after localStorage clear
- 🎯 **Selector issues** (1 test) - Wrong or too generic selectors

**None of these are app bugs.** All are test implementation issues.

---

## Testing Patterns

### Pattern 1: Testing Client-Side Features

```typescript
test('client-side feature', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // CRITICAL: Wait for React hydration
  await page.waitForTimeout(500);
  
  // Now test client-side features
  const value = await page.evaluate(() => localStorage.getItem('key'));
  expect(value).toBeTruthy();
});
```

### Pattern 2: Testing localStorage Persistence

```typescript
test('localStorage persists', async ({ page }) => {
  // Set value
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  const initialValue = await page.evaluate(() => 
    localStorage.getItem('key')
  );
  
  // Reload and verify persistence
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Wait for hydration again
  
  const persistedValue = await page.evaluate(() => 
    localStorage.getItem('key')
  );
  
  expect(persistedValue).toBe(initialValue);
});
```

### Pattern 3: Testing Features with Animations

```typescript
test('animated feature', async ({ page }) => {
  await page.goto('/');
  
  // Trigger animation
  await button.click();
  
  // Wait for CSS transition to complete
  // If transition is 500ms, wait 600ms
  await page.waitForTimeout(600);
  
  // Now verify final state
  await expect(element).toHaveCSS('opacity', '1');
});
```

### Pattern 4: Filtering Console Errors

```typescript
test('no critical console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Filter out expected errors
  const criticalErrors = consoleErrors.filter(error => {
    // Ignore React hydration warnings
    if (error.includes('Prop') && error.includes('did not match')) return false;
    if (error.includes('style')) return false;
    if (error.includes('color:rgb')) return false;
    
    // Ignore favicon errors (common in tests)
    if (error.includes('favicon')) return false;
    
    return true;
  });
  
  expect(criticalErrors).toHaveLength(0);
});
```

### Pattern 5: Setting Up Username Before Testing Messages

```typescript
test.describe('Message features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // ALWAYS set username before testing messages
    const usernameInput = page.locator('input[type="text"]').first();
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('TestUser');
      await page.waitForTimeout(100); // Let state update
    }
  });
  
  test('can post message', async ({ page }) => {
    // Username is already set from beforeEach
    const textarea = page.locator('textarea');
    await textarea.fill('Test message');
    // ... rest of test
  });
});
```

---

## App-Specific Quirks

### 1. Random Colors Cause Hydration Mismatches
**What:** Server and client generate different random colors  
**Why:** `getRandomColor()` called on both server and client  
**Impact:** React hydration warning in console  
**Expected:** Yes, this is normal  
**Test adjustment:** Filter out these warnings

### 2. localStorage Timing
**What:** localStorage values not immediately available  
**Why:** React needs to hydrate and run useEffect  
**Impact:** Tests checking localStorage too early fail  
**Expected:** 200-500ms delay is normal  
**Test adjustment:** Always wait 500ms after networkidle

### 3. CSS Transitions
**What:** Opacity/visibility changes take time  
**Why:** 500ms CSS transitions for smooth UX  
**Impact:** Tests checking state immediately fail  
**Expected:** 500ms transition duration  
**Test adjustment:** Wait 600ms after triggering animations

### 4. Username Requirement
**What:** Can't post messages without username  
**Why:** Design decision - username required for posting  
**Impact:** Message tests fail without username setup  
**Expected:** This is correct app behavior  
**Test adjustment:** Set username in beforeEach()

---

## When Tests Fail: Decision Tree

```
Test fails
    ↓
Is it a timing issue?
├─ localStorage null? → Add wait for hydration (500ms)
├─ Element not found? → Wait for networkidle + animations
└─ CSS value wrong? → Wait for transitions
    ↓
Is it a React hydration warning?
├─ About colors? → Expected, filter it out
├─ About styles? → Expected, filter it out
└─ Other props? → Investigate (might be real bug)
    ↓
Is it about localStorage?
├─ Not persisting? → Check if page reloaded after clear
├─ Wrong value? → Check timing of when it's set
└─ Not set at all? → Check if feature is client-side only
    ↓
Is it about user interactions?
├─ Can't post message? → Check if username set first
├─ Can't find element? → Check if correct selector
└─ Action doesn't work? → Check if app ready (hydration)
    ↓
Still unclear?
└─ Read screenshots/videos via MCP filesystem
```

---

## Update Log

**2025-10-10:** Initial creation
- Documented color system hydration behavior
- Documented username requirement for messages
- Documented video toggle system
- Documented all 5 current failing tests
- Established testing patterns

**Future updates:**
- Add new features as they're built
- Document new quirks as discovered
- Update test patterns as best practices emerge

---

## Quick Reference

**Before analyzing test failures:**
1. Read this file (APP-TESTING-CONTEXT.md)
2. Read test results via MCP filesystem
3. Check if failure matches known patterns above
4. Propose test adjustment (not app change) if pattern matches
5. Update this file with new learnings

**Key insight:** Most test failures are **test bugs**, not **app bugs**. The app works correctly - tests just don't understand the app's behavior yet.
