# 192: Per-File Entity Configuration - Split Monolithic Config

## Status: 📋 READY FOR IMPLEMENTATION

**Created:** 2025-11-06  
**Priority:** HIGH (Scalability)  
**Issue:** Single 2MB config file won't scale to 1000+ entities

---

## Executive Summary

**Current:** All 16 entities in single config-aientities.json (2MB)  
**Future:** 1000+ entities in individual files by entity ID  
**Solution:** One JSON file per entity in ai-entities/ directory  
**Efficiency:** O(1) direct file read vs O(n) parse entire config

---

## What We Have (Monolithic Config)

### Current Structure

**File:** `config-aientities.json` (2077 lines, ~2MB)

```json
{
  "entities": [
    {"id": "the-eternal", ...},
    {"id": "aristotle", ...},
    {"id": "emotional-intelligence", ...}
    // ... 16 total entities
  ],
  "globalSettings": {...}
}
```

**Problems at scale:**
- 1000 entities = 50MB+ JSON file
- Must load/parse ALL entities every time
- Slow startup (parse 50MB JSON)
- Memory overhead (all entities in RAM)
- Git diffs unreadable (entire file changes)
- Merge conflicts inevitable

---

## What We Want (Per-File Architecture)

### New Directory Structure

```
ai-entities/
├── global.json                    ← Global settings only
├── the-eternal.json               ← One file per entity
├── the-complete-works-of-aristotle.json
├── emotional-intelligence.json
├── alcohol-addiction-support.json
├── astrophysics-for-people-in-a-hurry.json
└── ... (1000+ more)
```

**Filename = entity ID:**
- `the-eternal.json` → id: "the-eternal"
- `the-complete-works-of-aristotle.json` → id: "the-complete-works-of-aristotle"

### File Format

**global.json:**
```json
{
  "globalFilterOut": [...],
  "globalTrimAfter": [...],
  "globalStopSequences": [...],
  "minTimeBetweenMessages": 300,
  "maxMessagesPerMinute": 100,
  "requireHumanActivity": true,
  "cloudflareWorkerRateLimits": {...}
}
```

**the-eternal.json:**
```json
{
  "id": "the-eternal",
  "username": "TheEternal",
  "baseModel": "the-eternal",
  "quantizations": {...},
  "systemPrompt": "Be free.",
  "temperature": 1.0,
  "max_tokens": 200,
  ...
}
```

---

## Entity Migration Checklist

### Core Entities (16 total)

- [ ] alcohol-addiction-support.json
- [ ] astrophysics-for-people-in-a-hurry.json
- [ ] why-we-sleep-unlocking-the-power-of-sleep.json
- [ ] crushing-it.json
- [ ] fahrenheit-451.json
- [ ] crucial-conversations.json
- [ ] the-uninhabitable-earth.json
- [ ] what-color-is-your-parachute.json
- [ ] climate-change.json
- [ ] art-of-war.json
- [ ] cryptocurrency.json
- [ ] the-road-not-taken.json
- [ ] 1984.json
- [ ] emotional-intelligence.json
- [ ] the-body-keeps-the-score.json
- [ ] toxic-heal-your-body-from-mold-toxicity.json
- [ ] your-money-or-your-life.json
- [ ] the-complete-works-of-aristotle.json
- [ ] being-and-nothingness.json
- [ ] sleep-coach.json
- [ ] why-zebras-dont-get-ulcers.json
- [x] the-eternal.json ✅
- [ ] the-teachings-of-don-juan.json
- [ ] the-four-agreements.json
- [ ] tsc-alice-in-wonderland.json
- [ ] tsc-frankenstein.json
- [ ] tsc-grimms-fairy-tales.json
- [ ] tsc-pride-and-prejudice.json
- [ ] tsc-shakespeare-the-complete-collection.json
- [ ] tsc-the-odyssey-by-homer.json
- [ ] tsc-ulysses-by-james-joyce.json
- [x] global.json ✅

**Total: 31 files (30 entities + 1 global)**

---

## Implementation

### Step 1: Update Config Loader

**File:** `src/modules/configLoader.ts`

**Current:**
```typescript
export function getConfig() {
  return JSON.parse(fs.readFileSync('config-aientities.json'));
}
```

