# 225 - HigherMind Video Overlay & Share System

## Overview

This document covers the video drawer entity overlay system in HIGHERMIND-site, including:
- Entity thumbnail with share functionality
- Amazon book integration with affiliate links
- Description text display
- Configurable styling for all elements

## File Location

```
HIGHERMIND-site/components/Tabs/VideoTab/VideoDrawer.tsx
```

## Entity Overlay Structure

The overlay appears at the bottom of the video drawer when a model is selected:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      (video playing)                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐    ┌─────────────────┐    ┌─────────────┐    │
│   │ (share) │    │                 │    │ AI MODEL    │    │
│   │  SHARE  │    │  Description    │    │  BASED ON   │    │
│   │         │    │  text area      │    │ ┌─────────┐ │    │
│   │ [thumb] │    │  (optional)     │    │ │ [book]  │ │    │
│   │         │    │                 │    │ └─────────┘ │    │
│   │  Copy   │    │                 │    │ View on     │    │
│   │  Direct │    │                 │    │ Amazon      │    │
│   │  Link   │    │                 │    └─────────────┘    │
│   └─────────┘    └─────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Share Functionality

### How It Works

- Clicking the thumbnail, "SHARE" text, or "Copy Direct Link" copies the shareable URL
- URL format: `https://highermind.ai/#m=ENTITY_NAME`
- After copying, text changes to "Copied for Sharing" for 2 seconds

### Configurable Settings (lines ~55-58)

```typescript
const copiedFeedbackDuration = 2000;  // How long "Copied for Sharing" shows (ms)
const shareUrlBase = 'https://highermind.ai/#m=';  // Base URL for sharing
```

### "SHARE" Label Styling (line ~345)

```typescript
style={{ 
  fontSize: '10px',           // Text size
  color: 'white',             // 'white', userColorRgb, '#hexcode'
  opacity: 0.6,               // 0-1
  textTransform: 'uppercase', // 'uppercase', 'lowercase', 'capitalize', 'none'
  fontWeight: 700,            // 400=normal, 500=medium, 600=semibold, 700=bold
}}
```

### "Copy Direct Link" / "Copied for Sharing" Styling (line ~380)

```typescript
style={{ 
  fontSize: '8px',             // Text size
  color: 'white',              // 'white', userColorRgb, '#hexcode'
  opacity: 0.6,                // 0-1
  textTransform: 'uppercase',  // 'uppercase', 'lowercase', 'capitalize', 'none'
  fontWeight: 700,             // 400=normal, 500=medium, 600=semibold, 700=bold
}}
```

---

## 2. Description Text (Optional)

### Show/Hide Toggle (line ~330)

```typescript
const showDescription = false;  // true=show, false=hide description
```

### Description Styling (line ~400)

```typescript
style={{
  fontSize: '10px',            // Fixed size
  color: 'white',              // 'white', userColorRgb, '#hexcode'
  opacity: 0.7,                // 0-1
  textTransform: 'none',       // 'none'=Normal Case, 'uppercase', 'lowercase', 'capitalize'
  fontWeight: 500,             // 400=normal, 500=medium, 600=semibold, 700=bold
  textAlign: 'justify',        // 'left', 'center', 'right', 'justify'
}}
```

### Container Settings

```typescript
style={{ 
  width: '200px',              // Fixed width for description
  maxHeight: '140px',
  overflowY: 'auto',           // Scrolls if text is too long
  overflowX: 'hidden',
}}
```

---

## 3. Amazon Book Integration

### Config Structure (config-aientities.json)

```json
{
  "emotional-support-therapist": {
    "display-name": "EmotionalSupport",
    "entity": "emotional-support-therapist",
    "amazon-link": "https://a.co/d/xxxxx",
    "amazon-affiliate-link": "https://a.co/d/xxxxx",
    "description": "I enhance self-awareness...",
    "keywords": ["emotional", "support", "therapist"]
  }
}
```

### Book Image Location

```
HIGHERMIND-site/public/images/books/{entity}.webp
                                    {entity}.jpg
                                    {entity}.png
```

The system tries formats in order: webp → jpg → png

### "AI MODEL BASED ON" Label Styling (line ~420)

```typescript
style={{ 
  fontSize: '8px',
  color: 'white',
  opacity: 0.6,
  textTransform: 'uppercase',
  fontWeight: 700,
}}
```

### "View on Amazon" Link Styling (line ~450)

```typescript
style={{ 
  fontSize: '8px',
  color: 'white',
  opacity: 0.6,
  textTransform: 'uppercase',
  fontWeight: 700,
}}
```

---

## 4. Image Heights

Both the model thumbnail and book image use the same height:

```typescript
className="h-[130px] w-auto object-contain rounded-lg shadow-lg"
```

---

## 5. URL Hash System Reference

The share URL uses the HigherMind hash system:

| Format | Example |
|--------|---------|
| Single model | `highermind.ai/#m=the-eternal` |
| Multiple | `highermind.ai/#m=1984+art-of-war` |

See `docs/url-hash-system.md` for full documentation.

---

## 6. Related Files

| File | Purpose |
|------|---------|
| `VideoDrawer.tsx` | Main overlay component |
| `config-aientities.json` | Model metadata + amazon links |
| `/images/books/` | Local book cover storage |
| `lib/constants.ts` | IMAGE_PATHS.BOOKS constant |
| `lib/modelLoader.ts` | Loads amazon fields into AIModel |
| `types/model.ts` | AIModel type with amazon fields |
| `types/video.ts` | VideoDrawerProps with model prop |

---

## 7. Future: Amazon PA-API

Currently using local book images. Future implementation will:

1. Use `amazon-link` field to query Amazon PA-API
2. Dynamically fetch product images
3. Cache results for performance

The `amazon-link` field is already present for this purpose.

---

## Changelog

- **2024-12-16**: Initial implementation
  - Share functionality with clipboard copy
  - Amazon book integration with affiliate links
  - Description text toggle
  - Full styling control for all text elements

