# Message Management System Architecture v1.0

## 🎯 Core Problem
Currently, message loading, storage, and display logic is scattered across multiple files with competing control systems:
- `config/comments-source.ts` controls cloud fetch limits
- `CommentsStream.tsx` controls display limits and IndexedDB loading
- `useFilters.ts` only sees displayed messages, not IndexedDB content
- Multiple competing constants for the same purpose

## 📋 Requirements

### 1. **Centralized Configuration**
All message limits and loading parameters in ONE place:
```typescript
interface MessageSystemConfig {
  // Cloud/KV Settings
  cloudInitialLoad: number;      // How many to fetch from KV on startup
  cloudPollingInterval: number;  // How often to poll for new messages
  cloudPollBatch: number;        // Max messages per poll
  
  // Display Settings  
  maxDisplayMessages: number;    // Max messages in DOM (memory protection)
  
  // Storage Settings
  maxIndexedDBMessages: number;  // Max messages in IndexedDB (disk protection)
  indexedDBCleanupThreshold: number; // When to trigger cleanup
  
  // Gap Detection
  messageGapThreshold: number;   // Seconds before showing "gap" indicator
  
  // Lazy Loading
  lazyLoadChunkSize: number;     // Messages per lazy load
  scrollThreshold: number;       // Pixels from top to trigger lazy load
}
```

### 2. **Filter Architecture Change**
Filters MUST search IndexedDB, not just displayed messages:
- When filter is active, query IndexedDB directly
- Return up to `maxDisplayMessages` filtered results
- No longer limited by what's currently in the DOM

### 3. **Message Gap Indicator**
When messages have a time gap > threshold:
- Show a visual separator line in the UI
- Line color matches user's color
- Text: "— Gap: X minutes/hours —"
- Store last message timestamp in localStorage

## 🏗️ Proposed Architecture

### Module: `MessageManager`
Location: `/modules/messageManager/index.ts`

```typescript
class MessageManager {
  private config: MessageSystemConfig;
  private indexedDB: IndexedDBProvider;
  private cloudAPI: CloudAPIClient;
  
  constructor(config: MessageSystemConfig) {
    this.config = config;
  }
  
  // Single entry point for initial load
  async loadInitialMessages(): Promise<Message[]> {
    // 1. Load from IndexedDB first (all available)
    const localMessages = await this.indexedDB.getMessages({
      limit: this.config.maxIndexedDBMessages
    });
    
    // 2. Fetch latest from cloud to catch up
    const cloudMessages = await this.cloudAPI.fetchMessages({
      limit: this.config.cloudInitialLoad,
      since: this.getLastMessageTimestamp()
    });
    
    // 3. Merge and deduplicate
    const merged = this.mergeMessages(localMessages, cloudMessages);
    
    // 4. Trim to display limit
    return merged.slice(-this.config.maxDisplayMessages);
  }
  
  // Filter searches IndexedDB directly
  async getFilteredMessages(filters: FilterState): Promise<Message[]> {
    // Query IndexedDB with filters
    const filtered = await this.indexedDB.queryMessages({
      users: filters.users,
      words: filters.words,
      negativeWords: filters.negativeWords,
      limit: this.config.maxDisplayMessages
    });
    
    return filtered;
  }
  
  // Detect and mark gaps
  detectMessageGaps(messages: Message[]): MessageWithGap[] {
    return messages.map((msg, idx) => {
      if (idx === 0) return msg;
      
      const prevMsg = messages[idx - 1];
      const gap = msg.timestamp - prevMsg.timestamp;
      
      if (gap > this.config.messageGapThreshold * 1000) {
        return {
          ...msg,
          hasGapBefore: true,
          gapDuration: gap
        };
      }
      
      return msg;
    });
  }
  
  // Storage management
  async cleanupStorage(): Promise<void> {
    const count = await this.indexedDB.getMessageCount();
    if (count > this.config.indexedDBCleanupThreshold) {
      // Delete oldest messages
      const toDelete = count - this.config.maxIndexedDBMessages;
      await this.indexedDB.deleteOldestMessages(toDelete);
    }
  }
}
```

### Hook: `useMessageSystem`
Location: `/hooks/useMessageSystem.ts`

```typescript
export function useMessageSystem() {
  const manager = useRef(new MessageManager(MESSAGE_CONFIG));
  const [messages, setMessages] = useState<Message[]>([]);
  const [isFiltered, setIsFiltered] = useState(false);
  
  // Initial load
  useEffect(() => {
    const loadInitial = async () => {
      const msgs = await manager.current.loadInitialMessages();
      setMessages(msgs);
    };
    loadInitial();
  }, []);
  
  // Handle filtering
  const applyFilters = useCallback(async (filters: FilterState) => {
    if (filters.isActive) {
      // Search IndexedDB directly
      const filtered = await manager.current.getFilteredMessages(filters);
      setMessages(filtered);
      setIsFiltered(true);
    } else {
      // Return to normal view
      const all = await manager.current.loadInitialMessages();
      setMessages(all);
      setIsFiltered(false);
    }
  }, []);
  
  // Polling for new messages
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isFiltered) {
        const newMessages = await manager.current.pollNewMessages();
        setMessages(prev => manager.current.mergeAndTrim(prev, newMessages));
      }
    }, MESSAGE_CONFIG.cloudPollingInterval);
    
    return () => clearInterval(interval);
  }, [isFiltered]);
  
  return {
    messages,
    applyFilters,
    isFiltered,
    // ... other methods
  };
}
```

