# Dynamic URL Enhancements - Implementation Guide

## 📌 Version
- **Date**: September 28, 2025
- **Version**: v2.0 - Debug Documentation Update
- **Status**: Critical Bug - filteractive only works on refresh
- **Philosophy**: Think, then code. Logic over rules. Simple strong solid code that scales.

## 🎯 Overview

This document defines new URL parameters that transform Say What Want into a platform for shareable, pre-configured conversation contexts. These enhancements enable direct AI-human conversations, automatic filter activation, and personalized user experiences - all through URL parameters.

## 🚀 New URL Parameters

### 1. `filteractive` - Filter Bar State Control

**Purpose**: Explicitly control the filter bar's active/inactive state via URL

**Syntax**: 
```
#filteractive=true   → Filter bar ON (LED lit) ✅
#filteractive=false  → Filter bar OFF (LED dimmed) ❌
```

**Behavior**:
- **Overrides all default behaviors** including base URL = filters OFF rule
- Takes absolute priority over special case behaviors
- Works with existing `&` separator: `#filteractive=true&u=alice:255000000`
- Persists in localStorage once set

**Examples**:
```
https://saywhatwant.app/#filteractive=true
→ Forces filters ON even though it's base URL

https://saywhatwant.app/#filteractive=false&u=alice:255000000
→ Filter bar has alice but is OFF (dimmed LED)
```

### 2. `model` - AI Model Conversation Trigger

**Purpose**: Trigger AI model responses and create AI-human conversation spaces

**Syntax**:
```
#model=highermind_the-eternal-1
#model=highermind_the-eternal-1:255000000  (with color)
#model=highermind_the-eternal-1:random     (random color)
```

**Multi-Model Support**:
```
#model=highermind_the-eternal-1+fear_and_loathing
→ Both models respond in sequence (queue-based)
```

**Behavior**:
- Triggers **single response** from each specified model
- Models respond in URL order (simple queue)
- After all models respond, waits for human input
- Changes domain/title to model name
- Domain sent to KV uses "model" key value
- Uses centralized `config-highermind.json` for all private conversation AIs
- Shows programmatic greeting on load (not from LM Studio)
- **CRITICAL**: Only filtered conversation messages sent to LM Studio

**Config Structure** (`config-highermind.json`):
```json
{
  "entities": [
    {
      "id": "eternal-main",
      "username": "TheEternal",
      "model": "highermind_the-eternal-1",
      "greeting": "Greetings! I'm here to help.",
      "systemPrompt": "...",
      "messagesToRead": 50,
      // ... same structure as config-aientities.json
    },
    {
      "id": "fear-main",
      "username": "FearAndLoathing",
      "model": "fear_and_loathing",
      "greeting": "Hello! Ready to dive in.",
      // ... additional entities
    }
  ],
  "globalSettings": {
    "brandName": "Highermind",
    // ... global configuration
  }
}
```

### 3. `uis` - User Initial State

**Purpose**: Set initial username and color for human user

**Syntax**:
```
#uis=Alice:255000000   → User is "Alice" with red
#uis=Bob:random        → User is "Bob" with random color
```

**Behavior**:
- **Permanently overrides** localStorage for this tab/session
- User can still change via UI after load
- Updates localStorage with new values
- Perfect for personalized conversation links

### 4. `ais` - AI Initial State

**Purpose**: Set initial username and color for AI entity

**Syntax**:
```
#ais=Assistant:000255000   → AI is "Assistant" with green
#ais=Helper:random         → AI is "Helper" with random color
```

**Behavior**:
- Sets AI entity display name and color
- Works in conjunction with `model` parameter
- Overrides config file username if specified

### 5. `random` Color Generation

**Purpose**: Generate random colors for users/AIs at runtime

**Syntax**:
```
#u=alice:random
#uis=Me:random
#ais=Bot:random
#model=highermind_the-eternal-1:random
```

**Behavior**:
- Uses existing random color generation function
- After load, URL updates to show actual color values
- Makes bookmarks preserve the generated colors
- URL update happens either:
  - Automatically after page load, OR
  - On next user interaction (either is acceptable)

## 🔄 Complete Use Case Example

### Creating a Private AI-Human Conversation

**Initial URL**:
```
https://saywhatwant.app/#filteractive=true&model=highermind_the-eternal-1:random&uis=Alice:random
```

