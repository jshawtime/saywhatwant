# Doc 221: Video System & Entity Intro Videos

> **Created**: December 12, 2025  
> **Status**: Active  
> **Purpose**: Video management, R2 uploads, and entity intro videos

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

| Type | Naming | Behavior |
|------|--------|----------|
| **Background** | `sww-XXXXX.mp4` | Random shuffle playback |
| **Entity Intro** | `[entity-id].mov` | Plays once via URL param |

---

## 3. Entity Intro Videos

### URL Parameter Control

Intro videos are triggered **manually via URL parameter**:

```
?entity=the-eternal&intro-video=true
```

| URL | Behavior |
|-----|----------|
| `?entity=the-eternal` | Background videos only |
| `?entity=the-eternal&intro-video=true` | Play intro → then backgrounds |

### How It Works

1. External site (you control) builds the URL with `intro-video=true`
2. VideoPlayer reads URL param on load
3. If `intro-video=true` AND entity has intro video in manifest → plays intro once
4. After intro ends → continues with random background videos

### Manifest Entry Format

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

## 4. Adding New Videos

### Step 1: Place in Upload Folder

```
saywhatwant/videos-to-upload/
├── sww-newvid.mp4        # Background video
└── the-eternal.mov       # Entity intro video
```

### Step 2: Upload to R2

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# Single file upload
wrangler r2 object put sww-videos/the-eternal.mov --file=videos-to-upload/the-eternal.mov --remote
```

### Step 3: Update Manifest

Add entry to `public/r2-video-manifest.json`, then upload:

```bash
wrangler r2 object put sww-videos/video-manifest.json --file=public/r2-video-manifest.json --remote
```

### Step 4: Verify

```bash
curl -sI "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/the-eternal.mov" | head -3
```

---

## 5. Implementation Status

| Component | Status |
|-----------|--------|
| R2 bucket + CDN | ✅ Working |
| Background video playback | ✅ Working |
| Entity intro in R2 (`the-eternal.mov`) | ✅ Uploaded |
| Manifest with intro metadata | ✅ Updated |
| VideoItem type updated | ✅ Added `isIntro`, `entityId` fields |
| URL param `intro-video=true` reading | ✅ Implemented |
| VideoPlayer plays intro on load | ✅ Implemented |
| Intro → random transition | ✅ Implemented |
| Exclude intros from random shuffle | ✅ Implemented |
| **TESTING** | ✅ Verified working (Dec 12, 2025) |

---

## 6. Quick Reference

### Upload Commands

```bash
# Upload video
wrangler r2 object put sww-videos/[filename] --file=videos-to-upload/[filename] --remote

# Upload manifest
wrangler r2 object put sww-videos/video-manifest.json --file=public/r2-video-manifest.json --remote

# Verify video accessible
curl -sI "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/[filename]"
```

### Key Files

| File | Purpose |
|------|---------|
| `videos-to-upload/` | Stage videos before R2 upload |
| `components/VideoPlayer.tsx` | Video player component |
| `public/r2-video-manifest.json` | Local manifest copy |
| `config/video-source.ts` | R2/local toggle |

### Cost

| Metric | Cost |
|--------|------|
| Storage | $0.015/GB-month |
| GET requests | $0.36 per 1M |
| Egress | **$0** (free) |
