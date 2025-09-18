/**
 * R2 Manifest Generator for Say What Want Videos
 * Generates a manifest of videos in the sww-videos R2 bucket
 * 
 * Usage: node r2-manifest-generator.js
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'sww-videos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Your R2 public bucket URL

// Validate environment variables
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
  console.error('[Manifest] Missing required environment variables');
  console.error('Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL');
  process.exit(1);
}

// Configure S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * List all videos in the R2 bucket
 */
async function listVideos() {
  const videos = [];
  let continuationToken = null;
  
  try {
    do {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });
      
      const response = await s3Client.send(command);
      
      if (response.Contents) {
        for (const object of response.Contents) {
          // Filter for video files only
          if (isVideoFile(object.Key)) {
            videos.push({
              key: object.Key,
              url: `${R2_PUBLIC_URL}/${object.Key}`,
              size: object.Size,
              lastModified: object.LastModified.toISOString(),
              contentType: getContentType(object.Key),
            });
          }
        }
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    console.log(`[Manifest] Found ${videos.length} videos in R2 bucket`);
    return videos;
    
  } catch (error) {
    console.error('[Manifest] Error listing videos:', error);
    throw error;
  }
}

/**
 * Check if a file is a video based on extension
 */
function isVideoFile(filename) {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
  const ext = path.extname(filename).toLowerCase();
  return videoExtensions.includes(ext);
}

/**
 * Get content type based on file extension
 */
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.m4v': 'video/x-m4v',
  };
  return contentTypes[ext] || 'video/mp4';
}

/**
 * Generate and save the manifest
 */
async function generateManifest() {
  try {
    console.log('[Manifest] Starting manifest generation...');
    
    // List all videos
    const videos = await listVideos();
    
    // Create manifest object
    const manifest = {
      videos: videos,
      lastUpdated: new Date().toISOString(),
      total: videos.length,
    };
    
    // Save to file
    const outputPath = path.join(process.cwd(), 'public', 'cloudflare', 'video-manifest.json');
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Write manifest
    await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));
    
    console.log(`[Manifest] Successfully generated manifest with ${videos.length} videos`);
    console.log(`[Manifest] Saved to: ${outputPath}`);
    
    // Also save a backup with timestamp
    const backupPath = path.join(
      process.cwd(), 
      'public', 
      'cloudflare', 
      `video-manifest-${Date.now()}.json`
    );
    await fs.writeFile(backupPath, JSON.stringify(manifest, null, 2));
    
    return manifest;
    
  } catch (error) {
    console.error('[Manifest] Error generating manifest:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateManifest()
    .then(() => {
      console.log('[Manifest] ✓ Manifest generation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Manifest] ✗ Failed:', error.message);
      process.exit(1);
    });
}

export { generateManifest, listVideos };
