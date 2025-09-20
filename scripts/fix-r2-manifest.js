const fs = require('fs');
const path = require('path');

// R2 public URL
const R2_URL = 'https://pub-56b43531787b4783b546dd45f31651a7.r2.dev';

// Get all video files from the source directory
const videosDir = '/Users/terminal_1/_SWW/sww-videos';
const files = fs.readdirSync(videosDir)
  .filter(f => f.endsWith('.mp4'))
  .sort();

// Create the manifest with FULL R2 URLs
const manifest = {
  version: '2.0.0',
  generated: new Date().toISOString(),
  source: 'r2',
  publicUrl: R2_URL,
  totalVideos: files.length,
  videos: files.map(filename => {
    const stats = fs.statSync(path.join(videosDir, filename));
    return {
      key: filename,
      url: `${R2_URL}/${filename}`, // FULL R2 URL
      size: stats.size,
      lastModified: new Date().toISOString(),
      contentType: 'video/mp4'
    };
  })
};

// Save the manifest
const outputPath = path.join(process.cwd(), 'public', 'r2-video-manifest.json');
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log(`✅ Fixed R2 Manifest with ${files.length} videos`);
console.log(`📄 Saved to: ${outputPath}`);
console.log(`\n🎬 First 3 video URLs:`);
manifest.videos.slice(0, 3).forEach(v => {
  console.log(`   ${v.url}`);
});
