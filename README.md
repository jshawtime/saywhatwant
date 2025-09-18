# Say What Want

A modern web application with video playback and real-time anonymous comments.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev:clean  # Kills any existing servers and starts fresh

# Or standard dev
npm run dev
```

Visit: http://localhost:3000

## 📁 Project Structure

```
say-what-want/
├── app/                    # Next.js app directory
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── CommentsStream.tsx # Comments system (localStorage)
│   └── VideoPlayer.tsx    # Video player
├── config/                # Configuration files
│   └── video-source.ts    # Video source toggle (local/R2)
├── public/                
│   └── sww-videos/        # Local video storage
├── scripts/               # Utility scripts
└── workers/               # Cloudflare Workers (production)
```

## 🎬 Video System

### Development (Local Videos)

1. Add video files to `public/sww-videos/`
2. Generate manifest: `npm run manifest:local`
3. Videos are served from local folder

### Production (R2 Bucket)

To switch to R2 for production:

1. **Toggle Configuration** in `config/video-source.ts`:
```typescript
export const VIDEO_SOURCE_CONFIG = {
  useLocal: false,  // ← Change from true to false
  // ...
};
```

2. **Set R2 Environment Variable**:
```bash
# .env.production or .env.local
NEXT_PUBLIC_R2_BUCKET_URL=https://your-bucket.r2.dev
```

3. **Upload Videos to R2**:
   - Create R2 bucket named `sww-videos` (same as local folder)
   - Upload all video files to the bucket
   - Generate manifest: `npm run manifest:generate`

That's it! The app will now use R2 for videos.

## 💬 Comments System

### Development (Browser localStorage)

Comments are stored directly in the browser during development:
- **Storage**: Browser's localStorage (no server needed)
- **Persistence**: Comments persist across page refreshes
- **Username Required**: Must enter username before posting
- **Storage Key**: `sww-comments-local`
- **Limit**: Maximum 1000 comments stored locally
- **Cross-Tab**: Updates sync between tabs automatically

### Production (Cloudflare Workers)

To switch to Cloudflare Workers for production:

1. **Update Environment Variable**:
```bash
# .env.production
NEXT_PUBLIC_COMMENTS_API=https://your-worker.workers.dev/api/comments
```

2. **Deploy Cloudflare Worker**:
```bash
cd workers
wrangler deploy comments-worker.js
```

3. **Configure KV Storage**:
```bash
# Create KV namespace
wrangler kv:namespace create "COMMENTS_KV"

# Update wrangler.toml with namespace ID
```

That's it! Comments will now use Cloudflare Workers + KV storage.

## 🛠️ Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run dev:clean` - Kill existing servers and start fresh
- `npm run build` - Build for production
- `npm run start` - Start production server

### Video Management
- `npm run manifest:local` - Generate manifest for local videos
- `npm run manifest:generate` - Generate manifest for R2 bucket

### Comments Management (Browser Console)
Since comments are stored in localStorage, use browser console:
```javascript
// Clear all comments
localStorage.removeItem('sww-comments-local')

// View all comments
JSON.parse(localStorage.getItem('sww-comments-local'))

// Export comments
copy(localStorage.getItem('sww-comments-local'))

// Import comments (paste JSON string)
localStorage.setItem('sww-comments-local', 'YOUR_JSON_HERE')
```

### Deployment
- `npm run deploy` - Deploy to Cloudflare Pages
- `npm run worker:deploy` - Deploy Cloudflare Worker

## 🔄 Development to Production Checklist

### Before Deploying:

- [ ] **Videos**: Switch `useLocal` to `false` in `config/video-source.ts`
- [ ] **Videos**: Set `NEXT_PUBLIC_R2_BUCKET_URL` environment variable
- [ ] **Videos**: Upload videos to R2 bucket named `sww-videos`
- [ ] **Comments**: Set `NEXT_PUBLIC_COMMENTS_API` to your Worker URL
- [ ] **Comments**: Deploy Cloudflare Worker with `npm run worker:deploy`
- [ ] **Comments**: Configure KV namespace for comments storage
- [ ] **Build**: Run `npm run build` to verify production build
- [ ] **Deploy**: Run `npm run deploy` to deploy to Cloudflare Pages

## 🌐 Environment Variables

### Development (.env.local)
```env
# No environment variables needed for development
# Comments use localStorage
# Videos use local folder based on config toggle
```

### Production (.env.production)
```env
# Comments - Cloudflare Worker
NEXT_PUBLIC_COMMENTS_API=https://your-worker.workers.dev/api/comments

# Videos - R2 Bucket
NEXT_PUBLIC_R2_BUCKET_URL=https://your-bucket.r2.dev
```

## 📝 Notes

- **Videos**: Local folder `public/sww-videos/` has the same name as the R2 bucket for consistency
- **Comments**: Development uses browser localStorage (persists in browser)
- **Toggle**: Single boolean switch for local vs production in `config/video-source.ts`
- **Username Required**: Comments require a username (12 chars max) before posting
- **Storage**: Comments are stored in browser's localStorage during development

## 🚦 Testing

1. **Test Local Videos**: Add videos to `public/sww-videos/` and run `npm run manifest:local`
2. **Test Comments**: Post comments in the app - they're saved in browser's localStorage
3. **Test Production**: Set environment variables and test with production config

### To Test Comments in Browser Console:
```javascript
// View stored comments
JSON.parse(localStorage.getItem('sww-comments-local'))

// Clear all comments
localStorage.removeItem('sww-comments-local')

// Add test comment programmatically
const comments = JSON.parse(localStorage.getItem('sww-comments-local') || '[]');
comments.push({
  id: Date.now() + '-test',
  text: 'Test comment',
  timestamp: Date.now(),
  username: 'Tester'
});
localStorage.setItem('sww-comments-local', JSON.stringify(comments));
```

## 🆘 Troubleshooting

### Videos not playing?
- Check if videos are in `public/sww-videos/`
- Run `npm run manifest:local` to regenerate manifest
- Verify `useLocal: true` in development

### Comments not saving?
- Make sure you've entered a username (field flashes cyan if empty)
- Check browser console for errors
- Try clearing localStorage: `localStorage.removeItem('sww-comments-local')`
- Verify localStorage is enabled in your browser

### Production issues?
- Verify environment variables are set
- Check Cloudflare Worker is deployed
- Ensure R2 bucket permissions are correct

## 📚 Documentation

For detailed implementation guides, see:
- [Comments System Guide](../soundtrip-comments-system.md)
- [SoundTrip Best Practices](../SoundTrip-Best-Practices.md)

## 📄 License

Private project - All rights reserved