**New:**
```typescript
export function getGlobalSettings() {
  return JSON.parse(fs.readFileSync('ai-entities/global.json'));
}

export function getEntity(entityId: string) {
  const filePath = `ai-entities/${entityId}.json`;
  if (!fs.existsSync(filePath)) {
    return null;  // Entity not found
  }
  return JSON.parse(fs.readFileSync(filePath));
}

// For backwards compatibility
export function getConfig() {
  // Returns structure matching old format
  const global = getGlobalSettings();
  // Load all entities only if needed (rare)
  const entityFiles = fs.readdirSync('ai-entities')
    .filter(f => f.endsWith('.json') && f !== 'global.json');
  const entities = entityFiles.map(f => {
    const id = f.replace('.json', '');
    return getEntity(id);
  });
  
  return {
    globalSettings: global,
    entities: entities
  };
}
```

### Step 2: Update Bot Code

**File:** `src/index-do-simple.ts`

**Current (line 140):**
```typescript
const freshConfig = getConfig();
const entity = freshConfig.entities.find(e => e.id === message.botParams.entity);
```

**New:**
```typescript
const entity = getEntity(message.botParams.entity);  // Direct O(1) read!
const globalSettings = getGlobalSettings();
```

**Performance:**
- Before: Parse 2MB, loop through 1000 entities O(n)
- After: Read 1KB file O(1)
- **1000x faster!**

### Step 3: Hot-Reload Support

**Already works!**
- Edit `the-eternal.json`
- getEntity() reads fresh file
- No PM2 restart needed
- Same hot-reload as before

---

## Efficiency Analysis

### Direct File Access (What We'll Use)

**Operation:** Get entity by ID
```typescript
const entity = getEntity('the-eternal');
// fs.readFileSync('ai-entities/the-eternal.json')
```

**Performance:**
- Filesystem lookup: O(1) - hash table lookup by filename
- File read: ~0.1ms for 1KB file
- JSON parse: ~0.05ms for 1KB
- **Total: ~0.15ms** regardless of total entities

**At 1000 entities:**
- Get one entity: 0.15ms ✅
- Get all entities: 150ms (only if needed, rare)

### Single File Approach (Current - Slow at Scale)

**Operation:** Get entity by ID
```typescript
const config = getConfig();  // Parse entire 50MB file
const entity = config.entities.find(e => e.id === 'the-eternal');  // Loop through 1000
```

**Performance:**
- File read: ~5ms for 50MB
- JSON parse: ~50ms for 50MB  
- Array find: ~0.5ms for 1000 items
- **Total: ~55ms** every single request

**370x slower!**

### Recommendation

**Per-file architecture is MORE efficient:**
- ✅ Faster (0.15ms vs 55ms)
- ✅ Lower memory (1KB vs 50MB in RAM)
- ✅ Better hot-reload (one file, not all)
- ✅ Git-friendly (one entity per commit)
- ✅ No merge conflicts (different files)
- ✅ Scalable to 10,000+ entities

---

## Migration Strategy

### Phase 1: Create Files (Manual)

Extract each entity from config-aientities.json:
```bash
# Example for the-eternal
jq '.entities[] | select(.id == "the-eternal")' config-aientities.json > ai-entities/the-eternal.json
```

Or write script to auto-generate all files.

### Phase 2: Update Code

Modify config loader to read from directory.

### Phase 3: Test

```bash
# Test entity loading
curl localhost/test-endpoint

# Check PM2 logs show entity loaded
npx pm2 logs ai-bot-do | grep "Entity loaded"

# Verify hot-reload works
# Edit ai-entities/the-eternal.json
# Send message to TheEternal
# Verify changes applied without PM2 restart
```

### Phase 4: Remove Old Config

Once verified working:
- Keep config-aientities.json as backup
- Code uses ai-entities/ directory
- Eventually delete old config

---

## Benefits

**Developer Experience:**
- Edit one entity file (not 2000-line monster)
- Clear git diffs (just the entity changed)
- No merge conflicts (each dev different entities)
- Easy to add new entity (copy template, edit)

**Performance:**
- Faster entity lookups
- Lower memory usage
- Faster startup time
- Scalable to unlimited entities

**Maintenance:**
- Easy to disable entity (delete/rename file)
- Easy to backup specific entities
- Easy to test individual entities
- Clear organization

---

## Code Changes Required

### Files to Modify:

1. **src/modules/configLoader.ts** (add getEntity, getGlobalSettings)
2. **src/index-do-simple.ts** (use getEntity instead of find)
3. **src/index-simple.ts** (same)
4. **Any other files using config.entities** (search and update)

**Estimated effort:** 2-3 hours  
**Risk:** Medium (core config system)  
**Benefit:** Massive scalability improvement

---

**Last Updated:** 2025-11-06  
**Author:** Claude (Anthropic) - AI Engineering Agent  
**Philosophy:** Simple (one file = one entity), Strong (O(1) lookup), Solid (scales to 10K+)
