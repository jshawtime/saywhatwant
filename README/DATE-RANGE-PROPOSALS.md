# Date Range URL Filtering Proposals

## 📅 Proposal 1: Relative Time Ranges

### Concept
Use human-readable relative time periods that are easy to understand and share. The time is always relative to "now" when the URL is accessed.

### URL Parameter: `time=`

#### Syntax Examples

**Hours/Days/Weeks:**
```
#time=1h        → Last 1 hour
#time=6h        → Last 6 hours  
#time=24h       → Last 24 hours
#time=3d        → Last 3 days
#time=7d        → Last 7 days (1 week)
#time=2w        → Last 2 weeks
#time=1m        → Last 1 month
```

**Special Keywords:**
```
#time=today     → Since midnight today
#time=yesterday → Yesterday only
#time=thisweek  → Current week (Monday-Sunday)
#time=lastweek  → Previous week
#time=thismonth → Current month
#time=recent    → Last 30 minutes (configurable)
```

**Combined Ranges (with +):**
```
#time=today+yesterday    → Today and yesterday
#time=1h+6h+24h         → Multiple time windows
```

### Implementation Example
```javascript
function parseRelativeTime(timeStr) {
  const now = Date.now();
  const match = timeStr.match(/^(\d+)([hdwm])$/);
  
  if (match) {
    const [_, value, unit] = match;
    const multipliers = {
      'h': 60 * 60 * 1000,        // hours
      'd': 24 * 60 * 60 * 1000,   // days
      'w': 7 * 24 * 60 * 60 * 1000, // weeks
      'm': 30 * 24 * 60 * 60 * 1000  // months (approximate)
    };
    return now - (parseInt(value) * multipliers[unit]);
  }
  
  // Handle special keywords
  const keywords = {
    'today': () => new Date().setHours(0,0,0,0),
    'yesterday': () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.setHours(0,0,0,0);
    },
    'thisweek': () => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay()); // Start of week
      return d.setHours(0,0,0,0);
    },
    'recent': () => now - (30 * 60 * 1000) // 30 minutes
  };
  
  return keywords[timeStr]?.() || now;
}
```

### Real-World URLs
```
# Morning catch-up
http://localhost:3000/#time=8h&u=teammates

# Today's important messages
http://localhost:3000/#time=today&word=urgent+important

# This week's questions
http://localhost:3000/#time=thisweek&search=question

# Recent activity
http://localhost:3000/#time=recent&has=link
```

### Pros ✅
- Very user-friendly and intuitive
- URLs remain valid over time (always relative to "now")
- Easy to type and remember
- Great for recurring use cases ("morning catch-up")

### Cons ❌
- Can't specify exact dates
- "Last 24h" means different things at different times
- Not suitable for historical references

---

## 📆 Proposal 2: Absolute Date Ranges

### Concept
Use specific dates and times for precise filtering. Supports both single dates and ranges.

### URL Parameter: `date=`

#### Syntax Examples

**Single Dates:**
```
#date=2024-01-19           → Specific day only
#date=2024-01-19T14:30     → From specific time
#date=2024-01              → Entire month
#date=2024                  → Entire year
```

**Date Ranges (using dash):**
```
#date=2024-01-19-2024-01-21     → Jan 19-21, 2024
#date=2024-01-19T09:00-17:00    → Single day, 9am-5pm
#date=2024-01-2024-02            → Jan-Feb 2024
```

**Special Syntax:**
```
#date=>2024-01-19          → After Jan 19, 2024
#date=<2024-01-19          → Before Jan 19, 2024
#date=2024-01-19-          → From Jan 19 onwards
#date=-2024-01-19          → Up to Jan 19
```

**Combining Dates (with +):**
```
#date=2024-01-19+2024-01-25+2024-02-01
→ Show messages from these specific dates

#date=2024-01-19-21+2024-02-01-03
→ Multiple date ranges
```

