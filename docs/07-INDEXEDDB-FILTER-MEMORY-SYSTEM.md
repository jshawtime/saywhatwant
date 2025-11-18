# IndexedDB Filter Memory System for Say What Want

## Executive Summary

A modular storage system that replaces localStorage with IndexedDB to enable powerful local data management while maintaining **zero behavioral changes** to the app. The system implements a "filter memory" that permanently stores messages matching any filter the user has ever applied, while maintaining a 24-hour rolling window for unmatched messages.

## Core Philosophy

- **No behavioral changes** - Drop-in replacement for localStorage
- **Modular design** - Easy to swap for another database later
- **Simple OR logic** - Any message matching ANY lifetime filter gets saved
- **User-controlled** - Full management of what gets saved
- **Storage-efficient** - 1 GB limit with automatic cleanup

## Architecture Overview

### Data Flow
```
Cloudflare KV (Source of Truth)
    ↓ (5-second polling)
IndexedDB Local Cache
    ├── 24-hour temporary store (all messages)
    └── Permanent store (filtered messages)
    
User applies filter → Added to lifetime filters → Future messages matching it saved forever
```

### Storage Structure
```javascript
Database: 'SayWhatWant'
Version: 1

ObjectStores:
├── messages_temp
│   ├── All messages from last 24 hours
│   ├── Auto-purged after 24 hours
│   └── Powers current session display
│
├── messages_perm  
│   ├── Messages matching ANY lifetime filter
│   ├── Never auto-deleted (until storage limit)
│   └── User's personal curated archive
│
├── lifetime_filters
│   ├── users: ["alice", "bob", ...]
│   ├── words: ["javascript", "react", ...]
│   ├── searchTerms: ["tutorial", "help", ...]
│   └── metadata: { created, messageCount, lastUpdated }
│
└── filter_stats
    └── Per-filter statistics for cleanup decisions
```

## Filter Memory Logic

### What Gets Saved Permanently

When a message arrives, it's saved permanently if it matches **ANY** lifetime filter:

```javascript
// User has previously filtered:
// Day 1: #u=alice
// Day 2: #word=javascript  
// Day 3: #search=tutorial

// Message from bob saying "python rocks" → 24-hour only
// Message from alice saying "hello" → PERMANENT (matches alice)
// Message from charlie saying "javascript" → PERMANENT (matches javascript)
// Message containing "tutorial" anywhere → PERMANENT (matches tutorial)
```

### Filter Recording

Every filter applied through ANY method gets recorded:
- URL filters (`#u=alice&word=react`)
- Click filters (clicking on words/usernames)
- Search bar entries
- Manual filter additions

Components are stored separately:
```javascript
#u=alice&word=javascript

// Stores as:
lifetimeFilters.users.add("alice")
lifetimeFilters.words.add("javascript")

// Both alice's messages AND javascript messages saved (OR logic)
```

### Negative Filters Clarification

**Important:** Negative filters (`-word=spam`) are for **display filtering only**. They do NOT affect storage. The IndexedDB only stores messages matching positive filters. Negative filters are purely a UI feature.

## Storage Management

### 1 GB Storage Limit

- **Soft limit**: 1 GB target
- **Hard limit**: Can exceed slightly without breaking
- **Measurement**: Actual byte size, not message count
- **Monitoring**: Continuous via `navigator.storage.estimate()`

### Cleanup Strategy (When Approaching Limit)

1. **First**: Delete oldest permanent messages (FIFO)
2. **Second**: Remove least-useful filters based on score:
   ```javascript
   usefulness_score = match_count / days_since_created
   ```
3. **Never delete**: Active 24-hour window or current session

### Storage Statistics

Users can see:
- Current usage: "423 MB of 1 GB used"
- Message counts: "12,453 permanent, 3,421 temporary"
- Filter count: "247 lifetime filters active"
- Cleanup status: "Next cleanup at 80% capacity"

## User Interface

### Filter Management Icon

Location: Filter bar, left of the dot button (•)
- Icon: Settings/gear icon or filter icon with gear
- Action: Opens filter management modal
- Visual: Consistent with existing UI style

### Filter Management Modal

```
╔════════════════════════════════════════════╗
║  Lifetime Filter Memory                    ║
║  ─────────────────────────────────────────║
║  247 filters saving 12,453 messages        ║
║  423 MB of 1 GB used                       ║
║                                            ║
║  Users (12)                  [Clear All]   ║
║  ┌────────────────────────────────────┐   ║
║  │ alice (1,523) ×  bob (892) ×       │   ║
║  │ charlie (445) ×  david (221) ×     │   ║
║  └────────────────────────────────────┘   ║
║                                            ║
║  Words (89)                  [Clear All]   ║
║  ┌────────────────────────────────────┐   ║
║  │ javascript (2,341) ×  react (892) × │   ║
║  │ tutorial (445) ×  important (123) × │   ║
║  └────────────────────────────────────┘   ║
║                                            ║
║  Search Terms (45)           [Clear All]   ║
║  ┌────────────────────────────────────┐   ║
║  │ help (567) ×  question (234) ×      │   ║
║  └────────────────────────────────────┘   ║
║                                            ║
║  [Export Filters] [Clear All] [Close]      ║
╚════════════════════════════════════════════╝
```

Features:
- View all lifetime filters by category
- See match count per filter (in parentheses)
- Delete individual filters (× button)
- Bulk operations (Clear All per category)
- Export filter list as JSON
- Storage statistics at top

## Module Design

### Abstraction Layer