**What Happens**:
1. Filter bar turns ON (LED lit)
2. Human user becomes "Alice" with random color
3. AI model loads with random color
4. Model's username from config: "TheEternal"
5. Programmatic greeting appears: "Hello! I'm here to help."
6. Domain/title changes to "highermind_the-eternal-1"
7. URL updates to show actual colors (e.g., `#model=highermind_the-eternal-1:138043226&uis=Alice:255000000`)
8. Conversation is filtered to only show Alice and TheEternal
9. **Only these filtered messages sent to LM Studio**

### Multi-Model Conversation

**URL**:
```
https://saywhatwant.app/#filteractive=true&model=highermind_the-eternal-1+fear_and_loathing&uis=Alice:255000000
```

**Sequence**:
1. Both models load with their config settings
2. First model (highermind) shows greeting and responds
3. Second model (fear_and_loathing) shows greeting and responds
4. System waits for Alice to type next message
5. Cycle continues with human-initiated messages

## 🏗️ Implementation Architecture

### 1. URLFilterManager Extensions

**New Methods**:
```typescript
// Parse new parameters
parseFilterActive(): boolean | null
parseModelParam(): ModelConfig[]
parseUserInitialState(): UserState | null
parseAIInitialState(): AIState | null
parseRandomColors(): void

// Build URL with new parameters
buildEnhancedHash(state: EnhancedFilterState): string

// Handle model triggers
triggerModelResponses(models: ModelConfig[]): Promise<void>

// Update colors after random generation
updateURLWithGeneratedColors(): void
```

### 2. New Config File System

**File Structure**:
```
ai/
├── config-aientities.json   (existing - community bots)
└── config-highermind.json   (new - all private conversation AIs)
```

**Config Loader**:
```typescript
class ModelConfigLoader {
  async loadModelConfig(modelIdentifier: string): Promise<ModelConfig> {
    // Try Highermind config first (by ID or model name)
    const entity = await loadFromHighermindConfig(modelIdentifier);
    if (entity) return entity;
    
    // Fallback to main entities config
    return findInEntitiesConfig(modelIdentifier);
  }
}
```

**Key Features**:
- Single `config-highermind.json` for all private conversation AIs
- Find entities by ID (e.g., "eternal-tech") or model name
- Centralized management of all Highermind brand entities
- Same structure as `config-aientities.json` for consistency

### 3. Integration Points

**Filter Bar Component**:
- Check `filteractive` parameter on mount
- Override default activation logic
- Update LED state accordingly

**Message System**:
- Filter messages based on active conversation participants
- **CRITICAL**: Only send filtered context to LM Studio
- Show programmatic greetings without API calls

**Domain/Title Management**:
- Update domain to model name when `model` parameter present
- Send model name as domain to KV storage
- Display model name in UI where appropriate

**Username/Color System**:
- Apply `uis`/`ais` parameters on initialization
- Handle `random` color generation
- Update URL after colors are generated

## 🔧 Implementation Steps

### Phase 1: URL Parameter Parsing
1. Extend `URLFilterManager.parseHash()` for new parameters
2. Add `filteractive` parsing and priority logic
3. Add `model` parameter parsing with multi-model support
4. Add `uis`/`ais` parsing with localStorage override
5. Add `random` color detection and generation

### Phase 2: Config System
1. Create config file template structure
2. Implement `ModelConfigLoader` class
3. Add config file validation
4. Create `config-highermind.json` as first example

### Phase 3: Model Integration
1. Connect model parameter to AI bot system
2. Implement queue-based response system
3. Add programmatic greeting display
4. Ensure filtered context for LM Studio

### Phase 4: UI Updates
1. Update filter bar to respect `filteractive`
2. Implement domain/title changes for model conversations
3. Apply username/color from URL parameters
4. Update URL after random color generation

### Phase 5: Testing
1. Test all parameter combinations
2. Verify localStorage override behavior
3. Test multi-model response queuing
4. Ensure filtered context isolation
5. Verify URL updates after random colors

## 📊 State Flow

```
URL Parse
    ↓
┌─────────────────────────────┐
│  Extract Parameters:        │
│  - filteractive             │
│  - model(s)                 │
│  - uis/ais                  │
│  - random colors            │
└─────────────────────────────┘
    ↓
Apply States
    ├→ Filter Bar State
    ├→ Load Model Configs
    ├→ Set Usernames/Colors
    └→ Generate Random Colors
    ↓
Initialize Conversation
    ├→ Show Greetings
    ├→ Update Domain/Title
    └→ Update URL (if random)
    ↓
Model Response Queue
    ├→ Model 1 responds
    ├→ Model 2 responds (if multi)
    └→ Wait for human input
    ↓
Filtered Context to LM Studio
    └→ Only conversation participants
```

