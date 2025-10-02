# AI Agent Refactoring Guide
**How to Plan and Document Code Refactoring**

**Purpose**: This guide teaches AI agents how to write comprehensive refactor plans. It is NOT a refactor plan itself - it's a guide on HOW to create one.

**Audience**: Future AI agents who need to refactor complex codebases

**Philosophy**: "Think deeply, document thoroughly, execute carefully"

---

## 🎯 What Is This Guide?

This is a **meta-guide** - documentation about how to create documentation. When you (an AI agent) are asked to refactor code, this guide teaches you:

1. How to analyze the current codebase
2. How to document what exists
3. How to plan the refactor systematically
4. How to write implementation steps
5. How to identify and mitigate risks
6. How to create code examples
7. How to define success criteria

---

## 📚 Table of Contents

1. [Before You Start: The Analysis Phase](#phase-1-analysis)
2. [Writing the Current State Documentation](#phase-2-current-state)
3. [Creating the Refactor Plan](#phase-3-refactor-plan)
4. [Writing the Implementation Guide](#phase-4-implementation)
5. [Risk Analysis and Mitigation](#phase-5-risks)
6. [Code Examples and Transformations](#phase-6-examples)
7. [Success Criteria and Testing](#phase-7-success)
8. [Document Structure Template](#document-template)

---

## Phase 1: Analysis - Before Writing Anything

### Step 1.1: Read the Codebase Thoroughly

**What to do**:
```
1. Read the file(s) to be refactored completely
2. Read all imported dependencies
3. Read all files that import this file
4. Understand the complete data flow
5. Identify all external dependencies
```

**Tools to use**:
- `read_file` - Read files completely
- `codebase_search` - Find usages and dependencies
- `grep` - Search for patterns

**Questions to answer**:
- What does this code actually do?
- What are the inputs and outputs?
- What state does it manage?
- What side effects does it have?
- Who depends on this code?
- What does it depend on?

**Document nothing yet** - just understand.

---

### Step 1.2: Identify the Pain Points

**What to look for**:
- File size (lines of code)
- Number of responsibilities
- Complexity indicators:
  - Deep nesting
  - Long functions
  - Many state variables
  - Complex conditional logic
  - Repeated patterns

**Metrics to collect**:
```typescript
// Example metrics template
{
  fileSize: number,           // Total lines
  responsibilities: string[], // List of distinct things it does
  stateVariables: number,     // Count of useState/state
  hookCount: number,          // Number of hooks used
  functionCount: number,      // Number of functions defined
  renderComplexity: 'low' | 'medium' | 'high',
  testability: 'easy' | 'moderate' | 'difficult'
}
```

---

### Step 1.3: Understand the "Why"

**Critical questions**:
1. **Why does this need refactoring?**
   - Too large?
   - Hard to understand?
   - Hard to test?
   - Performance issues?
   - Maintainability?

2. **What will improve after refactoring?**
   - Readability?
   - Testability?
   - Reusability?
   - Performance?
   - Maintainability?

3. **What could go wrong?**
   - Breaking changes?
   - Performance regression?
   - Increased complexity?
   - Lost functionality?

**If you can't answer these questions clearly, stop and ask the human.**

---

## Phase 2: Current State - Document What Exists

### Section 2.1: Executive Summary

Write 3-5 sentences that explain:
1. What file/component you're refactoring
2. What its primary purpose is
3. Why it needs refactoring
4. What the refactor will achieve

**Template**:
```markdown
## Executive Summary

**File**: `path/to/Component.tsx` (X lines)

**Purpose**: [What this component does in one sentence]

**Problem**: [Why it needs refactoring in one sentence]

**Goal**: [What the refactor will achieve in one sentence]

**Status**: PLANNING PHASE
```

**Example**:
```markdown
## Executive Summary

**File**: `components/UserDashboard.tsx` (2,450 lines)

**Purpose**: Main user dashboard displaying profile, activity feed, and settings.

**Problem**: Monolithic component handling too many responsibilities - hard to maintain and test.

**Goal**: Break into focused components, reduce to <500 lines, improve testability.

**Status**: PLANNING PHASE
```

---

### Section 2.2: Current Architecture Analysis

**What to document**:

1. **File Structure**
   - Current line count
   - Sections within the file
   - Line ranges for each section

2. **Responsibilities List**
   - Everything this code does
   - Group related responsibilities

3. **Dependencies Map**
   - What it imports (external)
   - What it imports (internal)
   - What imports it

4. **State Management**
   - All state variables
   - Where each is used
   - Why each exists

5. **Data Flow**
   - How data enters the component
   - How data is transformed
   - How data leaves the component

**Template**:
```markdown
## Current State Analysis

### File Structure (2,450 lines)

**Lines 1-50**: Imports and type definitions
**Lines 51-200**: State management (30+ useState declarations)
**Lines 201-800**: Hook integrations (15 custom hooks)
**Lines 801-1200**: Event handlers (40+ functions)
**Lines 1201-1800**: Helper functions and utilities
**Lines 1801-2450**: Render/JSX (multiple sections)

### Responsibilities

This component currently handles:
1. **User Profile Display** - Shows user info, avatar, bio
2. **Activity Feed** - Loads and displays user activities
3. **Settings Panel** - Manages user preferences
4. **Notifications** - Real-time notification system
5. **Search** - Filters activities and connections
6. **Navigation** - Tab switching between sections
7. **Data Fetching** - API calls for all data
8. **Error Handling** - Error states for all operations
9. **Loading States** - Loading indicators for all sections
10. **Form Submission** - Profile updates, settings changes

### Dependencies

**External Libraries**:
- React (useState, useEffect, useCallback, useMemo, useRef)
- react-router-dom (useNavigate, useParams)
- axios (API calls)

**Internal Modules**:
- `@/hooks/useAuth`
- `@/hooks/useNotifications`
- `@/api/userService`
- `@/components/Avatar`
- `@/components/Button`
- `@/utils/dateFormatter`

**Used By**:
- `pages/Dashboard.tsx`
- `pages/Profile.tsx`

### State Management (30 variables)

1. `user` - Current user object
2. `activities` - User activity feed
3. `settings` - User preferences
4. `notifications` - Notification list
5. `isLoading` - Global loading state
6. `error` - Global error state
... [document ALL state]

### Data Flow

```
User Action (click/type)
  ↓
Event Handler
  ↓
State Update
  ↓
API Call (if needed)
  ↓
Response Processing
  ↓
State Update
  ↓
Re-render
```
```

---

### Section 2.3: How It Currently Works

Write a detailed explanation of the current implementation:

**Template**:
```markdown
## How It Currently Works

### Flow 1: [Feature Name]

**User Action**: [What the user does]

**Code Path**:
1. Component receives [input/props]
2. [Hook/function] processes [data]
3. State updates to [new value]
4. [Side effect] occurs
5. Component re-renders with [output]

**Example Code** (current implementation):
```typescript
// Show actual code from the file
const handleUserAction = () => {
  // ... actual implementation
};
```

**Problems**:
- Issue 1: [Why this is problematic]
- Issue 2: [Why this is problematic]
```

**Write this for EVERY major feature/flow**. Be comprehensive.

---

### Section 2.4: What Already Exists

Document any previous refactoring work:

**Template**:
```markdown
## Existing Refactored Components

### Already Extracted:
1. **ComponentName** (`path/to/Component.tsx`) - Description
2. **HookName** (`hooks/useHook.ts`) - Description

### Existing Utilities:
1. **UtilityName** (`utils/utility.ts`) - Description

### What's Working Well:
- [List things that don't need to change]

### What Needs Improvement:
- [List things that still need refactoring]
```

---

## Phase 3: Refactor Plan - What You'll Do

### Section 3.1: Goals and Objectives

**Template**:
```markdown
## Refactor Goals

### Primary Objectives

1. **[Goal 1]**
   - Specific metric: [e.g., "Reduce file size from 2,450 to <500 lines"]
   - Why: [Why this matters]
   - How: [High-level approach]

2. **[Goal 2]**
   - Specific metric: [Measurable target]
   - Why: [Why this matters]
   - How: [High-level approach]

### Secondary Objectives

1. **[Nice-to-have goal]**
   - Why: [Why this would be good]
   - Priority: [Low/Medium/High]

### Non-Goals

- [Things you explicitly will NOT do in this refactor]
- [Features you will NOT change]
```

**Example**:
```markdown
## Refactor Goals

### Primary Objectives

1. **Break Monolith into Focused Components**
   - Specific metric: Reduce UserDashboard from 2,450 to <500 lines
   - Why: Improves maintainability, testability, and onboarding
   - How: Extract 6 major components, create 4 consolidated hooks

2. **Improve Testability**
   - Specific metric: Make all components unit-testable
   - Why: Enable TDD and catch regressions early
   - How: Clear props interfaces, no hidden dependencies

### Non-Goals

- We will NOT change the UI/UX
- We will NOT modify the API contracts
- We will NOT change the data models
```

---

### Section 3.2: Proposed Architecture

Draw the new structure:

**Template**:
```markdown
## Proposed Architecture

### The New Structure

```
ParentComponent (Container - 500 lines)
├── Orchestrates state and data
├── Manages complex business logic
├── Passes props to children
└── No UI rendering (only composition)

PresentationComponents (Simple, Focused)
├── ComponentA (100 lines) - Single responsibility
├── ComponentB (150 lines) - Single responsibility
├── ComponentC (80 lines) - Single responsibility
└── Each has clear props interface
```

### Component Hierarchy

```
UserDashboard (Container)
│
├── ProfileSection
│   ├── Avatar
│   ├── UserInfo
│   └── EditButton
│
├── ActivityFeed
│   ├── ActivityItem (repeated)
│   └── LoadMoreButton
│
├── SettingsPanel
│   ├── SettingItem (repeated)
│   └── SaveButton
│
└── NotificationsBar
    └── NotificationItem (repeated)
```

### Data Flow

```
Parent manages state
  ↓
Passes data and callbacks as props
  ↓
Children render UI only
  ↓
User interacts with children
  ↓
Callbacks fire back to parent
  ↓
Parent updates state
  ↓
Props change, children re-render
```
```

---

### Section 3.3: Component Extraction Plan

For **EACH** component you'll extract, write:

**Template**:
```markdown
### Component: [ComponentName]

**Purpose**: [One sentence - what this component does]

**Current Location**: Lines X-Y in original file

**Priority**: [HIGH/MEDIUM/LOW]

**Complexity**: [SIMPLE/MODERATE/COMPLEX]

**Responsibilities**:
- [Specific thing 1]
- [Specific thing 2]
- [Specific thing 3]

**Props Interface**:
```typescript
interface ComponentNameProps {
  // Data props
  dataField: Type;
  
  // Callback props
  onAction: (param: Type) => void;
  
  // Refs (if needed)
  elementRef?: React.RefObject<HTMLElement>;
  
  // Optional props
  optionalThing?: Type;
}
```

**Sub-Components** (if needed):
- SubComponentA - [What it does]
- SubComponentB - [What it does]

**Why Extract**:
- Reason 1: [Specific benefit]
- Reason 2: [Specific benefit]
- Reason 3: [Specific benefit]

**Files to Create**:
- `components/ComponentName/ComponentName.tsx` (main component)
- `components/ComponentName/SubComponent.tsx` (if needed)
- `components/ComponentName/index.ts` (exports)

**Dependencies**:
- External: [Library names]
- Internal: [Component/hook names]

**Testing Considerations**:
- Test case 1: [What to test]
- Test case 2: [What to test]
- Edge case: [What could break]
```

**Write this section for EVERY component you plan to extract.**

---

### Section 3.4: Hook Consolidation Plan

For **EACH** hook you'll create/consolidate, write:

**Template**:
```markdown
### Hook: [useHookName]

**Purpose**: [One sentence - what this hook manages]

**Current State** (scattered in component):
```typescript
// Show current scattered implementation
const [state1, setState1] = useState();
const [state2, setState2] = useState();
// Multiple places managing related state
```

**New Hook Interface**:
```typescript
interface HookReturn {
  // State
  state: StateType;
  
  // Actions
  doSomething: () => void;
  updateSomething: (value: Type) => void;
  
  // Derived values
  isReady: boolean;
  errorMessage: string | null;
}

export function useHookName(
  param1: Type,
  param2?: Type
): HookReturn {
  // Implementation details
}
```

**What It Consolidates**:
- State variable 1: [What it manages]
- State variable 2: [What it manages]
- Function 1: [What it does]
- Function 2: [What it does]

**Why Consolidate**:
- Reason 1: [Specific benefit]
- Reason 2: [Specific benefit]

**Files to Create**:
- `hooks/useHookName.ts`
- `hooks/useHookName.test.ts` (future)

**Dependencies**:
- React hooks: [which ones]
- Other hooks: [if any]
- Utilities: [if any]

**Testing Considerations**:
- Test initial state
- Test actions
- Test edge cases
```

---

## Phase 4: Implementation - Step-by-Step Guide

### Section 4.1: Extraction Sequence

**Template**:
```markdown
## Implementation Plan

### Sequence Overview

**Phase A**: [Name] (Timeline)
- Step 1: [Component/Hook name]
- Step 2: [Component/Hook name]
- Step 3: [Component/Hook name]

**Phase B**: [Name] (Timeline)
- Step 4: [Component/Hook name]
- Step 5: [Component/Hook name]

**Phase C**: [Name] (Timeline)
- Step 6: [Cleanup task]
- Step 7: [Documentation]

### Ordering Strategy

Extract in this order because:
1. **Simplest first** - Build confidence, find patterns
2. **Low-risk next** - Self-contained, few dependencies
3. **Complex last** - Now you understand the system

### Dependencies Between Steps

- Step 2 depends on Step 1
- Step 5 depends on Steps 3 and 4
- Steps 1-4 can be done independently
```

---

### Section 4.2: Detailed Step Instructions

For **EACH** step, write:

**Template**:
```markdown
### Step [N]: [Action Description]

**What**: [One sentence - what you're doing]

**Priority**: [HIGH/MEDIUM/LOW]

**Risk**: [LOW/MEDIUM/HIGH]

**Estimated Complexity**: [SIMPLE/MODERATE/COMPLEX]

**Detailed Instructions**:

1. **Create the new file**
   ```bash
   # Command to create file
   mkdir -p components/ComponentName
   touch components/ComponentName/ComponentName.tsx
   ```

2. **Define the interface**
   ```typescript
   // Copy from Props Interface section above
   interface ComponentNameProps {
     // ...
   }
   ```

3. **Copy the UI code**
   - From original file lines X-Y
   - Paste into new component
   - Fix imports

4. **Update the props**
   - Replace hardcoded values with props
   - Add prop destructuring
   - Add TypeScript types

5. **Test the component**
   - Import in original file
   - Replace inline code with <ComponentName />
   - Pass props
   - Verify build succeeds
   - Verify functionality works

6. **Clean up**
   - Remove old code from original file
   - Update imports
   - Run linter
   - Fix any errors

**Verification Checklist**:
- [ ] Build succeeds
- [ ] TypeScript has no errors
- [ ] Linter has no warnings
- [ ] Component renders correctly
- [ ] All interactions work
- [ ] No console errors
- [ ] Props flow correctly

**Rollback Plan**:
If this breaks, revert by:
1. `git checkout -- [changed files]`
2. Fix the issue
3. Try again

**Commit Message**:
```
Extract [ComponentName] from [ParentComponent]

- Created components/ComponentName/ComponentName.tsx
- Moved lines X-Y from ParentComponent
- Added TypeScript interface
- All functionality preserved
- Build succeeds, tests pass
```
```

**Write this for EVERY step in your sequence.**

---

## Phase 5: Risks - What Could Go Wrong

### Section 5.1: Risk Identification

**Template**:
```markdown
## Risk Analysis

### Risk 1: [Risk Name]

**Description**: [What could go wrong]

**Likelihood**: [LOW/MEDIUM/HIGH]

**Impact**: [LOW/MEDIUM/HIGH]

**Mitigation Strategy**:
1. [Specific action to prevent/reduce risk]
2. [Specific action to prevent/reduce risk]
3. [Backup plan if it happens]

**Detection**:
- How to know if this risk is happening
- What symptoms to watch for

**Recovery Plan**:
- Step-by-step recovery if this occurs
```

**Example**:
```markdown
### Risk 1: Breaking Existing Functionality

**Description**: Extraction introduces bugs or breaks features

**Likelihood**: MEDIUM

**Impact**: HIGH

**Mitigation Strategy**:
1. Extract one component at a time
2. Test thoroughly after each extraction
3. Commit after each successful step
4. Keep git history clean for easy rollback
5. Test on real data, not just dev data

**Detection**:
- Build fails
- TypeScript errors appear
- Features stop working
- Console errors
- User reports issues

**Recovery Plan**:
1. `git log` to see last commit
2. `git revert [commit-hash]` to undo
3. Analyze what went wrong
4. Fix the issue
5. Try extraction again
```

**Identify at least 5 risks** - think deeply about what could break.

---

## Phase 6: Examples - Show the Transformation

### Section 6.1: Before & After Code

For **EVERY major extraction**, show:

**Template**:
```markdown
## Code Examples

### Example: [Feature Name]

**Before** (in monolithic component):

```typescript
// Show 30-50 lines of actual code
// Include:
// - State management
// - Event handlers
// - Render logic
// Show the complexity and mixing of concerns

const ParentComponent = () => {
  const [state1, setState1] = useState();
  const [state2, setState2] = useState();
  
  const handleSomething = () => {
    // Complex logic here
  };
  
  return (
    <div>
      {/* Complex JSX here */}
    </div>
  );
};
```

**After** (extracted):

```typescript
// Hook file (hooks/useFeature.ts)
export function useFeature() {
  const [state1, setState1] = useState();
  const [state2, setState2] = useState();
  
  const handleSomething = useCallback(() => {
    // Same logic, now in hook
  }, [dependencies]);
  
  return { state1, state2, handleSomething };
}

// Component file (components/Feature/Feature.tsx)
interface FeatureProps {
  // Clear props interface
}

export const Feature: React.FC<FeatureProps> = ({
  prop1,
  prop2,
  onAction
}) => {
  return (
    <div>
      {/* Clean, focused JSX */}
    </div>
  );
};

// Parent file (now cleaner)
const ParentComponent = () => {
  const { state1, state2, handleSomething } = useFeature();
  
  return (
    <>
      <Feature
        prop1={state1}
        prop2={state2}
        onAction={handleSomething}
      />
    </>
  );
};
```

**Benefits**:
- ✅ **Clarity**: Feature logic is separate from presentation
- ✅ **Testability**: Hook and component testable independently
- ✅ **Reusability**: Component can be used elsewhere
- ✅ **Maintainability**: Easy to find and modify feature code
- ✅ **Type Safety**: Clear interfaces with TypeScript
```

**Show at least 3 complete before/after examples** - they're the most valuable part of your document.

---

## Phase 7: Success - How to Measure

### Section 7.1: Metrics

**Template**:
```markdown
## Success Criteria

### Quantitative Metrics

**Before Refactor**:
- Main file: X lines
- Components: Y
- Hooks: Z
- Average component size: A lines
- Build time: B seconds
- Type errors: C

**After Refactor** (Target):
- Main file: X lines (Z% reduction)
- Components: Y (N new)
- Hooks: Z (M new)
- Average component size: A lines
- Build time: B seconds (no regression)
- Type errors: 0

### Qualitative Metrics

- ✅ **Readability**: Can a new developer understand the flow?
- ✅ **Maintainability**: Can features be found and modified easily?
- ✅ **Testability**: Can components be tested in isolation?
- ✅ **Reusability**: Can components be used in other contexts?
- ✅ **Performance**: No rendering/speed regressions?

### Zero Breaking Changes

**All features must work exactly as before**:
- [ ] Feature 1 works
- [ ] Feature 2 works
- [ ] Feature 3 works
- [ ] Edge case 1 handled
- [ ] Edge case 2 handled
- [ ] Error states work
- [ ] Loading states work
- [ ] Mobile works
- [ ] Desktop works

### Testing Checklist

**Manual Testing**:
1. [Test scenario 1]
2. [Test scenario 2]
3. [Test scenario 3]
4. [Test edge case 1]
5. [Test error state 1]

**Automated Testing** (if exists):
- [ ] All existing tests pass
- [ ] New tests written for extracted components
- [ ] Coverage maintained or improved
```

---

## Document Template - Complete Structure

When you write a refactor README, use this structure:

```markdown
# [Component/File Name] Refactor Plan

**Date**: [Current Date]
**Status**: PLANNING
**Current Size**: X lines
**Target Size**: Y lines

---

## Executive Summary

[3-5 sentences explaining what, why, and how]

---

## Table of Contents

1. [Current State Analysis](#current-state)
2. [How It Currently Works](#how-it-works)
3. [Refactor Goals](#goals)
4. [Proposed Architecture](#architecture)
5. [Component Extraction Plan](#components)
6. [Hook Consolidation Plan](#hooks)
7. [Implementation Sequence](#implementation)
8. [Risk Analysis](#risks)
9. [Code Examples](#examples)
10. [Success Criteria](#success)

---

## Current State Analysis

[Section 2.2 template]

---

## How It Currently Works

[Section 2.3 template - flows and examples]

---

## Refactor Goals

[Section 3.1 template]

---

## Proposed Architecture

[Section 3.2 template - diagrams and flow]

---

## Component Extraction Plan

[Section 3.3 template - one per component]

---

## Hook Consolidation Plan

[Section 3.4 template - one per hook]

---

## Implementation Sequence

[Section 4.1 and 4.2 templates]

---

## Risk Analysis

[Section 5.1 template - multiple risks]

---

## Code Examples

[Section 6.1 template - before/after]

---

## Success Criteria

[Section 7.1 template - metrics and testing]

---

## Commit Strategy

```bash
# Step 1
git commit -m "[Commit message]"

# Step 2
git commit -m "[Commit message]"

# Final
git tag -a vX.Y -m "[Tag message]"
```

---

## References

- [Link to related documentation]
- [Link to similar refactors]
- [Link to coding standards]

---

*Created by: [Your Name/Model]*
*For: [Project Name]*
*Purpose: [Brief description]*
```

---

## Quality Checklist - Before Publishing

Before you publish your refactor plan, verify:

### Completeness

- [ ] Executive summary is clear and concise
- [ ] Current state is thoroughly documented
- [ ] All major features/flows are explained
- [ ] Every component has a detailed extraction plan
- [ ] Every hook has a detailed consolidation plan
- [ ] Implementation steps are numbered and sequential
- [ ] Each step has verification and rollback plans
- [ ] At least 5 risks identified with mitigation
- [ ] At least 3 before/after code examples
- [ ] Success criteria are specific and measurable
- [ ] Zero breaking changes list is comprehensive

### Clarity

- [ ] A new developer could understand the refactor
- [ ] Examples use realistic code (not pseudo-code)
- [ ] TypeScript interfaces are complete
- [ ] Component hierarchies are visualized
- [ ] Data flows are diagrammed
- [ ] Technical terms are explained

### Accuracy

- [ ] Line numbers match actual file
- [ ] Code examples compile
- [ ] Imports are correct
- [ ] Props interfaces are complete
- [ ] Dependencies are accurate
- [ ] No contradictions in the plan

### Practicality

- [ ] Steps are actually doable
- [ ] Sequence makes logical sense
- [ ] Risk mitigation is realistic
- [ ] Timeline is reasonable
- [ ] Resources needed are available

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Vague Objectives

**Bad**:
> "Make the code better"

**Good**:
> "Reduce ComponentName from 2,450 to <500 lines by extracting 6 focused components and 4 consolidated hooks, improving testability by creating clear props interfaces for each component."

---

### ❌ Mistake 2: Missing the "Why"

**Bad**:
> "Extract UserProfile component"

**Good**:
> "Extract UserProfile component because:
> - Currently 400 lines in parent (16% of total)
> - Self-contained functionality
> - Will make parent 16% smaller
> - Can be reused in Settings and Admin pages
> - Can be tested independently"

---

### ❌ Mistake 3: No Code Examples

**Bad**:
> "Move state management to custom hook"

**Good**:
> [Show 50 lines of before code]
> [Show 50 lines of after code]
> [Explain the transformation]
> [List the benefits]

---

### ❌ Mistake 4: Unrealistic Steps

**Bad**:
> "Step 1: Refactor entire component (1 day)"

**Good**:
> "Step 1: Extract SearchBar component (2 hours)
> Step 2: Extract UserProfile section (4 hours)
> Step 3: Extract Settings panel (4 hours)
> [10 more realistic steps]"

---

### ❌ Mistake 5: Ignoring Risks

**Bad**:
> [No risk section]

**Good**:
> "Risk 1: Breaking search functionality (MEDIUM likelihood, HIGH impact)
> Mitigation: Test search after extraction, add unit tests, commit after success
> Detection: Search returns no results
> Recovery: git revert [hash], fix issue, retry"

---

### ❌ Mistake 6: Generic Templates

**Bad**:
> "Extract components to improve code quality"

**Good**:
> [Specific file names]
> [Actual line numbers]
> [Real code examples from the file]
> [Precise props interfaces]
> [Concrete before/after transformations]

---

## Example: Putting It All Together

Here's a mini-example of a complete section:

```markdown
### Component: SearchBar

**Purpose**: Provides search interface with debounced input and clear button

**Current Location**: Lines 450-520 in UserDashboard.tsx

**Priority**: HIGH (simple, low-risk, high-value)

**Complexity**: SIMPLE (no complex state, no side effects)

**Responsibilities**:
- Render search input field
- Show search icon
- Show clear button when has text
- Debounce input changes (300ms)
- Clear search on button click

**Props Interface**:
```typescript
interface SearchBarProps {
  // Current search value
  searchTerm: string;
  
  // Callback when search changes (already debounced)
  onSearchChange: (value: string) => void;
  
  // Callback when clear button clicked
  onClearSearch: () => void;
  
  // Optional props
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}
```

**Why Extract**:
- Self-contained functionality (70 lines)
- No complex dependencies
- Reusable in other dashboards
- Easy to test independently
- Pattern can be used for other search inputs

**Files to Create**:
- `components/SearchBar/SearchBar.tsx` (main component)
- `components/SearchBar/index.ts` (exports)
- `hooks/useDebounce.ts` (if doesn't exist)

**Before** (in UserDashboard.tsx):
```typescript
// In UserDashboard component (lines 450-520)
const [searchTerm, setSearchTerm] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

// Debounce effect
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchTerm);
  }, 300);
  return () => clearTimeout(timer);
}, [searchTerm]);

// Search effect
useEffect(() => {
  if (debouncedSearch) {
    // Filter activities
    const filtered = activities.filter(a =>
      a.title.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
    setFilteredActivities(filtered);
  } else {
    setFilteredActivities(activities);
  }
}, [debouncedSearch, activities]);

return (
  <div className="relative mb-4">
    <input
      type="text"
      placeholder="Search activities..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full px-10 py-2 border rounded"
    />
    <SearchIcon className="absolute left-3 top-2.5" />
    {searchTerm && (
      <button
        onClick={() => setSearchTerm('')}
        className="absolute right-3 top-2.5"
      >
        <XIcon />
      </button>
    )}
  </div>
);
```

**After**:
```typescript
// components/SearchBar/SearchBar.tsx
import { SearchIcon, XIcon } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

export interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchChange,
  onClearSearch,
  placeholder = "Search...",
  debounceMs = 300,
  className = ""
}) => {
  // Debounce is now handled in parent via useDebounce hook
  // This component is pure presentation
  
  return (
    <div className={`relative mb-4 ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full px-10 py-2 border rounded"
      />
      <SearchIcon className="absolute left-3 top-2.5" />
      {searchTerm && (
        <button
          onClick={onClearSearch}
          className="absolute right-3 top-2.5"
          aria-label="Clear search"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
};

// hooks/useDebounce.ts (new)
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// In UserDashboard.tsx (now cleaner)
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 300);

// Search effect
useEffect(() => {
  if (debouncedSearch) {
    const filtered = activities.filter(a =>
      a.title.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
    setFilteredActivities(filtered);
  } else {
    setFilteredActivities(activities);
  }
}, [debouncedSearch, activities]);

return (
  <>
    <SearchBar
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onClearSearch={() => setSearchTerm('')}
      placeholder="Search activities..."
    />
    {/* Rest of component */}
  </>
);
```

**Benefits**:
- ✅ SearchBar is now 60 lines (vs 70 inline)
- ✅ Reusable in other components
- ✅ Clear props interface
- ✅ Testable independently
- ✅ useDebounce hook reusable for other inputs
- ✅ Parent component 70 lines smaller

**Testing**:
```typescript
// SearchBar.test.tsx (future)
describe('SearchBar', () => {
  it('renders with placeholder', () => {});
  it('calls onSearchChange when typing', () => {});
  it('shows clear button when has value', () => {});
  it('hides clear button when empty', () => {});
  it('calls onClearSearch when clicking clear', () => {});
});
```

**Implementation Steps**:
1. Create `components/SearchBar/` directory
2. Create `SearchBar.tsx` with interface and JSX
3. Create `hooks/useDebounce.ts` (extract debounce logic)
4. Update UserDashboard to use SearchBar component
5. Test search functionality
6. Test clear button
7. Verify no regressions
8. Commit: "Extract SearchBar component with useDebounce hook"
```

---

## Final Notes for AI Agents

### Remember

1. **Think Deeply First**: Spend time understanding before planning
2. **Document Thoroughly**: Write like you're teaching someone
3. **Be Specific**: Use actual code, not pseudo-code
4. **Show Examples**: Before/after transformations are invaluable
5. **Consider Risks**: Think about what could go wrong
6. **Be Realistic**: Don't promise what you can't deliver
7. **Test Your Plan**: Would you be able to follow it?

### When to Use This Guide

Use this guide when:
- A human asks you to refactor code
- A file is becoming too large (>1000 lines)
- Code is hard to test or maintain
- You're planning a significant restructuring

### When NOT to Use This Guide

Don't write a refactor plan when:
- The change is small (<100 lines affected)
- It's a simple bug fix
- It's a new feature (not refactoring existing)
- The code is already well-structured

### Questions to Ask

Before you start, ask the human:
1. What's the main problem with the current code?
2. What should improve after refactoring?
3. Are there any constraints? (time, features, dependencies)
4. Is there a target structure you have in mind?
5. What level of risk is acceptable?

---

## Meta-Note: About This Guide

This guide itself follows the principles it teaches:

- ✅ **Comprehensive**: Covers all aspects of refactor planning
- ✅ **Specific**: Provides concrete templates and examples
- ✅ **Practical**: Focused on what actually works
- ✅ **Clear**: Organized with clear sections
- ✅ **Educational**: Explains the "why" behind each section

Use this guide as a reference whenever you need to plan a refactor. It will help you create thorough, professional refactor plans that humans can trust and follow.

---

**Remember**: A good refactor plan is worth more than rushed code. Take the time to plan thoroughly, and the implementation will be smooth.

**Think. Document. Plan. Then code.**

---

*This guide was created to help AI agents write better refactor plans. Use it wisely.*

