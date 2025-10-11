# Questions & Answers with Owner

## 📋 How This Document Works

**Purpose:** Maintain a permanent record of all Q&A, decisions, and context discussions about the testing system and app behavior.

**Format:**
- **Newest entries at the top** (reverse chronological)
- **Timestamp headings** for each conversation session (simple format: `## 2025-10-10 4:45 PM`)
- **Owner responses** go directly under the questions
- **AI reads this file** at the start of testing sessions to understand recent decisions

**Usage:**
1. AI asks questions or presents issues → adds entry with timestamp
2. Owner responds in the same section
3. New conversations push old ones down
4. All context preserved for future reference

**Why this helps:**
- Preserves decision-making context across sessions
- AI can reference past answers without re-asking
- Documents the "why" behind testing choices
- Helps onboard future AI agents or team members

---

## 2025-10-10 4:50 PM

### 5 Failing Tests - Feedback Requested

**Context:** Automated testing system is now complete with 15 tests. 10 passing, 5 failing. All failures appear to be test implementation issues, not app bugs.

**The 5 Issues:**

**1. Color System - "user is assigned a random color on first visit"**
- Issue: `localStorage['sww-color']` returns `null`
- Why: Test checks immediately, before React hydration completes
- Type: Test bug (timing)

**2. Comments Stream - "user color is stored and persists"**
- Issue: Same as #1 - localStorage null
- Why: Same timing issue
- Type: Test bug (timing)

**3. Smoke Test - "no console errors on initial load"**
- Issue: React hydration warning about color style mismatch
- Error: `Server: color:rgb(216,80,178)` vs `Client: color:rgb(150,172,80)`
- Why: Random colors generated on both server and client
- Type: Test too strict (hydration warning is expected/normal)

**4. Comments Stream - "scroll position is maintained"**
- Issue: `scrollTop` is 0 after trying to scroll
- Why: Wrong selector or no scrollable content loaded yet
- Type: Test bug (selector or timing)

**5. Video Player - "video player can be toggled on and off"**
- Issue: Video stays visible (opacity: 1) after clearing localStorage
- Why: Not reloading page after `localStorage.clear()`
- Type: Test bug (missing page reload)

**Pattern Summary:**
- 3 tests: Timing issues (not waiting for React/hydration)
- 1 test: Too strict (filtering needed for expected warnings)
- 1 test: Wrong selector or missing reload

**Question for Owner:** 
What's your feedback on these issues? Should we:
- Fix all 5 now using the established workflow?
- Fix them one at a time as examples?
- Focus on something else first?
- Any specific concerns about the analysis?

**Owner Response:**
[Awaiting response...]

---
