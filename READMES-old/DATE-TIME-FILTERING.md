# Date & Time Filtering System

## Overview
The Say What Want date/time filtering system provides powerful temporal filtering through URL parameters, supporting both absolute dates/times and relative time ranges using a unified, flexible syntax.

## Core Parameters

### `from=` - Start of time range
Defines when to start showing messages.

### `to=` - End of time range  
Defines when to stop showing messages.

### `timeFrom=` - Relative start time (Alternative)
Alternative to `from=` for relative times only.

### `timeTo=` - Relative end time (Alternative)
Alternative to `to=` for relative times only.

## Syntax Rules

### 1. **Absolute Dates**
```
YYYY-MM-DD
```
Example: `2025-01-19` = January 19, 2025

### 2. **Absolute Date + Time**
```
YYYY-MM-DDTHH:MM
```
Example: `2025-01-19T14:30` = January 19, 2025 at 2:30 PM

### 3. **Relative Time (Minutes)**
```
T[minutes]
```
- `T5` = 5 minutes ago
- `T60` = 60 minutes ago (1 hour)
- `T1440` = 1440 minutes ago (24 hours)
- `T0` = Now (current moment)

### 4. **Special Keywords**
- `now` = Current moment (equivalent to `T0`)
- `today` = Start of today
- `yesterday` = Start of yesterday
- `week` = 7 days ago
- `month` = 30 days ago

## Basic Examples

### Show Last Hour
```
#from=T60&to=T0
#from=T60&to=now
#timeFrom=60&timeTo=0
```
All three are equivalent: Messages from 60 minutes ago until now.

### Show Yesterday
```
#from=yesterday&to=today
```
All messages from yesterday.

### Show Specific Date
```
#from=2025-01-19&to=2025-01-20
```
All messages on January 19, 2025.

### Show Last 30 Minutes
```
#from=T30
```
When `to=` is omitted, defaults to now.

## Complex Examples

### 1. Mixed: Absolute Date/Time to Relative Minutes
```
#from=2025-01-19T14:30&to=T120
```
**Shows:** Messages from January 19, 2025 at 2:30 PM until 120 minutes (2 hours) ago.

### 2. Relative Window in the Past
```
#from=T10080&to=T1440
```
**Shows:** Messages from 7 days ago (10080 min) to 24 hours ago (1440 min). A 6-day window that ended yesterday.

### 3. Precise Time Window with Search
```
#from=2025-01-19T09:00&to=T0&search=meeting
```
**Shows:** All messages containing "meeting" from January 19, 2025 at 9:00 AM until now.

### 4. Absolute Start to Absolute End with Filters
```
#from=2025-01-18T08:00&to=2025-01-19T17:00&u=alice+bob&word=important
```
**Shows:** Messages from Alice or Bob containing "important" between Jan 18 8AM and Jan 19 5PM.

### 5. Last Week's Activity from Specific User
```
#from=T10080&to=T0&u=johndoe
```
**Shows:** All messages from johndoe in the last 7 days (10080 minutes).

### 6. Business Hours Window
```
#from=2025-01-19T09:00&to=2025-01-19T17:00&-word=spam+advertisement
```
**Shows:** Messages from 9 AM to 5 PM on Jan 19, excluding spam and advertisements.

### 7. Rolling 24-Hour Window Ending 2 Hours Ago
```
#from=T1560&to=T120
```
**Shows:** Messages from 26 hours ago (1560 min) to 2 hours ago (120 min).

### 8. Future Planning (Edge Case)
```
#from=T0&to=2025-12-31
```
**Shows:** Technically "from now until end of year" - useful for scheduled/future messages if supported.

### 9. Combine All Filter Types
```
#from=T4320&to=now&u=alice+bob+charlie&search=project&word=update+release&-word=test+debug&wordremove=confidential&video=demo1
```
**Shows:** Last 3 days of messages from Alice, Bob, or Charlie, searching for "project", highlighting "update" or "release", excluding messages with "test" or "debug", silently hiding anything with "confidential", while playing demo1 video.

### 10. Meeting Notes from Morning
```
#from=today&to=T0&search=meeting+standup+sync
```
**Shows:** All messages from start of today until now that mention meetings, standups, or syncs.

## Time Unit Reference

### Common Conversions
- **1 hour** = `T60`
- **2 hours** = `T120`
- **6 hours** = `T360`
- **12 hours** = `T720`
- **1 day** = `T1440`
- **2 days** = `T2880`
- **3 days** = `T4320`
- **1 week** = `T10080`
- **2 weeks** = `T20160`
- **30 days** = `T43200`
- **90 days** = `T129600`
- **180 days** = `T259200`
- **365 days** = `T525600`

### Quick Math
- Minutes in hour: 60
- Minutes in day: 1,440
- Minutes in week: 10,080
- Minutes in 30 days: 43,200
- Minutes in year: 525,600

## Edge Cases & Error Handling

### 1. Backwards Dates (Auto-Correction)
```
#from=2025-01-20&to=2025-01-19
```
**System behavior:** Automatically swaps to `from=2025-01-19&to=2025-01-20`

