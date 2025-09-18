'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { VideoItem, VideoManifest } from '@/types';
import { getVideoSource } from '@/config/video-source';

const VideoPlayer: React.FC = () => {
  const [isMuted, setIsMuted] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

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

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      
      // Save preference
      localStorage.setItem('sww-video-muted', JSON.stringify(!isMuted));
    }
  };

  const handleRefresh = () => {
    loadRandomVideo();
  };

  // Load mute preference
  useEffect(() => {
    const savedMuteState = localStorage.getItem('sww-video-muted');
    if (savedMuteState !== null) {
      const muted = JSON.parse(savedMuteState);
      setIsMuted(muted);
      if (videoRef.current) {
        videoRef.current.muted = muted;
      }
    }
  }, []);

  // Handle mouse movement for controls
  const handleMouseMove = () => {
    setShowControls(true);
    
    // Clear existing timeout
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    // Hide controls after 3 seconds of inactivity
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="relative w-full h-full bg-black overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video Element */}
      {currentVideo && !error && (
        <video
          ref={videoRef}
          key={currentVideo.key}
          className="w-full h-full object-cover"
          src={currentVideo.url}
          autoPlay
          loop
          muted={isMuted}
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
              onClick={handleRefresh}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Video Controls */}
      <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="flex items-center justify-between">
          {/* Mute/Unmute Button */}
          <button
            onClick={toggleMute}
            className="p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all hover-scale"
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </button>

          {/* Video Info */}
          {currentVideo && (
            <div className="text-center flex-1 mx-4">
              <p className="text-xs text-white/60 truncate">
                {currentVideo.key}
              </p>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all hover-scale"
            aria-label="Load new video"
          >
            <RefreshCw className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Gradient Overlay for visual enhancement */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/30 pointer-events-none" />
    </div>
  );
};

export default VideoPlayer;
