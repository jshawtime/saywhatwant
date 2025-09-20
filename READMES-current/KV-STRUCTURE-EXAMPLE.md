# Cloudflare KV Structure Examples

## Individual Comment Entry

**Key Format**: `comment:{timestamp}:{unique-id}`  
**Example Key**: `comment:1726800123456:abc123def456`

**Value (JSON)**:
```json
{
  "id": "1726800123456-xyz789abc",
  "text": "It feels like I just say things and they happen",
  "timestamp": 1726800123456,
  "username": "god",
  "color": "rgb(185, 142, 40)",
  "domain": "saywhatwant.app",
  "language": "en",
  "misc": ""
}
```

## Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique identifier | `"1726800123456-xyz789abc"` |
| `text` | string | Message content (max 201 chars) | `"Hello world"` |
| `timestamp` | number | Unix timestamp in ms | `1726800123456` |
| `username` | string | User's display name (max 16 chars) | `"god"` |
| `color` | string | User's chosen RGB color | `"rgb(185, 142, 40)"` |
| `domain` | string | Origin domain | `"saywhatwant.app"` |
| `language` | string | Language code (ISO 639-1) | `"en"` |
| `misc` | string | Miscellaneous data field | `""` |

## Cache Entry

**Key**: `recent:comments`  
**Value**: Array of all recent comments (JSON)

```json
[
  {
    "id": "1726800000000-abc123",
    "text": "First message",
    "timestamp": 1726800000000,
    "username": "user1",
    "color": "rgb(96, 165, 250)",
    "domain": "localhost:3000",
    "language": "en",
    "misc": ""
  },
  {
    "id": "1726800123456-def456",
    "text": "Second message with a video link [video:xyz123] <-- video",
    "timestamp": 1726800123456,
    "username": "god",
    "color": "rgb(185, 142, 40)",
    "domain": "saywhatwant.app",
    "language": "en",
    "misc": "test-data"
  },
  {
    "id": "1726800234567-ghi789",
    "text": "Third message from another domain",
    "timestamp": 1726800234567,
    "username": "anonymous",
    "color": "rgb(200, 100, 150)",
    "domain": "shittosay.app",
    "language": "en",
    "misc": ""
  }
]
```

## Rate Limit Entry

**Key Format**: `rate:{ip-address}`  
**Example Key**: `rate:192.168.1.1`  
**Value**: `"1"` to `"10"` (increments with each post)  
**TTL**: 60 seconds  
**Limit**: 10 messages per minute per IP

## Storage Statistics

- **Max Comment Length**: 201 characters
- **Max Username Length**: 16 characters
- **Cache Size**: Last 1000 comments
- **KV List Limit**: 1000 keys per request
- **Rate Limit**: 10 posts per minute per IP
- **Key Prefix Pattern**: `comment:` for all comments
- **Default Language**: `en` (English)
- **Misc Field**: Open for future use

## Color Format Evolution

### Old Format (deprecated)
```json
"color": "#60A5FA"  // Hex format
```

### Current Format
```json
"color": "rgb(96, 165, 250)"  // RGB format
```

## Domain Examples

```json
// Local development
"domain": "localhost:3000"

// Production domains
"domain": "saywhatwant.app"
"domain": "shittosay.app"
"domain": "yournewdomain.com"

// Unknown/fallback
"domain": "unknown"
```

## Special Content Patterns

### Video Links
```json
"text": "Check this out [video:abc123xyz] <-- video"
```

### Filterable Words
Any word in the message can be clicked to filter by it:
```json
"text": "thinking about things that happen"
// Users can click: "thinking", "things", "happen"
```

## Data Lifecycle

1. **POST**: Comment created → Stored with key `comment:{timestamp}:{id}`
2. **CACHE**: Added to `recent:comments` array
3. **GET**: Retrieved from cache or individual keys
4. **FILTER**: Applied on retrieval (search, domain, etc.)
5. **EXPIRE**: No automatic expiry (permanent storage)

## Important Notes

- **No userAgent**: Previously stored but removed to save space
- **No IP storage**: Only used for rate limiting, not stored with comments
- **Sanitization**: Text and username are sanitized before storage
- **Sorting**: Comments always sorted by timestamp (oldest to newest)
- **Backwards Compatibility**: System handles both old hex colors and new RGB format
- **Language Field**: Currently defaults to 'en', ready for i18n support
- **Misc Field**: Flexible string field for future features or metadata
- **Rate Limit**: 10 messages per minute per IP (increased from 1)