## 📊 Data Flow

```
1. Initial Load:
   IndexedDB (all) → Cloud (catch-up) → Merge → Display (limited)

2. Filtering:
   Filter State → IndexedDB Query → Display (limited filtered results)

3. Polling:
   Cloud (new) → Merge with existing → Trim to limit → Display

4. Storage Management:
   Background task → Check IndexedDB size → Cleanup if needed
```

## 🔄 React Initialization Order

```typescript
1. MessageManager singleton initializes
2. useMessageSystem hook mounts
3. Load from IndexedDB (async, non-blocking)
4. Load from Cloud (async, after IndexedDB)
5. Merge and display
6. Start polling interval
7. Listen for filter changes
```

## 🎨 Message Gap UI Component

```typescript
interface MessageGapProps {
  duration: number;
  userColor: string;
}

function MessageGap({ duration, userColor }: MessageGapProps) {
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours`;
    const days = Math.floor(hours / 24);
    return `${days} days`;
  };
  
  return (
    <div className="message-gap" style={{ borderColor: userColor }}>
      <span style={{ color: userColor }}>
        — Gap: {formatDuration(duration)} —
      </span>
    </div>
  );
}
```

## 🔧 Configuration File
Location: `/config/message-system.ts`

```typescript
export const MESSAGE_SYSTEM_CONFIG: MessageSystemConfig = {
  // Cloud/KV Settings
  cloudInitialLoad: 100,        // Fetch last 100 from KV on startup
  cloudPollingInterval: 5000,   // Poll every 5 seconds
  cloudPollBatch: 50,           // Max 50 per poll
  
  // Display Settings
  maxDisplayMessages: 2000,     // Show max 2000 in DOM
  
  // Storage Settings
  maxIndexedDBMessages: 10000,  // Store max 10k messages
  indexedDBCleanupThreshold: 12000, // Cleanup at 12k
  
  // Gap Detection
  messageGapThreshold: 300,     // 5 minutes = gap
  
  // Lazy Loading
  lazyLoadChunkSize: 200,       // Load 200 at a time
  scrollThreshold: 100,         // 100px from top
};
```

## 🚀 Migration Plan

### Phase 1: Create New Module
1. Create `/modules/messageManager/` directory
2. Implement `MessageManager` class
3. Create configuration file
4. Add IndexedDB query methods

### Phase 2: Update Hooks
1. Create `useMessageSystem` hook
2. Integrate with existing `useFilters`
3. Update `CommentsStream` to use new hook

### Phase 3: Remove Old Code
1. Remove competing constants from `CommentsStream.tsx`
2. Remove message logic from `useFilters.ts`
3. Remove limits from `config/comments-source.ts`

### Phase 4: Add Gap Detection
1. Implement gap detection logic
2. Create MessageGap component
3. Add localStorage for last seen timestamp

## ⚠️ Critical Considerations

1. **IndexedDB Performance**: Queries on 10k+ messages need indexes
2. **Memory Management**: DOM should never exceed `maxDisplayMessages`
3. **Filter Performance**: Use IndexedDB indexes for fast filtering
4. **React Reconciliation**: Use proper keys for message lists
5. **Cleanup Strategy**: Run cleanup in web worker if possible

## 📈 Benefits

1. **Single Source of Truth**: All config in one place
2. **Clear Separation**: Display vs Storage vs Network
3. **Better Filtering**: Searches all stored messages, not just visible
4. **Memory Protection**: Hard limits on DOM elements
5. **Storage Protection**: Automatic IndexedDB cleanup
6. **Gap Awareness**: Users know when they missed messages
7. **Maintainable**: Easy to adjust limits and behavior

## 🔍 Testing Strategy

1. **Load Testing**: Test with 10k+ messages in IndexedDB
2. **Filter Testing**: Ensure filters search all stored messages
3. **Memory Testing**: Monitor DOM node count and memory usage
4. **Gap Testing**: Simulate connection loss and verify gap display
5. **Cleanup Testing**: Verify old messages are properly removed

---

## Next Steps

1. Review and approve this architecture
2. Implement MessageManager module
3. Create useMessageSystem hook
4. Integrate with existing components
5. Test thoroughly
6. Deploy

This architecture provides:
- **Clarity**: All message logic in one place
- **Performance**: Efficient querying and display
- **Protection**: Memory and storage limits
- **Features**: Gap detection, better filtering
- **Maintainability**: Easy to modify and extend
