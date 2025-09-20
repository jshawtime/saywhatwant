/**
 * Video Source Configuration
 * Toggle between local and R2 bucket sources
 */

export const VIDEO_SOURCE_CONFIG = {
  // ============================================
  // TOGGLE THIS TO SWITCH BETWEEN LOCAL AND R2
  // ============================================
  useLocal: false,  // Using R2 bucket now!
  
  // Local configuration
  local: {
    videosPath: '/sww-videos',  // Path in public folder
    manifestPath: '/sww-videos/video-manifest.json'
  },
  
  // R2 configuration (will be used when useLocal = false)
  r2: {
    bucketUrl: 'https://pub-56b43531787b4783b546dd45f31651a7.r2.dev',
    manifestPath: '/video-manifest.json'
  },
  
  // Bucket/folder name (same for both local and R2)
  bucketName: 'sww-videos'
};

/**
 * Get the current video source configuration
 */
export function getVideoSource() {
  if (VIDEO_SOURCE_CONFIG.useLocal) {
    return {
      type: 'local' as const,
      baseUrl: '',
      manifestUrl: VIDEO_SOURCE_CONFIG.local.manifestPath,
      videosPath: VIDEO_SOURCE_CONFIG.local.videosPath
    };
  } else {
    return {
      type: 'r2' as const,
      baseUrl: VIDEO_SOURCE_CONFIG.r2.bucketUrl,
      manifestUrl: `${VIDEO_SOURCE_CONFIG.r2.bucketUrl}${VIDEO_SOURCE_CONFIG.r2.manifestPath}`,
      videosPath: ''
    };
  }
}