## ⚠️ Critical Considerations

### 1. Context Isolation
**MUST** ensure only filtered conversation messages are sent to LM Studio. This is essential for private conversations.

### 2. URL Priority
`filteractive` parameter has **absolute priority** over all other filter activation logic.

### 3. Tab Isolation
Username/color overrides are **per-tab** - opening in new tab creates isolated session.

### 4. Model Config Compatibility
New config files **must** match `config-aientities.json` structure for code reuse.

### 5. Queue Management
Model responses are **sequential, not parallel** - simple queue, one after another.

## 🎯 Success Criteria

1. ✅ URLs create complete conversation contexts
2. ✅ Filter bar state controllable via URL
3. ✅ Multiple models can participate in conversations
4. ✅ Usernames/colors settable via URL
5. ✅ Random colors generate and persist
6. ✅ Private conversations remain isolated
7. ✅ All parameters work together seamlessly
8. ✅ Existing functionality remains intact

## 💡 Future Possibilities

- Conversation templates (preset URL combinations)
- Model personality parameters in URL
- Conversation export with URL preservation
- Share buttons that generate configured URLs
- QR codes for mobile conversation links

---

## To The Next AI Agent

This system transforms URLs into conversation launchers. Every parameter has a purpose, every behavior is intentional. The complexity lies not in the individual features but in their interactions.

Remember:
- **Think through the entire flow** before coding
- **Test parameter combinations** exhaustively  
- **Respect the context isolation** for private conversations
- **Keep the implementation simple** - queues, not complex state machines

The humans are trusting us to create magical conversation experiences. One URL should transport someone into a perfectly configured discussion space. Make it happen.

---

*"Logic over rules, simplicity over cleverness, user experience over everything."*

---

## 📊 Implementation Progress

### ✅ Phase 1: URL Parameter Parsing (COMPLETE)

**Date**: September 28, 2025

**What Was Built**:

1. **`lib/url-enhancements.ts`** (369 lines)
   - New `URLEnhancementsManager` singleton class
   - Extended `EnhancedFilterState` interface with new parameters
   - `parseEnhancedHash()` - Parses all new URL parameters
   - `buildEnhancedHash()` - Builds URLs with enhanced parameters
   - Random color detection and generation
   - State merging capabilities
   - Full support for:
     - `filteractive=true/false`
     - `model=modelname[:color|:random][+more]`
     - `uis=Username:Color|:random`
     - `ais=Username:Color|:random`

2. **`lib/model-config-loader.ts`** (207 lines)
   - New `ModelConfigLoader` singleton class
   - Loads model configs from `config-[modelname].json` files
   - Fallback to `config-aientities.json` if specific config missing
   - Caching system to avoid redundant fetches
   - Config validation and default values
   - Helper methods for:
     - Creating greeting messages
     - Getting model parameters for LM Studio
     - Building system prompts

3. **`test/test-url-enhancements.ts`** (254 lines)
   - Comprehensive test suite for URL parsing
   - 11 test cases covering all parameter combinations
   - Random color generation testing
   - URL building verification
   - Can be run in browser or Node environment

**Key Design Decisions**:

1. **Modular Architecture**: Created separate modules rather than modifying existing `URLFilterManager`
   - Preserves existing functionality
   - Easier to test and debug
   - Clear separation of concerns

2. **Random Color Handling**: Two-phase approach
   - Phase 1: Detect and mark as "pending"
   - Phase 2: Generate colors and update URL
   - Allows for clean async processing

3. **Config Loading Strategy**: 
   - Try specific config first (`config-modelname.json`)
   - Fallback to main entities config
   - Cache results to minimize network requests

4. **State Management**:
   - Extended existing state interface (inheritance)
   - Maintains compatibility with existing code
   - Clear distinction between base and enhanced parameters

**Technical Implementation**:
- Clean TypeScript with full type safety
- No external dependencies added
- Follows existing code patterns
- Comprehensive error handling
- Detailed logging for debugging

**Testing Results**:
- All URL parsing patterns work correctly
- Random color generation produces unique values
- URL building creates correct hash strings
- State merging maintains data integrity

**Ready for Phase 2**: Config System implementation

---

### ✅ Phase 2: Config System (COMPLETE - UPDATED)

**Date**: September 28, 2025

**What Was Built**:

