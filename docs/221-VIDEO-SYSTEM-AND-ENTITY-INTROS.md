# Doc 221: Video System & Entity Intro Videos

> **Created**: December 12, 2025  
> **Status**: Active  
> **Purpose**: Complete guide for video management, R2 uploads, and entity intro videos

---

## Table of Contents

1. [What We Have](#1-what-we-have)
2. [What We Want](#2-what-we-want)
3. [How to Add New Videos](#3-how-to-add-new-videos)
4. [Entity Intro Videos](#4-entity-intro-videos)
5. [Automated Sync Script](#5-automated-sync-script)
6. [Implementation Plan](#6-implementation-plan)
7. [File Reference](#7-file-reference)

---

## 1. What We Have

### Current Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  VideoPlayer    │────▶│  R2 Manifest     │────▶│  Cloudflare R2  │
│  Component      │     │  (JSON)          │     │  Bucket         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Video Storage

| Component | Location |
|-----------|----------|
| **R2 Bucket** | `sww-videos` |
| **Public URL** | `https://pub-56b43531787b4783b546dd45f31651a7.r2.dev` |
| **Manifest** | `https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/video-manifest.json` |

### Current Video Count
- **238 videos** in R2 bucket (ambient/background videos)
- Named: `sww-XXXXX.mp4` (5 character random suffix)

### Key Files

| File | Purpose |
|------|---------|
| `components/VideoPlayer.tsx` | Main video player component (drawer) |
| `config/video-source.ts` | Toggle between local/R2 sources |
| `public/r2-video-manifest.json` | Local copy of manifest |
| `scripts/r2-upload-now.sh` | Bulk upload using rclone |
| `scripts/generate-r2-manifest-now.js` | Generate manifest from local folder |

### Configuration (`config/video-source.ts`)

```typescript
export const VIDEO_SOURCE_CONFIG = {
  useLocal: false,  // Currently using R2
  r2: {
    bucketUrl: 'https://pub-56b43531787b4783b546dd45f31651a7.r2.dev',
    manifestPath: '/video-manifest.json'
  }
};
```

---

## 2. What We Want

### New Features

1. **Local Upload Folder**: A folder in the project where new videos can be placed
2. **Automated Sync**: Script that uploads only NEW videos to R2 and regenerates manifest
3. **Entity Intro Videos**: Special videos that play when a user starts a conversation with an entity

### Entity Intro Video System

Each AI entity can have an intro video that plays when:
- User opens the video drawer for the first time with that entity
- User starts a new conversation with that entity

**Naming Convention**: `[entity-id].mov` or `[entity-id].mp4`

Examples:
- `the-eternal.mov` → Plays for The Eternal entity
- `god-mode.mov` → Plays for God Mode entity
- `art-of-war.mov` → Plays for Art of War entity

---

## 3. How to Add New Videos

### Step 1: Place Videos in Upload Folder

```
saywhatwant/videos-to-upload/
├── sww-newvid1.mp4      # Background videos (random play)
├── sww-newvid2.mp4
├── the-eternal.mov       # Entity intro video
├── god-mode.mov          # Entity intro video
└── ...
```

### Step 2: Run Sync Script

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
./scripts/sync-videos-to-r2.sh
```

This will:
1. ✅ Check for new videos not in R2
2. ✅ Upload only new videos (skip existing)
3. ✅ Regenerate the manifest
4. ✅ Upload updated manifest to R2

### Step 3: Verify

Videos will be available at:
```
https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/[filename]
```

---

## 4. Entity Intro Videos

### Configuration in Entity JSON

Each entity JSON file in `hm-server-deployment/AI-Bot-Deploy/ai-entities/` can specify an intro video:

```json
{
  "id": "the-eternal",
  "username": "TheEternal",
  "introVideo": "the-eternal.mov",
  ...
}
```

### Entity ID to Filename Mapping

| Entity ID | Intro Video Filename |
|-----------|---------------------|
| `the-eternal` | `the-eternal.mov` |
| `god-mode` | `god-mode.mov` |
| `art-of-war` | `art-of-war.mov` |
| `philosophy-philosophy-philosophy` | `philosophy-philosophy-philosophy.mov` |
| `tsc-alice-in-wonderland` | `tsc-alice-in-wonderland.mov` |

### Full Entity List (52 entities)

```
1984
alcohol-addiction-support
art-of-war
astrophysics-a-deep-dive
astrophysics-for-people-in-a-hurry
being-and-nothingness
climate-change-solutions
climb-the-corporate-ladder-fast
conflict-helper
crucial-conversations
crushing-it
dystopian-survival-guide
emotional-intelligence
emotional-support-therapist
eq-score
fahrenheit-451
fear-and-loathing
global
god-is-a-machine
god-mode
how-to-get-what-you-want
how-to-talk-so-kids-will-listen
mind-control-for-health-living
modern-parenting
monetize-your-passion
philosophy-philosophy-philosophy
sleep-coach
stress-free-living
the-body-keeps-the-score
the-complete-works-of-aristotle
the-eternal
the-four-agreements
the-money-mentor
the-new-american-dream
the-road-not-taken
the-teachings-of-don-juan
the-truth-teller
the-uninhabitable-earth
this-or-that
toxic-heal-your-body-from-mold-toxicity
true-freedom-is-for-anyone
tsc-alice-in-wonderland
tsc-frankenstein
tsc-grimms-fairy-tales
tsc-pride-and-prejudice
tsc-shakespeare-the-complete-collection
tsc-the-odyssey-by-homer
tsc-ulysses-by-james-joyce
what-color-is-your-parachute
why-we-sleep-unlocking-the-power-of-sleep
why-zebras-dont-get-ulcers
your-money-or-your-life
```

---

## 5. Automated Sync Script

### Script Location

```
saywhatwant/scripts/sync-videos-to-r2.sh
```

### What It Does

1. **Scans** `videos-to-upload/` folder for new videos
2. **Compares** against existing R2 bucket contents
3. **Uploads** only new files (incremental sync)
4. **Regenerates** manifest with all videos
5. **Uploads** updated manifest to R2

### Usage

```bash
# From saywhatwant directory
./scripts/sync-videos-to-r2.sh

# Or with full path
/Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/scripts/sync-videos-to-r2.sh
```

### Options

```bash
# Dry run (show what would be uploaded)
./scripts/sync-videos-to-r2.sh --dry-run

# Force re-upload all videos
./scripts/sync-videos-to-r2.sh --force

# Only sync entity intro videos
./scripts/sync-videos-to-r2.sh --intros-only
```

---

## 6. Implementation Plan

### Phase 1: VideoPlayer Integration ✅ (Existing)

The VideoPlayer already:
- Fetches manifest from R2
- Plays random background videos
- Supports loop mode and shuffle

### Phase 2: Entity Intro Video Trigger (TODO)

Need to implement in `VideoPlayer.tsx`:

```typescript
// Listen for entity change event
useEffect(() => {
  const handleEntityChange = (event: CustomEvent) => {
    const { entityId } = event.detail;
    const introVideo = availableVideos.find(v => 
      v.key === `${entityId}.mov` || v.key === `${entityId}.mp4`
    );
    if (introVideo) {
      setCurrentVideo(introVideo);
      setIsLoopMode(false); // Play once then return to random
    }
  };
  
  window.addEventListener('entityChanged', handleEntityChange);
  return () => window.removeEventListener('entityChanged', handleEntityChange);
}, [availableVideos]);
```

### Phase 3: Emit Entity Change Event (TODO)

In `CommentsStream.tsx` or wherever entity is selected:

```typescript
// When entity changes
const handleEntityChange = (newEntityId: string) => {
  window.dispatchEvent(new CustomEvent('entityChanged', {
    detail: { entityId: newEntityId }
  }));
};
```

---

## 7. File Reference

### Project Structure

```
saywhatwant/
├── videos-to-upload/           # ← PUT NEW VIDEOS HERE
│   ├── sww-*.mp4               # Background videos
│   └── [entity-id].mov         # Entity intro videos
├── scripts/
│   ├── sync-videos-to-r2.sh    # Automated sync script
│   ├── r2-upload-now.sh        # Original bulk upload
│   └── generate-r2-manifest-now.js
├── config/
│   └── video-source.ts         # R2/local toggle
├── components/
│   └── VideoPlayer.tsx         # Video player component
└── public/
    └── r2-video-manifest.json  # Local manifest copy
```

### R2 Credentials

Located in: `scripts/r2-upload-now.sh` and `.env.r2`

```
R2_ACCOUNT_ID=85eadfbdf07c02e77aa5dc3b46beb0f9
R2_BUCKET_NAME=sww-videos
R2_PUBLIC_URL=https://pub-56b43531787b4783b546dd45f31651a7.r2.dev
```

### Video Format Recommendations

| Attribute | Recommendation |
|-----------|----------------|
| **Container** | MP4 (preferred) or MOV |
| **Codec** | H.264 |
| **Resolution** | 720p (9:16 portrait for mobile) |
| **Bitrate** | 600-800 kbps |
| **Duration** | 8-15 seconds (background), any (intros) |
| **Audio** | None or silent AAC track |

### FFmpeg Encoding Example

```bash
ffmpeg -i input.mov -c:v libx264 -preset fast -profile:v main -pix_fmt yuv420p \
  -b:v 700k -maxrate 800k -bufsize 1400k -an \
  -movflags +faststart output.mp4
```

---

## Cost Reference

R2 is extremely cost-effective:

| Metric | Cost |
|--------|------|
| **Storage** | $0.015/GB-month |
| **GET requests** | $0.36 per 1M |
| **Egress** | $0 (free!) |

**Example**: 250 videos × 5MB = 1.25GB storage = **$0.02/month**

---

## Quick Reference Commands

```bash
# Sync new videos to R2
./scripts/sync-videos-to-r2.sh

# Check what's in R2
rclone ls r2:sww-videos | head -20

# Upload a single video manually
wrangler r2 object put sww-videos/my-video.mp4 --file=videos-to-upload/my-video.mp4

# View manifest
curl -s https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/video-manifest.json | jq '.totalVideos'
```