### Implementation Example
```javascript
function parseAbsoluteDate(dateStr) {
  // Handle range with dash
  if (dateStr.includes('-') && !dateStr.startsWith('-')) {
    const [start, end] = dateStr.split('-');
    return {
      start: parseDate(start),
      end: parseDate(end || 'now')
    };
  }
  
  // Handle greater than/less than
  if (dateStr.startsWith('>')) {
    return { start: parseDate(dateStr.slice(1)), end: Date.now() };
  }
  if (dateStr.startsWith('<')) {
    return { start: 0, end: parseDate(dateStr.slice(1)) };
  }
  
  // Single date
  const date = parseDate(dateStr);
  return {
    start: date,
    end: date + (24 * 60 * 60 * 1000) // Default to full day
  };
}

function parseDate(str) {
  if (str === 'now') return Date.now();
  
  // Handle various formats
  const formats = [
    /^\d{4}$/,              // Year only
    /^\d{4}-\d{2}$/,        // Year-month
    /^\d{4}-\d{2}-\d{2}$/,  // Full date
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ // Date and time
  ];
  
  return new Date(str).getTime();
}
```

### Real-World URLs
```
# Specific event discussion
http://localhost:3000/#date=2024-01-19&search=launch

# Weekly meeting notes
http://localhost:3000/#date=2024-01-15-2024-01-19&u=teamlead

# Historical reference
http://localhost:3000/#date=2023-12&word=announcement

# Business hours only
http://localhost:3000/#date=2024-01-19T09:00-17:00
```

### Pros ✅
- Precise and unambiguous
- Perfect for referencing specific events
- Can bookmark exact time periods
- Good for compliance/audit trails

### Cons ❌
- Less intuitive to type
- URLs become stale (fixed to specific dates)
- Longer and more complex syntax

---

## 🎯 Recommendation: Hybrid Approach

### Why Not Both?

Implement both `time=` for relative ranges AND `date=` for absolute dates. They serve different use cases:

- **Use `time=`** for daily workflows, catching up, recent activity
- **Use `date=`** for historical references, specific events, audit trails

### Combined Examples
```
# Recent activity since last Monday
#time=thisweek&date=>2024-01-15

# Today's messages excluding lunch hour
#time=today&date=2024-01-19T00:00-12:00+2024-01-19T13:00-23:59

# Fallback: if date is too old, use time
#date=2024-01-01&time=7d
(Shows Jan 1, 2024 if available, otherwise last 7 days)
```

### Priority Rules
1. If both `time=` and `date=` are present:
   - `date=` takes precedence for historical data
   - `time=` acts as a fallback or additional filter
2. Invalid dates fall back to `time=` parameter
3. No parameters = show all messages

---

## 📊 Comparison Table

| Feature | Relative (`time=`) | Absolute (`date=`) | 
|---------|-------------------|-------------------|
| **Ease of Use** | ⭐⭐⭐⭐⭐ Very easy | ⭐⭐⭐ Moderate |
| **Precision** | ⭐⭐⭐ Good enough | ⭐⭐⭐⭐⭐ Exact |
| **URL Longevity** | ⭐⭐⭐⭐⭐ Always valid | ⭐⭐ Gets outdated |
| **Shareability** | ⭐⭐⭐⭐ Great for workflows | ⭐⭐⭐⭐⭐ Perfect for events |
| **Length** | ⭐⭐⭐⭐⭐ Short (e.g., `1h`) | ⭐⭐ Long dates |
| **Use Cases** | Daily tasks, catch-up | Historical, audit, events |

---

## 🚀 Implementation Priority

### Phase 1: Relative Time (Quick Win)
Start with `time=` parameter supporting:
- Basic units: `1h`, `24h`, `7d`
- Keywords: `today`, `yesterday`, `recent`

### Phase 2: Absolute Dates
Add `date=` parameter with:
- Single dates: `2024-01-19`
- Date ranges: `2024-01-19-2024-01-21`

### Phase 3: Advanced Features
- Time of day: `T09:00-17:00`
- Operators: `>`, `<`, `-`
- Multiple ranges with `+`

This phased approach allows quick deployment of the most useful features while building toward comprehensive date filtering.
