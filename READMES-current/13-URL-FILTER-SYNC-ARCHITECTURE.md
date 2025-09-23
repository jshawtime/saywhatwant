# URL-Filter Bar Sync Architecture

## Core Principle
**URL = Filter Bar Contents (Always)**

The URL always reflects what's IN the filter bar, regardless of whether filters are active or inactive.

## Sync Behavior

### URL Updates When:
- ✅ User adds a filter to the bar → URL gets that filter
- ✅ User removes a filter from bar → URL removes that filter  
- ✅ User adds negative word filter → URL gets `-word`
- ✅ User removes negative word filter → URL removes `-word`

### URL Does NOT Update When:
- ❌ User toggles filters active/inactive (toggle button)
- ❌ Filters are automatically activated/deactivated

## Filter Activation Control

### Manual Control (Default)
The toggle button is the primary way users control filter active/inactive state.

### Automatic Activation (Special Cases Only)

#### Special Case 1: Base URL → Filters OFF
```
Visit: https://saywhatwant.app/
Result: Filters turn OFF (even if filter bar has items)
Reason: User expects to see unfiltered feed with plain URL
```

#### Special Case 2: URL Filters + Empty Bar → Filters ON  
```
Visit: https://saywhatwant.app/#u=alice:255000000
Condition: No saved filters in localStorage (new user)
Result: Filters turn ON automatically
Reason: Helps new users understand filters are active
```

#### Normal Case: Saved Preference
```
Visit: Any URL
Condition: User has saved filters in localStorage
Result: Use user's saved active/inactive preference
```

## Merge Behavior

No single source of truth - filters merge from both URL and bar:

```javascript
// Example merge scenario:
Filter Bar: [alice, bob]
URL: #u=charlie
Display: [alice, bob, charlie]  // All three shown

// After user adds "david" to filter bar:
Filter Bar: [alice, bob, david]
URL: #u=alice+bob+charlie+david  // URL updates to full merged state
```

## Implementation Details

### Adding Filters
```javascript
const addToFilter = (username, color) => {
  // Add to local filter bar
  setFilterUsernames([...filterUsernames, {username, color}]);
  localStorage.setItem('sww-filters', JSON.stringify(newFilters));
  
  // Always sync URL
  addUserToURL(username, color);  // ← URL always updates
}
```

### Toggle Button
```javascript
const toggleFilter = () => {
  // ONLY changes active state
  setIsFilterEnabled(!isFilterEnabled);
  localStorage.setItem('sww-filter-enabled', String(newState));
  
  // URL remains unchanged - it always shows filter bar contents
}
```

## User Experience

1. **Sharing**: Users can share URLs knowing all filters are included
2. **Control**: Users manually control whether filters are active  
3. **Predictable**: Base URL always shows full feed
4. **Helpful**: New users see filters activate when visiting filtered URLs
5. **Persistent**: Filter bar contents persist across sessions

## Architecture Benefits

- **Simple**: URL = Filter Bar (always)
- **Flexible**: Active/inactive state independent of URL
- **Shareable**: URLs always contain complete filter state
- **Intuitive**: Special cases match user expectations
- **Merge-friendly**: No conflicts between URL and local filters
