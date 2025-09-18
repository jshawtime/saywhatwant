/**
 * Local Video Manifest Generator
 * Generates a manifest.json file for videos in the local public/sww-videos folder
 */

const fs = require('fs');
const path = require('path');

// Configuration
const VIDEOS_DIR = path.join(process.cwd(), 'public', 'sww-videos');
const MANIFEST_FILE = path.join(VIDEOS_DIR, 'video-manifest.json');
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi'];

// Ensure videos directory exists
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  console.log(`✅ Created videos directory: ${VIDEOS_DIR}`);
}

// Get all video files
const videoFiles = fs.readdirSync(VIDEOS_DIR)
  .filter(file => {
    const ext = path.extname(file).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  });

// Create manifest
const manifest = {
  version: '1.0.0',
  generated: new Date().toISOString(),
  source: 'local',
  totalVideos: videoFiles.length,
  videos: videoFiles.map(file => {
    const filePath = path.join(VIDEOS_DIR, file);
    const stats = fs.statSync(filePath);
    
    return {
      key: file,
      url: `/sww-videos/${file}`, // URL path for Next.js public folder
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      contentType: getContentType(file)
    };
  })
};

// Helper function to get content type
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo'
  };
  return contentTypes[ext] || 'video/mp4';
}

// Write manifest file
fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

// Output summary
console.log('📹 Local Video Manifest Generated');
console.log('=================================');
console.log(`📂 Videos directory: ${VIDEOS_DIR}`);
console.log(`📄 Manifest file: ${MANIFEST_FILE}`);
console.log(`🎬 Total videos found: ${videoFiles.length}`);

if (videoFiles.length === 0) {
  console.log('\n⚠️  No videos found in the directory!');
  console.log('📌 Add video files (.mp4, .webm, .mov, .avi) to:');
  console.log(`   ${VIDEOS_DIR}`);
  console.log('\n📝 Example structure:');
  console.log('   public/sww-videos/');
  console.log('     ├── video1.mp4');
  console.log('     ├── video2.webm');
  console.log('     └── video3.mp4');
} else {
  console.log('\n📋 Videos in manifest:');
  videoFiles.forEach((file, index) => {
    const filePath = path.join(VIDEOS_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`   ${index + 1}. ${file} (${sizeMB} MB)`);
  });
}

console.log('\n✨ To use local videos:');
console.log('1. Ensure VIDEO_SOURCE_CONFIG.useLocal = true in config/video-source.ts');
console.log('2. Run: npm run dev');
console.log('3. Videos will be served from public/sww-videos/');