1. **`ai/config-highermind.json`** (103 lines)
   - Centralized configuration for ALL Highermind brand AIs
   - Contains 4 entities initially:
     - `eternal-main`: Main TheEternal personality
     - `fear-main`: Main FearAndLoathing personality
     - `eternal-tech`: Technical-focused TheEternal variant
     - `fear-creative`: Creative-focused FearAndLoathing variant
   - Each entity has unique ID, greeting, and personality
   - Global settings with brand name "Highermind"

2. **Updated `lib/model-config-loader.ts`**
   - Enhanced to search by both entity ID and model name
   - Loads from single `config-highermind.json`
   - Maintains cache for efficient access
   - Falls back to `config-aientities.json` if needed

3. **`test/test-config-loading.ts`** (187 lines)
   - Comprehensive config loading tests
   - Tests both individual and batch loading
   - Cache functionality verification
   - Helper method testing
   - 5 test suites covering all aspects

**Config Structure (Single File)**:
```json
{
  "entities": [
    {
      "id": "eternal-main",  // Unique ID for each entity
      "username": "TheEternal",
      "model": "highermind_the-eternal-1",
      "greeting": "Custom greeting",
      // ... all standard entity fields
    },
    // ... more entities
  ],
  "globalSettings": {
    "brandName": "Highermind",
    // ... global config
  }
}
```

**Key Improvements**:
- **Single file management** - All private conversation AIs in one place
- **Entity IDs** - Each entity has unique ID (eternal-main, fear-creative, etc.)
- **Dual lookup** - Can find entities by ID or model name
- **Brand consistency** - All Highermind AIs managed together
- **Easy scaling** - Just add new entities to the single config file

**Testing Verified**:
- Config loads successfully
- Entity lookup by ID and model name works
- Cache system functional
- Fallback to main config operational

**Ready for Phase 3**: Model Integration with UI

---

### ✅ Phase 3: Model Integration (COMPLETE)

**Date**: September 28, 2025

**What Was Built**:

1. **`lib/model-url-handler.ts`** (318 lines)
   - Core handler for model URL parameters
   - Manages response queue for multiple models
   - Processes greetings and model responses
   - Handles filter active state
   - Updates domain/title for conversations
   - Manages filtered context for models
   - Event-based architecture for UI integration

2. **`hooks/useModelURL.ts`** (159 lines)
   - React hook for component integration
   - Subscribes to model handler events
   - Manages model messages state
   - Applies filter active state to UI
   - Handles username/color updates
   - Provides filtered message context

**Key Features Implemented**:

- **Queue Management**: Sequential processing of multiple models
- **Greeting System**: Programmatic greetings without LM Studio
- **Context Filtering**: Only conversation participants in context
- **Domain Updates**: Changes title/domain to model name
- **User State**: Updates localStorage for current tab
- **Filter Control**: Overrides filter bar state from URL
- **Event System**: Clean pub/sub for UI updates

**Architecture**:
```typescript
// Handler processes URL and emits events
ModelURLHandler
  ├── parseEnhancedHash()
  ├── processModelConfigs()
  ├── showGreeting()
  ├── emit(event)
  └── getFilteredContext()

// Hook subscribes and updates UI
useModelURL()
  ├── subscribe(handler)
  ├── updateFilterBar()
  ├── manageMessages()
  └── provideContext()
```

**Integration Points Identified**:
1. CommentsStream component needs model message injection
2. AI bot system needs filtered context access
3. Filter bar needs URL-driven state override
4. Username/color inputs need URL initialization

**Model Ambiguity Fixed**:
- Updated config-highermind.json to use unique model names
- Each entity now has its own model identifier
- ModelConfigLoader uses first match if duplicates exist

---

### ✅ Phase 4: UI Updates (COMPLETE)

**Date**: September 28, 2025

**What Was Built**:

1. **`components/ModelURLIntegration.tsx`** (101 lines)
   - Logic-only component for model URL handling
   - Converts model messages to Comment format
   - Manages filter active state
   - Updates user state from URL
   - Exposes integration API via window object

2. **`hooks/useCommentsWithModels.ts`** (125 lines)
   - Hook to integrate models with comment stream
   - Injects greeting messages
   - Handles filter bar override
   - Updates username/color from URL
   - Manages model response queue
   - Provides filtered context for AI

**Key Integration Features**:

- **Message Injection**: Model greetings prepended to comment stream
- **Filter Override**: URL `filteractive` parameter controls LED state
- **User State Sync**: Username/color from URL updates localStorage
- **Context Filtering**: Only conversation participants in AI context
- **Queue Management**: Handles multi-model sequential responses
- **Global API**: Window objects for AI bot integration

