# Unified Date & Time Filtering Proposal

## 🎯 Overview

A comprehensive system that combines both relative and absolute date/time filtering with explicit start and end points for maximum flexibility and precision.

## 📅 Proposed URL Structure

### Primary Parameters

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `from=` | Start date/time | `from=2024-01-19` |
| `to=` | End date/time | `to=2024-01-20` |
| `timeFrom=` | Relative start | `timeFrom=2h` (2 hours ago) |
| `timeTo=` | Relative end | `timeTo=now` |

## 🔧 Implementation Approach

### 1. Absolute Date/Time (`from=` and `to=`)

#### Full DateTime Format
```
#from=2024-01-19T09:00&to=2024-01-19T17:00
→ Business hours on Jan 19, 2024

#from=2024-01-19&to=2024-01-21
→ Jan 19-21, 2024 (inclusive)

#from=2024-01-19T14:30:00&to=2024-01-19T15:30:00
→ Specific hour with seconds precision
```

#### Supported Formats
- `YYYY-MM-DD` - Full day
- `YYYY-MM-DDTHH:MM` - To the minute
- `YYYY-MM-DDTHH:MM:SS` - To the second
- `YYYY-MM` - Entire month
- `YYYY` - Entire year

#### One-sided Ranges
```
#from=2024-01-19
→ Everything from Jan 19, 2024 onwards

#to=2024-01-19
→ Everything up to Jan 19, 2024

#from=2024-01-19T14:00
→ From 2pm on Jan 19 onwards
```

### 2. Relative Time (`timeFrom=` and `timeTo=`)

#### Time Units
```
#timeFrom=5m&timeTo=now
→ Last 5 minutes

#timeFrom=2h&timeTo=30m
→ From 2 hours ago to 30 minutes ago

#timeFrom=7d&timeTo=1d
→ From 7 days ago to 1 day ago (6-day window)
```

#### Supported Units
- `s` - seconds (e.g., `30s`)
- `m` - minutes (e.g., `5m`)
- `h` - hours (e.g., `2h`)
- `d` - days (e.g., `7d`)
- `w` - weeks (e.g., `2w`)
- `M` - months (e.g., `3M`)

#### Special Keywords
- `now` - Current moment
- `today` - Start of today
- `yesterday` - Start of yesterday
- `thisweek` - Start of current week
- `lastweek` - Start of last week
- `thismonth` - Start of current month
- `lastmonth` - Start of last month

### 3. Mixed Mode (Combining Both)

#### Relative + Absolute
```
#from=2024-01-19&timeTo=1h
→ From Jan 19, 2024 to 1 hour ago

#timeFrom=7d&to=2024-01-19T18:00
→ From 7 days ago until 6pm on Jan 19

#from=2024-01-19T09:00&timeTo=now
→ From 9am Jan 19 until now
```

## 💻 Real-World URL Examples

### Business Hours Today
```
#timeFrom=today&from=T09:00&to=T17:00
```
Combines "today" with specific hours

### Last Week's Activity
```
#timeFrom=7d&timeTo=now
```
Simple relative range

### Specific Meeting Window
```
#from=2024-01-19T14:00&to=2024-01-19T15:30
```
Exact meeting time

### Weekend Messages
```
#from=2024-01-20T00:00&to=2024-01-21T23:59
```
Full weekend coverage

### Recent Activity Window
```
#timeFrom=30m&timeTo=5m
```
30 minutes ago to 5 minutes ago (25-minute window)

### Historical Event
```
#from=2024-01-15T09:00&to=2024-01-15T17:00&search=presentation
```
Specific day with search

### Overnight Monitoring
```
#from=2024-01-19T22:00&to=2024-01-20T06:00
```
Night shift coverage

## 🏗️ Technical Implementation

### URL Parser Function
```javascript
function parseDateTimeFilters(params) {
  const result = {
    start: null,
    end: null
  };
  
  // Parse absolute dates
  if (params.from) {
    result.start = parseAbsoluteDateTime(params.from);
  }
  if (params.to) {
    result.end = parseAbsoluteDateTime(params.to);
  }
  
  // Parse relative times (override if present)
  if (params.timeFrom) {
    result.start = parseRelativeTime(params.timeFrom);
  }
  if (params.timeTo) {
    result.end = parseRelativeTime(params.timeTo);
  }
  
  // Validate range
  if (result.start && result.end && result.start > result.end) {
    // Swap if reversed
    [result.start, result.end] = [result.end, result.start];
  }
  
  // Default behaviors
  if (!result.start && result.end) {
    result.start = 0; // Beginning of time
  }
  if (result.start && !result.end) {
    result.end = Date.now(); // Current time
  }
  
  return result;
}

function parseAbsoluteDateTime(str) {
  // Handle time-only format (T09:00)
  if (str.startsWith('T')) {
    const today = new Date().toISOString().split('T')[0];
    str = today + str;
  }
  
  // Parse various formats
  const date = new Date(str);
  
  // If only date provided (no time), set sensible defaults
  if (!str.includes('T')) {
    if (str.length === 10) { // YYYY-MM-DD
      date.setHours(0, 0, 0, 0); // Start of day
    }
  }
  
  return date.getTime();
}

function parseRelativeTime(str) {
  // Handle keywords
  const keywords = {
    'now': () => Date.now(),
    'today': () => new Date().setHours(0, 0, 0, 0),
    'yesterday': () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.setHours(0, 0, 0, 0);
    },
    'thisweek': () => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay());
      return d.setHours(0, 0, 0, 0);
    },
    'lastweek': () => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay() - 7);
      return d.setHours(0, 0, 0, 0);
    },
    'thismonth': () => {
      const d = new Date();
      d.setDate(1);
      return d.setHours(0, 0, 0, 0);
    },
    'lastmonth': () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1, 1);
      return d.setHours(0, 0, 0, 0);
    }
  };
  
  if (keywords[str]) {
    return keywords[str]();
  }
  
  // Parse relative units (5m, 2h, 7d)
  const match = str.match(/^(\d+)([smhdwM])$/);
  if (match) {
    const [_, value, unit] = match;
    const multipliers = {
      's': 1000,                    // seconds
      'm': 60 * 1000,               // minutes
      'h': 60 * 60 * 1000,          // hours
      'd': 24 * 60 * 60 * 1000,     // days
      'w': 7 * 24 * 60 * 60 * 1000, // weeks
      'M': 30 * 24 * 60 * 60 * 1000 // months (approx)
    };
    
    return Date.now() - (parseInt(value) * multipliers[unit]);
  }
  
  return null;
}
```

