# Filter System Refactor Documentation

## 📌 Version
- **Date**: September 20, 2025
- **Version**: v0.1.1
- **Status**: Implemented

## 🎯 Overview

The filter system has been refactored from scattered logic across multiple hooks and components into a centralized, modular architecture. This improves maintainability, reusability, and provides a clear separation of concerns.

## 🏗️ Architecture

### Previous Structure (Before Refactor)
```
Components using filters:
├── CommentsStream.tsx (filter logic mixed with UI)
├── FilterBar.tsx (UI only)
├── hooks/useFilters.ts (main filter logic)
├── hooks/useURLFilter.ts (URL sync)
└── lib/url-filter-manager.ts (URL state)
```

### New Structure (After Refactor)
```
Filter System Module:
├── modules/filterSystem.ts (core logic)
│   ├── FilterManager class
│   ├── Filter operations
│   ├── State management
│   └── Persistence logic
├── hooks/useFilterSystem.ts (React integration)
│   └── Simple hook interface
├── components/FilterBar.tsx (pure UI)
└── lib/url-filter-manager.ts (unchanged)
```

## 📦 Module Components

### 1. `modules/filterSystem.ts`

The core filter module containing:

#### **FilterManager Class**
```typescript
class FilterManager {
  // Core methods
  addUsernameFilter(username: string, color: string): void
  addWordFilter(word: string): void
  addNegativeWordFilter(word: string): void
  updateDateTimeFilter(filter: DateTimeFilter): void
  applyFilters(comments: Comment[]): Comment[]
  
  // State management
  getState(): FilterState
  hasActiveFilters(): boolean
  clearAllFilters(): void
  
  // Persistence
  private persist(): void  // Saves to localStorage
  private syncWithURL(): void  // Syncs with URL state
}
```

#### **Pure Functions**
```typescript
// Apply filters without state management
applyFilters(comments, filterState, config): Comment[]

// Parse and normalize filter inputs
parseFilterWord(selectedText): string | null

// Get appropriate colors for filter types
getFilterColor(type): string
```

#### **Types & Interfaces**
```typescript
interface FilterState {
  usernames: UsernameFilter[]
  words: string[]
  negativeWords: string[]
  wordRemove: string[]
  isEnabled: boolean
  dateTime: DateTimeFilter
  searchTerms: string[]
}

interface FilterConfig {
  filterByColorToo?: boolean
  maxFilterItems?: number
  persistToLocalStorage?: boolean
  syncWithURL?: boolean
}
```

### 2. `hooks/useFilterSystem.ts`

React hook providing a clean interface to the filter module:

```typescript
function useFilterSystem({ comments, searchTerm, config }) {
  return {
    // Filtered results
    filteredComments: Comment[]
    
    // Current state
    filterUsernames: UsernameFilter[]
    filterWords: string[]
    negativeFilterWords: string[]
    isFilterEnabled: boolean
    hasActiveFilters: boolean
    
    // Actions
    addToFilter: (username, color) => void
    addWordToFilter: (word) => void
    addNegativeWordFilter: (word) => void
    toggleFilter: () => void
    clearAllFilters: () => void
    
    // URL integration
    urlSearchTerms: string[]
    addSearchTermToURL: (term) => void
    removeSearchTermFromURL: (term) => void
  }
}
```

## 🔄 Migration Guide

### Using the New System in Components

**Before (using old useFilters hook):**
```typescript
const {
  filterUsernames,
  filterWords,
  // ... many individual pieces
} = useFilters({ displayedComments, searchTerm });
```

**After (using new useFilterSystem):**
```typescript
const {
  filteredComments,
  filterUsernames,
  addWordToFilter,
  // ... clean interface
} = useFilterSystem({ 
  comments: displayedComments, 
  searchTerm 
});
```

### Key Changes

1. **Centralized Logic**: All filter operations now go through `FilterManager`
2. **Type Safety**: Strong TypeScript interfaces throughout
3. **Configurable**: Pass config object to customize behavior
4. **Testable**: Pure functions can be tested independently
5. **Persistent**: Automatic localStorage and URL sync

