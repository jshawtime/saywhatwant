const fs = require('fs');
const path = require('path');

// Create a simple manifest with R2 URLs
const R2_PUBLIC_URL = 'https://pub-56b43531787b4783b546dd45f31651a7.r2.dev';

// Get video list from local folder (they're the same files we uploaded)
const videosDir = '/Users/terminal_1/_SWW/sww-videos';
const videoFiles = fs.readdirSync(videosDir).filter(f => f.endsWith('.mp4'));

const manifest = {
  version: '2.0.0',
  generated: new Date().toISOString(),
  source: 'r2',
  publicUrl: R2_PUBLIC_URL,
  totalVideos: videoFiles.length,
  videos: videoFiles.map(filename => ({
    key: filename,
    url: `${R2_PUBLIC_URL}/${filename}`,
    // We'll use dummy sizes since the files are already uploaded
    size: 5000000, // Approximate
    lastModified: new Date().toISOString(),
    contentType: 'video/mp4'
  }))
};

// Create public/cloudflare directory if it doesn't exist
const outputDir = path.join(process.cwd(), 'public', 'cloudflare');
fs.mkdirSync(outputDir, { recursive: true });

// Save manifest
const outputPath = path.join(outputDir, 'video-manifest.json');
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log('✅ R2 Manifest Generated!');
console.log(`📄 Saved to: ${outputPath}`);
console.log(`🎬 Total videos: ${videoFiles.length}`);
console.log(`🌐 Public URL: ${R2_PUBLIC_URL}`);
console.log('\n📋 First 5 videos in manifest:');
manifest.videos.slice(0, 5).forEach(v => {
  console.log(`   - ${v.url}`);
});
