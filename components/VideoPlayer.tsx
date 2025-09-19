'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VideoItem, VideoManifest } from '@/types';
import { getVideoSource } from '@/config/video-source';

const VideoPlayer: React.FC = () => {
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch manifest and select random video
  useEffect(() => {
    loadRandomVideo();
  }, []);

  const loadRandomVideo = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const videoSource = getVideoSource();
      console.log(`[VideoPlayer] Using ${videoSource.type} video source`);

      // Fetch video manifest
      const manifestUrl = videoSource.manifestUrl;
      const response = await fetch(manifestUrl);
      
      if (!response.ok) {
        throw new Error('Failed to load video manifest');
      }

      const manifest: VideoManifest = await response.json();
      
      if (!manifest.videos || manifest.videos.length === 0) {
        throw new Error('No videos available');
      }

      // Select random video
      const randomIndex = Math.floor(Math.random() * manifest.videos.length);
      const selectedVideo = manifest.videos[randomIndex];
      
      // Update URL based on source type
      if (videoSource.type === 'local') {
        // For local videos, prepend the videos path
        selectedVideo.url = `${videoSource.videosPath}/${selectedVideo.key}`;
      }
      // For R2, the URL should already be complete in the manifest
      
      console.log(`[VideoPlayer] Selected video from ${videoSource.type}:`, selectedVideo.key);
      setCurrentVideo(selectedVideo);
      
    } catch (err) {
      console.error('[VideoPlayer] Error loading video:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
      // Try to load a fallback video if available
      loadFallbackVideo();
    } finally {
      setIsLoading(false);
    }
  };

  const loadFallbackVideo = () => {
    // Fallback to a demo video if R2 is not configured
    const fallbackVideo: VideoItem = {
      key: 'demo-video.mp4',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      size: 0,
      lastModified: new Date().toISOString(),
      contentType: 'video/mp4'
    };
    setCurrentVideo(fallbackVideo);
    setError('Using demo video - Configure R2 bucket for full experience');
  };


  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Video Element */}
      {currentVideo && !error && (
        <video
          ref={videoRef}
          key={currentVideo.key}
          className="w-full h-full object-cover"
          src={currentVideo.url}
          autoPlay
          loop
          muted={true}
          playsInline
          onError={(e) => {
            console.error('[VideoPlayer] Video playback error:', e);
            setError('Failed to play video');
          }}
        />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-white text-center">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm opacity-60">Loading video...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <div className="text-white text-center p-6">
            <p className="text-sm text-red-400 mb-4">{error}</p>
            <button
              onClick={loadRandomVideo}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
