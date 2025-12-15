# Video Sync to R2 - Complete Guide & Troubleshooting

## Overview

Entity intro videos are stored in Cloudflare R2 and tracked via a JSON manifest. This document covers the sync process and common issues.

---

## Quick Reference

### Folder Structure
```
saywhatwant/
├── videos-to-upload/           # Put new videos here
│   ├── the-eternal.mov         # Entity intro (filename = entity ID)
│   ├── conflict-helper.mov     # Entity intro
│   └── sww-XXXXX.mp4           # Background video (sww- prefix)
├── public/
│   ├── r2-video-manifest.json  # Local copy of manifest
│   └── cloudflare/
│       └── video-manifest.json # Duplicate for compatibility
└── scripts/
    ├── sync-videos-to-r2.py    # Python sync (RECOMMENDED)
    └── sync-videos-to-r2.sh    # Bash sync (legacy)
```

### Video Naming Convention

| Type | Filename Pattern | Example | Manifest Fields |
|------|------------------|---------|-----------------|
| Entity Intro | `[entity-id].mov` or `.mp4` | `the-eternal.mov` | `isIntro: true, entityId: "the-eternal"` |
| Background | `sww-*.mp4` | `sww-037kc.mp4` | (none) |

---

## Sync Process

### Using Python Script (Recommended)

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# Dry run - see what would happen
python3 scripts/sync-videos-to-r2.py --dry-run

# Actual sync
python3 scripts/sync-videos-to-r2.py

# Force re-upload all
python3 scripts/sync-videos-to-r2.py --force
```

### What the Script Does

1. **Scans** `videos-to-upload/` folder for .mov and .mp4 files
2. **Connects** to R2 via boto3 (S3-compatible API)
3. **Lists** existing files in R2 bucket
4. **Compares** by filename and size to find new/changed files
5. **Uploads** new files with progress bars
6. **Updates** manifest incrementally (preserves existing 900+ videos)
7. **Saves** manifest locally and uploads to R2

### After Syncing

```bash
# Commit and push the updated manifest
git add -A && git commit -m "Add new intro videos" && git push
```

---

## Common Issues & Solutions

### Issue 1: "SyntaxError: Expected ',' or '}' in JSON"

**Symptom:** VideoPlayer shows error loading manifest, falls back to demo video.

**Cause:** Browser cached a broken/old manifest from R2.

**Solution:** 
1. The VideoPlayer now has cache-busting built in (timestamp + `cache: 'no-store'`)
2. If still broken, re-upload manifest to R2:

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
python3 -c "
import boto3
s3 = boto3.Session(
    aws_access_key_id='655dc0505696e129391b3a2756dc902a',
    aws_secret_access_key='789522e4838381732bdc6f51d316f33d3cc97a0bbf8cb8118f8bdb55d4a88365'
).client('s3', endpoint_url='https://85eadfbdf07c02e77aa5dc3b46beb0f9.r2.cloudflarestorage.com', region_name='auto')

s3.upload_file(
    'public/r2-video-manifest.json',
    'sww-videos',
    'video-manifest.json',
    ExtraArgs={'ContentType': 'application/json', 'CacheControl': 'no-cache, max-age=0'}
)
print('✅ Manifest uploaded')
"
```

### Issue 2: Manifest Has 0 Videos / Empty Array

**Symptom:** `totalVideos: 0` or empty videos array.

**Cause:** The bash sync script tried to regenerate manifest from R2 listing (which failed).

**Solution:** 
1. Use the Python script instead (it updates incrementally)
2. Or restore from git: `git checkout HEAD -- public/r2-video-manifest.json`

### Issue 3: New Videos Not Playing

**Symptom:** Uploaded video but intro doesn't play for that entity.

**Checklist:**
1. ✅ Filename matches entity ID exactly (e.g., `the-eternal.mov` for `entity=the-eternal`)
2. ✅ Manifest has entry with `isIntro: true` and correct `entityId`
3. ✅ Manifest uploaded to R2: `https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/video-manifest.json`
4. ✅ Git pushed (for frontend to pick up local manifest)

**Verify manifest has your video:**
```bash
curl -s "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/video-manifest.json" | grep "your-entity-id"
```

### Issue 4: Wrangler CLI Errors

**Symptom:** `wrangler r2 object list` fails or returns wrong data.

**Cause:** Wrangler CLI has inconsistent R2 support.

**Solution:** Use Python script with boto3 instead - it uses the S3-compatible API directly.

---

## R2 Configuration

```python
R2_CONFIG = {
    'account_id': '85eadfbdf07c02e77aa5dc3b46beb0f9',
    'access_key_id': '655dc0505696e129391b3a2756dc902a',
    'secret_access_key': '789522e4838381732bdc6f51d316f33d3cc97a0bbf8cb8118f8bdb55d4a88365',
    'bucket_name': 'sww-videos',
    'public_url': 'https://pub-56b43531787b4783b546dd45f31651a7.r2.dev',
    'endpoint_url': 'https://85eadfbdf07c02e77aa5dc3b46beb0f9.r2.cloudflarestorage.com'
}
```

---

## Manifest Structure

```json
{
  "version": "2.1.0",
  "generated": "2025-12-15T05:35:52.746Z",
  "source": "r2",
  "publicUrl": "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev",
  "totalVideos": 931,
  "videos": [
    {
      "key": "the-eternal.mov",
      "url": "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/the-eternal.mov",
      "contentType": "video/quicktime",
      "isIntro": true,
      "entityId": "the-eternal"
    },
    {
      "key": "sww-037kc.mp4",
      "url": "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/sww-037kc.mp4",
      "contentType": "video/mp4"
    }
    // ... 900+ more videos
  ]
}
```

---

## VideoPlayer Cache-Busting

The frontend now fetches the manifest with cache-busting to prevent stale data:

```typescript
// In components/VideoPlayer.tsx
const manifestUrl = `${videoSource.manifestUrl}?_=${Date.now()}`;
const response = await fetch(manifestUrl, { cache: 'no-store' });
```

This ensures fresh data on every page load.

---

## Dependencies

```bash
# Required for Python sync script
pip3 install boto3 tqdm
```

---

## Troubleshooting Checklist

When videos aren't working:

1. [ ] Check R2 manifest is valid JSON:
   ```bash
   curl -s "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/video-manifest.json" | python3 -c "import json,sys; json.load(sys.stdin); print('✅ Valid')"
   ```

2. [ ] Check manifest has your entity:
   ```bash
   curl -s "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/video-manifest.json" | grep "your-entity-id"
   ```

3. [ ] Check video file exists in R2:
   ```bash
   curl -sI "https://pub-56b43531787b4783b546dd45f31651a7.r2.dev/your-entity-id.mov" | head -3
   # Should show HTTP/1.1 200 OK
   ```

4. [ ] Re-upload manifest if needed (see Issue 1 solution above)

5. [ ] Hard refresh browser (Cmd+Shift+R)

---

## History

- **Dec 2025**: Created Python sync script after bash script corrupted manifest
- **Dec 2025**: Added cache-busting to VideoPlayer to prevent stale manifest issues
- **Dec 2025**: Added 14 entity intro videos