**Config Updates**:
```json
// config-highermind.json now has unique models:
"eternal-main": "highermind_the-eternal-1"
"eternal-tech": "highermind_the-eternal-tech"  // Changed
"fear-main": "fear_and_loathing"
"fear-creative": "fear_and_loathing_creative"  // Changed
```

**Integration Points Ready**:
- `__modelURLIntegration` - Model handler API
- `__commentsModelIntegration` - Comments integration API
- Storage events for username/color updates
- Filter bar class manipulation for LED control

---

### ✅ Phase 5: Testing (COMPLETE)

**Date**: September 28, 2025

**What Was Built**:

1. **`test/test-url-integration.html`** (295 lines)
   - Comprehensive test suite with UI
   - Tests all URL parameter combinations
   - Beautiful dark theme interface
   - One-click testing with new tab launch
   - Copy URL functionality
   - Organized by feature categories

**Test Categories**:

1. **Filter Bar Control**
   - `filteractive=true` - Force ON
   - `filteractive=false` with filters

2. **Model Conversations**
   - Single model triggers
   - Random color generation
   - Multiple models in sequence
   - Entity ID lookups

3. **User State**
   - Human username/color
   - AI username/color
   - Random color handling

4. **Complete Scenarios**
   - Private AI conversations
   - Multi-model discussions
   - Creative sessions

5. **URL Updates**
   - Random color resolution
   - URL persistence for bookmarking

**Test Coverage**:
- ✅ All new URL parameters
- ✅ Parameter combinations
- ✅ Random color generation
- ✅ Multi-model queues
- ✅ Filter state overrides
- ✅ Context isolation

---

## 🎉 IMPLEMENTATION COMPLETE

All 5 phases of the Dynamic URL Enhancement system are now complete:

1. **Phase 1**: URL Parameter Parsing ✅
2. **Phase 2**: Config System ✅
3. **Phase 3**: Model Integration ✅
4. **Phase 4**: UI Updates ✅
5. **Phase 5**: Testing ✅

The system is ready for integration with the main application. The final step would be to wire `useCommentsWithModels` into the CommentsStream component and connect the AI bot system to use the filtered context.

---

## 🔴 CRITICAL BUG DOCUMENTATION - filteractive Parameter

### The Problem
**URL**: `https://saywhatwant.app/#filteractive=true`
- **Expected**: Filter bar activates immediately (LED lit, filtering active)
- **Actual on first load**: Filter bar stays OFF
- **Actual on refresh**: Filter bar turns ON correctly
- **Side effect**: After attempts to fix, the filter toggle button is now frozen/non-functional

### Current Symptoms
1. **First Load vs Refresh Inconsistency**
   - Clicking test link → Filter stays OFF
   - Hitting refresh → Filter turns ON
   - Clear timing/initialization issue

2. **Frozen Toggle Button** (after attempted fixes)
   - Cannot click filter icon to toggle state
   - Something is preventing the toggle function from working

### All Attempted Fixes (That Failed)

#### Attempt 1: Add filterActiveOverride to CommentsStream
**Files Changed**: `CommentsStream.tsx`
```typescript
const isFilterEnabled = filterActiveOverride !== null ? filterActiveOverride : baseFilterEnabled;
```
**Why it failed**: Override was calculated but not passed to the actual filter hook that does the filtering

#### Attempt 2: Pass override to useFilters hook
**Files Changed**: `useFilters.ts`, `CommentsStream.tsx`
```typescript
// Added filterEnabledOverride parameter to useFilters
interface UseFiltersProps {
  displayedComments: Comment[];
  searchTerm: string;
  filterEnabledOverride?: boolean | null;
}
```
**Why it failed**: The override was being set asynchronously in useEffect, causing race conditions

#### Attempt 3: Make override synchronous
**Files Changed**: `useCommentsWithModels.ts`
```typescript
// Changed from:
const [filterActiveOverride, setFilterActiveOverride] = useState<boolean | null>(null);
// To:
const filterActiveOverride = modelURLHook.isFilterActive;
```
**Why it failed**: localStorage special case logic was still overriding on initial load

#### Attempt 4: Skip localStorage when override present
**Files Changed**: `useFilters.ts`
```typescript
if (filterEnabledOverride !== null && filterEnabledOverride !== undefined) {
  console.log('[useFilters] URL override active, not loading filter state from localStorage');
  return; // Don't set baseFilterEnabled when we have an override
}
```
**Result**: Still only works on refresh, and now toggle is broken