### 2. Invalid Date Format (Graceful Fallback)
```
#from=2025-13-45T25:99&to=T0
```
**System behavior:** 
- Ignores invalid `from` (month 13, day 45, hour 25 don't exist)
- Keeps valid `to=T0`
- Shows all messages until now

### 3. Both Parameters Invalid
```
#from=invalid&to=alsobad
```
**System behavior:** Falls back to showing ALL messages (no time filter applied)

### 4. T0 in From Parameter
```
#from=T0&to=T60
```
**System behavior:** 
- Technically means "from now to 60 minutes ago"
- Auto-swaps to show last 60 minutes instead
- `T0` in `from=` is valid syntax but practically useless

### 5. Negative T Values
```
#from=T-60
```
**System behavior:** 
- Negative values could mean future
- Typically ignored or treated as T0
- Not recommended for use

### 6. Missing One Parameter
```
#from=2025-01-19
```
**System behavior:** 
- When `to=` is missing, defaults to `now`
- When `from=` is missing, shows all messages up to `to=`

### 7. Partial Date/Time
```
#from=2025-01-19T14
```
**System behavior:**
- Missing minutes default to :00
- `T14` = 2:00 PM
- `T14:3` = Invalid, must be `T14:30`

## Combination with Other Filters

Date/time filters work seamlessly with all other URL parameters:

### Example: Morning Standup Review
```
#from=today&to=T0&search=standup&u=teamlead&word=blocker+help
```
Shows today's standup messages from teamlead, highlighting "blocker" and "help"

### Example: Weekly Report Prep
```
#from=week&to=now&word=completed+shipped+deployed&-word=wip+todo
```
Shows last week's accomplishments, hiding work-in-progress items

### Example: Debug Session
```
#from=T180&to=T0&search=error+exception+fail&u=devops&video=false
```
Shows last 3 hours of error messages from devops team, video panel closed

## URL Structure Examples

### Single Filter
```
https://example.com/#from=T60
```

### Multiple Time Filters
```
https://example.com/#from=2025-01-19&to=2025-01-20
```

### Combined with Other Filters
```
https://example.com/#from=T1440&to=now&u=alice&search=urgent&word=action
```

### Full URL with All Parameters
```
https://example.com/#from=2025-01-19T09:00&to=2025-01-19T17:00&u=team+manager&search=meeting&word=decision+action&-word=postponed&wordremove=private&video=presentation1
```

## Best Practices

1. **Use T notation for recent ranges**: `T60` is cleaner than calculating exact timestamps
2. **Include both from and to**: More explicit and prevents confusion
3. **Use keywords when appropriate**: `yesterday`, `today`, `week` are more readable
4. **Test backwards ranges**: System auto-corrects but better to get it right
5. **Combine with user filters**: Time + user is powerful for finding specific conversations
6. **Use wordremove for sensitive content**: Silently hide without showing in filter bar

## Implementation Notes

### Parser Priority
1. Check for `T` prefix → Parse as relative minutes
2. Check for `:` in date → Parse as absolute date + time
3. Check for `-` in string → Parse as absolute date
4. Check for keywords → Convert to appropriate value
5. Invalid → Ignore parameter or fallback to all

### Storage Format
Internally, all times are converted to Unix timestamps for consistent comparison:
- Absolute dates: Direct conversion
- Relative times: Current time minus minutes
- Keywords: Converted to appropriate timestamp

### Timezone Handling
- All times are in user's local timezone
- Server stores in UTC
- Client converts for display

## Future Enhancements (Potential)

- **Recurring windows**: `#recurring=daily&from=09:00&to=17:00`
- **Named ranges**: `#range=thisweek`, `#range=lastmonth`
- **Relative date math**: `#from=today-7&to=today+7`
- **Duration parameter**: `#from=2025-01-19&duration=1d`
- **Exclude ranges**: `#exclude=2025-01-01&excludeTo=2025-01-07`

## Quick Reference Card

```
Common Patterns:
#from=T60                     → Last hour
#from=T1440                   → Last 24 hours
#from=T10080                  → Last week
#from=yesterday&to=today      → Yesterday only
#from=week&to=now             → Last 7 days
#from=2025-01-19              → From Jan 19 until now
#to=2025-01-19                → Everything until Jan 19
#from=T60&to=T30              → 30-60 minutes ago
#from=2025-01-19T09:00&to=2025-01-19T17:00 → Business hours

Combine with filters:
&u=alice                      → + from user alice
&search=urgent                → + search for urgent
&word=important               → + highlight important
&-word=spam                   → + exclude spam
&wordremove=sensitive         → + hide sensitive
&video=demo1                  → + play demo1 video
```

## Testing Checklist

- [ ] Basic relative time (T60)
- [ ] Basic absolute date (2025-01-19)
- [ ] Absolute date + time (2025-01-19T14:30)
- [ ] Keywords (now, today, yesterday, week)
- [ ] Backwards range auto-correction
- [ ] Invalid date fallback
- [ ] Missing parameter defaults
- [ ] Combination with user filters
- [ ] Combination with search
- [ ] Combination with word filters
- [ ] URL encoding/decoding
- [ ] Browser back/forward navigation
- [ ] Timezone consistency
- [ ] Performance with large date ranges
- [ ] Edge cases (T0, negative values)

---

*Last Updated: January 2025*
*Version: 1.0.0*