```typescript
// storage-interface.ts
interface StorageProvider {
  init(): Promise<void>;
  saveMessage(message: Message): Promise<void>;
  getMessages(filter?: FilterState): Promise<Message[]>;
  clearOldMessages(): Promise<void>;
  getStorageInfo(): Promise<StorageInfo>;
}

// indexeddb-provider.ts
class IndexedDBProvider implements StorageProvider {
  // IndexedDB-specific implementation
}

// Future: could swap to:
// - SQLite provider
// - WebSQL provider  
// - Custom binary format
// - Remote database
```

### File Structure
```
modules/
├── storage/
│   ├── interface.ts         # Abstract interface
│   ├── indexeddb/
│   │   ├── provider.ts      # Main IndexedDB implementation
│   │   ├── schemas.ts       # Database schemas
│   │   ├── migrations.ts    # Version migrations
│   │   └── filters.ts       # Filter memory logic
│   └── index.ts             # Public API
│
└── filter-memory/
    ├── manager.ts           # Filter lifetime management
    ├── ui/
    │   ├── modal.tsx        # Management modal
    │   └── icon.tsx         # Filter bar icon
    └── stats.ts             # Usage statistics
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create modular storage interface
- [ ] Implement IndexedDB provider
- [ ] Set up database schemas
- [ ] Basic read/write operations

### Phase 2: Filter Memory (Week 2)
- [ ] Lifetime filter tracking
- [ ] Message retention logic
- [ ] 24-hour cleanup job
- [ ] OR-based matching

### Phase 3: Management UI (Week 3)
- [ ] Filter bar icon
- [ ] Management modal
- [ ] Filter deletion
- [ ] Storage statistics

### Phase 4: Storage Management (Week 4)
- [ ] 1 GB monitoring
- [ ] Cleanup strategies
- [ ] Performance optimization
- [ ] Testing at scale

## API Examples

### Recording a Filter
```javascript
// When user applies any filter
FilterMemory.recordFilter({
  users: ['alice'],
  words: ['javascript']
});
```

### Checking Message Retention
```javascript
const shouldKeep = FilterMemory.matchesLifetime(message);
if (shouldKeep) {
  await Storage.savePermanent(message);
}
```

### Managing Storage
```javascript
const stats = await Storage.getStats();
if (stats.usage > 0.8 * stats.quota) {
  await Storage.cleanup();
}
```

## Performance Targets

- **Message ingestion**: < 10ms per message
- **Filter checking**: < 5ms per message
- **Bulk operations**: 1000 messages/second
- **UI responsiveness**: < 50ms for any operation
- **Storage cleanup**: Background, non-blocking

## Testing Strategy

1. **Unit Tests**
   - Storage interface compliance
   - Filter matching logic
   - Cleanup algorithms

2. **Integration Tests**
   - 100K message load test
   - Storage limit handling
   - Filter management UI

3. **Stress Tests**
   - 1M messages
   - 1000 lifetime filters
   - Rapid filter changes

## Migration from localStorage

### Seamless Transition
```javascript
// On first run with IndexedDB
if (localStorage['sww-comments-local']) {
  const messages = JSON.parse(localStorage['sww-comments-local']);
  await Storage.importFromLocalStorage(messages);
  localStorage.removeItem('sww-comments-local');
}
```

## Browser Compatibility

- Chrome/Edge: Full support, best performance
- Firefox: Full support, slightly different transaction timing
- Safari: Full support, smaller default quotas
- Mobile: Reduced quotas, background restrictions

## Privacy & Security

- All data stored locally only
- No server transmission of filters
- User has full control over what's saved
- Clear data export/import capabilities
- No tracking or analytics on filters

## Future Enhancements

These are NOT part of initial implementation but possible later:

1. **Filter Groups**: Save filter combinations as presets
2. **Smart Suggestions**: "You often filter alice+bob together"
3. **Time-based Patterns**: "You check 'javascript' every Monday"
4. **Compression**: Compress old messages for more storage
5. **Selective Sync**: Choose which filters to sync to cloud

## Development Tools

### IndexedDB Analysis Tool
**URL**: http://localhost:3000/indexedDB-analysis.html

A comprehensive debugging and testing interface that provides:
- Real-time database monitoring
- Filter management and inspection
- Message browsing and searching
- Storage statistics and cleanup testing
- Test data generation
- Database export/import functionality

Use this tool during development to verify the system is working correctly.

## Success Criteria

- [ ] Zero behavioral changes to existing app
- [ ] Seamless localStorage migration
- [ ] 1 GB storage management working
- [ ] Filter management UI intuitive
- [ ] Module easily swappable
- [ ] Performance targets met
- [ ] No data loss during cleanup

## Key Design Decisions

1. **OR Logic Only**: Simple, predictable, user-friendly
2. **Filter Memory**: Once filtered, always remembered
3. **1 GB Limit**: File size based, not message count
4. **Modular Design**: Database-agnostic interface
5. **User Control**: Full management of saved filters
6. **No Behavior Changes**: Pure infrastructure upgrade

## Final Notes

This system creates a **personal archive** for each user based on their demonstrated interests through filtering. It's privacy-preserving, storage-efficient, and provides powerful local search capabilities while maintaining the simplicity of the current interface.

The modular design ensures that when/if you need to swap to a different storage system (SQLite, WebSQL, etc.), the change will be isolated to the storage provider implementation, with no changes needed in the rest of the application.

**Remember**: The goal is to make localStorage more powerful without changing anything about how the app works. Users shouldn't notice anything different except that they can now store vastly more messages and the app remains fast even with hundreds of thousands of messages.

---

*Ready for implementation after approval*
