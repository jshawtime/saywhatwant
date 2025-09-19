# SWW Videos Local Folder

This folder (`public/sww-videos/`) is for local video storage during development.

## Setup

1. Add your video files here (.mp4, .webm, .mov, .avi)
2. Run `npm run manifest:local` to generate the video manifest
3. Make sure `useLocal: true` in `config/video-source.ts`

## Folder Structure
```
public/sww-videos/
  ├── README.md (this file)
  ├── video-manifest.json (auto-generated)
  ├── video1.mp4
  ├── video2.webm
  └── ...
```

## Important Notes

- This folder name (`sww-videos`) matches the future R2 bucket name
- Videos in this folder are served directly by Next.js during development
- The manifest file is auto-generated - don't edit it manually
- To switch to R2 storage, simply set `useLocal: false` in the config

## Git Exclusion

Video files are **excluded from version control** via `.gitignore` to:
- Keep repository size manageable  
- Avoid Git LFS requirements
- Prevent slow clones/pulls

Only tracked files:
- `video-manifest.json` - The video index
- `README.md` - This documentation

To share videos with team members, use cloud storage or direct file transfer, not Git.

## Switching to R2

When ready for production:
1. Set `useLocal: false` in `config/video-source.ts`
2. Configure your R2 bucket URL in `.env`
3. Upload videos to R2 bucket named `sww-videos`
4. Generate R2 manifest with `npm run manifest:generate`