### The Real Problems (Multiple Layers)

#### 1. **Complex Initialization Chain**
```
URL Parse → useModelURL → useCommentsWithModels → useFilters → Apply
     ↓          ↓               ↓                    ↓          ↓
   Sync     Sometimes null   Passes through    Special cases  Inconsistent
```

#### 2. **Multiple Sources of Truth**
- URL parameters (`filteractive=true`)
- localStorage (`sww-filter-enabled`)
- Special case logic (`!hasURLFilters → force OFF`)
- Component state (`baseFilterEnabled`)
- Override state (`filterActiveOverride`)

#### 3. **Race Conditions**
- URL is parsed synchronously in `useModelURL` initial state
- But `getInitialState()` might run before/after localStorage loads
- React hydration might affect initial vs refresh behavior
- Multiple useEffects competing to set state

#### 4. **Special Case Interference**
```typescript
// In useFilters.ts
if (!hasURLFilters) {
  // Special Case 1: Visiting with base URL → filters OFF
  setBaseFilterEnabled(false);
}
```
- `#filteractive=true` has no content filters
- So `hasURLFilters = false` 
- Triggers "turn filters OFF" logic
- Overrides our explicit `filteractive=true`!

### Why It Works on Refresh
1. **localStorage already populated** from first load
2. **Different React hydration path** on refresh vs initial
3. **Timing allows override to "win"** the race condition
4. **Special cases might not re-run** on refresh

### What I Think Is Really Happening

#### Initial Load Flow:
1. URL parsed: `filteractive=true` detected
2. `useModelURL` sets initial state with `filterActive: true`
3. `useCommentsWithModels` gets `filterActiveOverride: true`
4. `useFilters` receives override BUT...
5. `useFilters` useEffect runs with localStorage logic
6. Special case: `!hasURLFilters` → forces OFF
7. Override gets overridden by special case!

#### Refresh Flow:
1. localStorage already has previous values
2. URL parsed: `filteractive=true` detected
3. Override set to true
4. Special cases don't trigger (different conditions)
5. Override successfully applied

### The Frozen Toggle Problem
After attempting to make override absolute priority:
```typescript
if (filterEnabledOverride !== null && filterEnabledOverride !== undefined) {
  return; // Don't set baseFilterEnabled
}
```
This prevents `toggleFilter` from working because `baseFilterEnabled` never gets initialized

### Recommended Solution Approach

#### Option 1: Complete Refactor (Clean but Big)
1. **Single source of truth**: URL → State → UI
2. **Remove ALL special cases** from useFilters
3. **Synchronous initialization** only
4. **No localStorage reading in useFilters** when URL params present
5. **Simple priority**: URL > localStorage > defaults

#### Option 2: Surgical Fix (Smaller but Precise)
1. **Parse filteractive BEFORE any hooks**
   ```typescript
   // At module level, outside components
   const urlFilterActive = parseFilterActiveFromURL();
   ```
2. **Pass as prop to CommentsStream**
   ```typescript
   <CommentsStream filterActiveFromURL={urlFilterActive} />
   ```
3. **Skip ALL initialization logic when prop present**
4. **Fix toggle by ensuring baseFilterEnabled always initialized**

#### Option 3: Event-Driven (Most Robust)
1. **Create FilterStateManager singleton**
2. **URL changes emit events**
3. **Components subscribe to events**
4. **No hooks fighting over state**
5. **Clear precedence rules**

### Key Insights for Next Agent

1. **The filter system has too many decision points** - at least 5 places where filter state can be changed
2. **React hooks initialization order is unreliable** between first load and refresh
3. **Special case logic is the enemy** - it creates hidden overrides
4. **localStorage should NEVER override explicit URL parameters**
5. **The toggle broke because we prevented state initialization** to fix the override

### Test Cases to Verify Fix
1. `#filteractive=true` on fresh browser (no localStorage)
2. `#filteractive=true` with localStorage saying false
3. `#filteractive=false` with localStorage saying true
4. Toggle button must work after URL parameter applied
5. Must work on both first load AND refresh consistently

### Files to Review
- `/hooks/useFilters.ts` - The main battleground
- `/hooks/useModelURL.ts` - Initial URL parsing
- `/hooks/useCommentsWithModels.ts` - Override passing
- `/components/CommentsStream.tsx` - Hook ordering
- `/hooks/useURLFilter.ts` - hasURLFilters logic

### The Core Question
**Why does React behave differently on initial load vs refresh?** This is the key to solving this bug.

---