## 🎯 Benefits

### 1. **Separation of Concerns**
- **Module**: Pure business logic (no React, no DOM)
- **Hook**: React integration layer
- **Component**: Pure presentation

### 2. **Reusability**
- Filter logic can be used outside React components
- Easy to port to other frameworks
- Can be tested in isolation

### 3. **Maintainability**
- Single source of truth for filter logic
- Clear interfaces and types
- Well-documented functions

### 4. **Performance**
- Memoized filter operations
- Efficient state updates
- Batch persistence operations

### 5. **Extensibility**
- Easy to add new filter types
- Configurable behavior
- Plugin-friendly architecture

## 📊 Filter Operations Flow

```
User Action → Hook → FilterManager → State Update → Persistence
     ↓                                      ↓            ↓
  UI Event                            Apply Filters  localStorage
                                           ↓            ↓
                                    Filtered Results  URL Sync
```

## 🔧 Configuration Options

```typescript
const config: FilterConfig = {
  // Filter by username AND color (default: false)
  filterByColorToo: false,
  
  // Maximum number of filter items (default: 100)
  maxFilterItems: 100,
  
  // Save filters to localStorage (default: true)
  persistToLocalStorage: true,
  
  // Sync filters with URL hash (default: true)
  syncWithURL: true
}
```

## 📝 Usage Examples

### Basic Usage
```typescript
// In a React component
import { useFilterSystem } from '@/hooks/useFilterSystem';

function MyComponent({ comments }) {
  const { 
    filteredComments, 
    addWordToFilter 
  } = useFilterSystem({ comments });
  
  return (
    <div>
      {filteredComments.map(comment => (
        <div onClick={() => addWordToFilter(comment.text)}>
          {comment.text}
        </div>
      ))}
    </div>
  );
}
```

### Advanced Usage
```typescript
// Create custom filter manager
import { FilterManager } from '@/modules/filterSystem';

const filterManager = new FilterManager({
  filterByColorToo: true,
  maxFilterItems: 50
});

// Apply filters manually
const filtered = filterManager.applyFilters(comments);

// Check state
if (filterManager.hasActiveFilters()) {
  console.log('Filters active:', filterManager.getState());
}
```

### Direct Module Usage (No React)
```typescript
import { applyFilters } from '@/modules/filterSystem';

const filterState = {
  usernames: [{ username: 'alice', color: '#60A5FA' }],
  words: ['react', 'javascript'],
  negativeWords: ['spam'],
  isEnabled: true,
  // ...
};

const filtered = applyFilters(comments, filterState);
```

## 🚀 Future Enhancements

1. **Filter Presets**: Save and load filter combinations
2. **Filter Groups**: Organize filters into named groups
3. **Advanced Operators**: AND/OR/NOT logic for complex filters
4. **Regular Expressions**: Support regex patterns
5. **Filter History**: Undo/redo filter changes
6. **Export/Import**: Share filter configurations
7. **Performance Mode**: Lazy evaluation for large datasets
8. **Filter Analytics**: Track filter usage patterns

## 📚 Related Documentation

- [Filter System Reference](./05-FILTER-SYSTEM-REFERENCE.md)
- [URL Filtering System](./03-FEATURES-DOCUMENTATION.md#url-filtering)
- [Technical Architecture](./04-TECHNICAL-ARCHITECTURE.md)

## ✅ Testing Checklist

- [ ] All existing filters work as before
- [ ] URL sync continues to function
- [ ] localStorage persistence works
- [ ] Filter toggle switch works
- [ ] Click-to-filter on words/usernames
- [ ] Right-click negative filters
- [ ] Date/time filters apply correctly
- [ ] Search bar integration
- [ ] Multi-tab synchronization (localStorage mode)
- [ ] Performance with 1000+ comments

---

**Version**: 0.1.1  
**Status**: Refactor Complete  
**Next Step**: Update CommentsStream.tsx to use new system