## 🎨 UI/UX Enhancements

### Quick Presets
Add buttons for common time ranges:
```
[Last Hour] [Today] [Yesterday] [This Week] [Last 7 Days] [Custom]
```

These would generate URLs like:
- Last Hour: `#timeFrom=1h&timeTo=now`
- Today: `#timeFrom=today&timeTo=now`
- Yesterday: `#from=yesterday&to=yesterday`
- This Week: `#timeFrom=thisweek&timeTo=now`
- Last 7 Days: `#timeFrom=7d&timeTo=now`

### Visual Time Range Display
Show the active time range clearly:
```
📅 Showing: Jan 19, 2024 09:00 - 17:00 (8 hours)
📅 Showing: Last 2 hours
📅 Showing: Today 9am - 5pm
```

### Date/Time Picker Integration
For custom ranges, provide a dual date/time picker that generates the URL:
```
From: [📅 2024-01-19] [🕐 09:00]
To:   [📅 2024-01-19] [🕐 17:00]
→ Generates: #from=2024-01-19T09:00&to=2024-01-19T17:00
```

## 📊 Comparison with Previous Proposals

| Aspect | Previous (Separate) | New (Unified) |
|--------|-------------------|---------------|
| **Precision** | Good | Excellent |
| **Flexibility** | Limited | Maximum |
| **URL Length** | Short | Moderate |
| **Learning Curve** | Easy | Moderate |
| **Use Cases** | Basic | All scenarios |

## 🚀 Implementation Phases

### Phase 1: Basic Structure (Week 1)
- [ ] Implement `from=` and `to=` with dates only
- [ ] Basic validation and parsing
- [ ] Apply to comment filtering

### Phase 2: Time Precision (Week 2)
- [ ] Add time support (HH:MM:SS)
- [ ] Time-only format (T09:00)
- [ ] Timezone handling

### Phase 3: Relative Time (Week 3)
- [ ] Implement `timeFrom=` and `timeTo=`
- [ ] Support all time units (s, m, h, d, w, M)
- [ ] Add keywords (now, today, etc.)

### Phase 4: UI Integration (Week 4)
- [ ] Quick preset buttons
- [ ] Visual range display
- [ ] Date/time picker component

### Phase 5: Advanced Features
- [ ] Recurring patterns (every Monday, weekends)
- [ ] Multiple ranges with OR logic
- [ ] Saved time range presets

## ✅ Benefits of This Approach

1. **Maximum Flexibility** - Handles any time range scenario
2. **Intuitive Defaults** - Smart handling of partial inputs
3. **Backward Compatible** - Can still use simple formats
4. **Precise Control** - Down to the second when needed
5. **Human Friendly** - Keywords and relative times for ease
6. **Machine Friendly** - ISO format for precision
7. **Shareable** - URLs capture exact time windows

## 🔗 Example URL Combinations

### Morning Standup
```
#from=T09:00&to=T09:30&u=team&word=standup
```

### Last 24 Hours Excluding Night
```
#timeFrom=24h&timeTo=now&from=T06:00&to=T23:00
```

### Weekend On-Call Review
```
#from=2024-01-20T00:00&to=2024-01-21T23:59&word=alert+error
```

### Quick Catch-up (Last 30 min)
```
#timeFrom=30m&timeTo=now
```

### Historical Analysis
```
#from=2024-01-01&to=2024-01-31&search=bug&sort=oldest
```

## 📝 Summary

This unified approach provides:
- **Start and end dates** via `from=` and `to=`
- **Start and end times** via the same parameters with time notation
- **Relative ranges** via `timeFrom=` and `timeTo=`
- **Mixed mode** combining absolute and relative
- **Smart defaults** for partial inputs
- **Human-readable** keywords and units

The system is powerful enough for precise historical queries while remaining simple for everyday use cases like "show me the last hour" or "what happened today".
