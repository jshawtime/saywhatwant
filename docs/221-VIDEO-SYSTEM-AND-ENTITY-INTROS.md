# Doc 221: Video System & Entity Intro Videos

> **Created**: December 12, 2025  
> **Updated**: December 12, 2025  
> **Status**: Active

---

## 1. Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  VideoPlayer    │────▶│  R2 Manifest     │────▶│  Cloudflare R2  │
│  Component      │     │  (JSON)          │     │  Bucket         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

| Component | Value |
|-----------|-------|
| **R2 Bucket** | `sww-videos` |
| **Public URL** | `https://pub-56b43531787b4783b546dd45f31651a7.r2.dev` |
| **Manifest** | `https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/video-manifest.json` |

---

## 2. Video Types

| Type | Naming | Behavior | Audio |
|------|--------|----------|-------|
| **Background** | `sww-XXXXX.mp4` | Random shuffle, plays immediately | 🔇 Muted |
| **Entity Intro** | `[entity-id].mov` | Buffer first, play once with breathing animation | 🔊 Sound ON |

---

## 3. Entity Intro Videos

### URL Trigger

Intro videos are triggered via **URL hash parameter**:

```
#entity=the-eternal&intro-video=true
```

| URL | Behavior |
|-----|----------|
| `#entity=the-eternal` | Background videos only |
| `#entity=the-eternal&intro-video=true` | Play intro → then backgrounds |

### Playback Flow

```
1. User clicks on highermind.ai
2. Iframe opens saywhatwant.app with #intro-video=true
3. Video loads immediately (first frame visible)
4. BREATHING ANIMATION while buffering
5. Wait for canplaythrough + opacity at 100%
6. Play video with audio
7. After intro ends → random backgrounds (muted)
```

> **Note:** If a version mismatch causes a page reload (rare, only after deployments), the video simply restarts. No artificial delay needed.

### Buffering UX (Intro Videos Only)

Large intro videos (~100MB) need buffer time. Bad UX = video starts then restarts.

**Solution: Breathing Animation**

```
┌─────────────────────────────────────────────┐
│  First frame visible                        │
│  Opacity: 30% → 100% → 30% (1.5s cycle)     │
│  Wait for: canplaythrough event             │
│  Play when: buffered AND opacity at 100%    │
└─────────────────────────────────────────────┘
```

| Phase | Opacity | Animating | Audio |
|-------|---------|-----------|-------|
| Buffering | 30%↔100% | Yes (breathing) | Silent |
| Ready (peak 100%) | 100% | Stop | Play with sound |

**CSS Animation:**
```css
@keyframes breathing {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.video-buffering {
  animation: breathing 1.5s ease-in-out infinite;
}
```

**Natural Transition Logic:**
- Wait for `canplaythrough` event (sufficient buffer)
- Wait for breathing cycle to reach 100% opacity
- Then start playback → feels seamless

---

## 4. Iframe Embed (highermind.ai)

Intro videos autoplay with sound via iframe from highermind.ai:

```
User clicks on highermind.ai
        ↓
User gesture captured
        ↓
Iframe opens with allow="autoplay"
        ↓
saywhatwant.app inherits autoplay permission
        ↓
Video plays with audio ✓
```

See `HIGHERMIND-site/docs/101-IFRAME-EMBED-INTEGRATION.md` for implementation.

For adding to other domains, see **Doc 222**.

---

## 5. Adding New Videos

### Upload to R2

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# Upload video
wrangler r2 object put sww-videos/[filename] --file=videos-to-upload/[filename] --remote

# Upload manifest
wrangler r2 object put sww-videos/video-manifest.json --file=public/r2-video-manifest.json --remote

# Verify
curl -sI "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/[filename]"
```

### Manifest Entry for Intro Video

```json
{
  "key": "the-eternal.mov",
  "url": "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/the-eternal.mov",
  "contentType": "video/quicktime",
  "isIntro": true,
  "entityId": "the-eternal"
}
```

---

## 6. Implementation Status

| Component | Status |
|-----------|--------|
| R2 bucket + CDN | ✅ |
| Background video playback | ✅ |
| Entity intro in R2 (`the-eternal.mov`) | ✅ |
| Manifest with intro metadata | ✅ |
| URL param `intro-video=true` | ✅ |
| VideoPlayer intro detection | ✅ |
| Intro → random transition | ✅ |
| Iframe embed (highermind.ai) | ✅ |
| Autoplay with audio | ✅ |
| Buffering breathing animation | ✅ |
| Natural play on buffer + peak opacity | ✅ |
| Immediate playback (no artificial delays) | ✅ |

---

## 7. Key Files

| File | Purpose |
|------|---------|
| `videos-to-upload/` | Stage videos before upload |
| `components/VideoPlayer.tsx` | Video player with intro logic |
| `public/r2-video-manifest.json` | Local manifest copy |
| `types/index.ts` | VideoItem interface |

---

## 8. R2 Cost

| Metric | Cost |
|--------|------|
| Storage | $0.015/GB-month |
| GET requests | $0.36 per 1M |
| Egress | **$0** (free) |
