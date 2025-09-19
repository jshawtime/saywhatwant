'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VideoItem, VideoManifest } from '@/types';
import { getVideoSource } from '@/config/video-source';
import { Shuffle, Repeat, Palette, ArrowUp, ChevronDown } from 'lucide-react';

const VideoPlayer: React.FC = () => {
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [nextVideo, setNextVideo] = useState<VideoItem | null>(null);
  const [availableVideos, setAvailableVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoopMode, setIsLoopMode] = useState(false);
  const [userColor, setUserColor] = useState('#60A5FA');
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.7);
  const [blendMode, setBlendMode] = useState('overlay');
  const [showBlendMenu, setShowBlendMenu] = useState(false);
  const [videoBrightness, setVideoBrightness] = useState(1); // 1 = 100% brightness
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const blendMenuRef = useRef<HTMLDivElement>(null);

  // Available blend modes
  const blendModes = [
    'normal', 'multiply', 'screen', 'overlay', 
    'darken', 'lighten', 'color-dodge', 'color-burn',
    'hard-light', 'soft-light', 'difference', 'exclusion',
    'hue', 'saturation', 'color', 'luminosity'
  ];

  // Fetch manifest and initialize videos
  useEffect(() => {
    loadVideoManifest();
  }, []);

  // Load video manifest and initialize
  const loadVideoManifest = async () => {
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

      // Process video URLs based on source type
      const processedVideos = manifest.videos.map(video => {
        const processedVideo = { ...video };
        if (videoSource.type === 'local') {
          processedVideo.url = `${videoSource.videosPath}/${video.key}`;
        }
        return processedVideo;
      });

      setAvailableVideos(processedVideos);
      
      // Load initial random video
      const randomIndex = Math.floor(Math.random() * processedVideos.length);
      const selectedVideo = processedVideos[randomIndex];
      setCurrentVideo(selectedVideo);
      
      // Preload next random video if not in loop mode
      if (!isLoopMode) {
        preloadNextRandomVideo(processedVideos, selectedVideo);
      }
      
      console.log(`[VideoPlayer] Selected video:`, selectedVideo.key);
      
    } catch (err) {
      console.error('[VideoPlayer] Error loading video:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
      loadFallbackVideo();
    } finally {
      setIsLoading(false);
    }
  };

  // Preload next random video
  const preloadNextRandomVideo = (videos: VideoItem[], currentVid: VideoItem) => {
    if (videos.length <= 1) return;
    
    // Pure random selection
    let randomIndex = Math.floor(Math.random() * videos.length);
    
    // Ensure we don't select the same video
    while (videos[randomIndex].key === currentVid.key && videos.length > 1) {
      randomIndex = Math.floor(Math.random() * videos.length);
    }
    
    const next = videos[randomIndex];
    setNextVideo(next);
    
    // Preload the video
    if (nextVideoRef.current) {
      nextVideoRef.current.src = next.url;
      nextVideoRef.current.load();
    }
  };

  // Handle video ended
  const handleVideoEnded = () => {
    if (!isLoopMode && availableVideos.length > 0) {
      // Switch to next preloaded video
      if (nextVideo) {
        setCurrentVideo(nextVideo);
        
        // Preload another random video
        preloadNextRandomVideo(availableVideos, nextVideo);
      } else {
        // Fallback: load a new random video
        const randomIndex = Math.floor(Math.random() * availableVideos.length);
        const selectedVideo = availableVideos[randomIndex];
        setCurrentVideo(selectedVideo);
        preloadNextRandomVideo(availableVideos, selectedVideo);
      }
    }
    // If loop mode is on, the video will naturally loop via the loop attribute
  };

  // Toggle between random and loop mode
  const togglePlayMode = () => {
    const newLoopMode = !isLoopMode;
    setIsLoopMode(newLoopMode);
    
    // Save preference
    localStorage.setItem('sww-video-loop', JSON.stringify(newLoopMode));
    
    // If switching to random mode, preload next video
    if (!newLoopMode && currentVideo && availableVideos.length > 0) {
      preloadNextRandomVideo(availableVideos, currentVideo);
    }
  };

  // Load loop preference
  useEffect(() => {
    const savedLoopMode = localStorage.getItem('sww-video-loop');
    if (savedLoopMode !== null) {
      setIsLoopMode(JSON.parse(savedLoopMode));
    }
  }, []);

  // Load overlay preferences
  useEffect(() => {
    const savedShowOverlay = localStorage.getItem('sww-video-overlay');
    const savedOpacity = localStorage.getItem('sww-video-overlay-opacity');
    const savedBlendMode = localStorage.getItem('sww-video-blend-mode');
    const savedBrightness = localStorage.getItem('sww-video-brightness');
    
    if (savedShowOverlay !== null) {
      setShowOverlay(JSON.parse(savedShowOverlay));
    }
    if (savedOpacity !== null) {
      setOverlayOpacity(parseFloat(savedOpacity));
    }
    if (savedBlendMode !== null) {
      setBlendMode(savedBlendMode);
    } else {
      // Try to get initial value from CSS
      const cssBlendMode = getComputedStyle(document.documentElement)
        .getPropertyValue('--video-overlay-blend').trim();
      if (cssBlendMode) {
        setBlendMode(cssBlendMode);
      }
    }
    if (savedBrightness !== null) {
      setVideoBrightness(parseFloat(savedBrightness));
    }
  }, []);

  // Toggle overlay
  const toggleOverlay = () => {
    const newState = !showOverlay;
    setShowOverlay(newState);
    localStorage.setItem('sww-video-overlay', JSON.stringify(newState));
  };

  // Update opacity
  const handleOpacityChange = (newOpacity: number) => {
    setOverlayOpacity(newOpacity);
    localStorage.setItem('sww-video-overlay-opacity', newOpacity.toString());
  };

  // Update blend mode
  const handleBlendModeChange = (mode: string) => {
    setBlendMode(mode);
    localStorage.setItem('sww-video-blend-mode', mode);
    setShowBlendMenu(false);
  };

  // Update video brightness
  const handleBrightnessChange = (newBrightness: number) => {
    setVideoBrightness(newBrightness);
    localStorage.setItem('sww-video-brightness', newBrightness.toString());
  };

  // Load and watch for color changes
  useEffect(() => {
    const updateColor = () => {
      const savedColor = localStorage.getItem('sww-color');
      if (savedColor) {
        setUserColor(savedColor);
      }
    };

    // Initial load
    updateColor();

    // Check periodically for color changes (same tab)
    const interval = setInterval(updateColor, 500);

    return () => clearInterval(interval);
  }, []);

  // Close blend menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (blendMenuRef.current && !blendMenuRef.current.contains(event.target as Node)) {
        setShowBlendMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for shared video events
  useEffect(() => {
    const handlePlaySharedVideo = (event: CustomEvent) => {
      const { videoKey } = event.detail;
      
      // Find the video in available videos
      const video = availableVideos.find(v => v.key === videoKey);
      if (video) {
        // Set the video and enable loop mode
        setCurrentVideo(video);
        setIsLoopMode(true);
        localStorage.setItem('sww-video-loop', JSON.stringify(true));
        
        // Preload might not be needed in loop mode, but reset it
        setNextVideo(null);
      }
    };

    window.addEventListener('playSharedVideo' as any, handlePlaySharedVideo);
    
    return () => {
      window.removeEventListener('playSharedVideo' as any, handlePlaySharedVideo);
    };
  }, [availableVideos]);

  // Share current video
  const shareVideo = () => {
    if (!currentVideo) return;
    
    // Create a share event with video details
    const shareEvent = new CustomEvent('shareVideo', {
      detail: {
        videoKey: currentVideo.key,
        videoName: currentVideo.key.replace(/\.mp4$/, '').replace(/_/g, ' ')
      }
    });
    
    window.dispatchEvent(shareEvent);
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

  // Darker color helper
  const getDarkerColor = (color: string, factor: number) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Main Video Element */}
      {currentVideo && !error && (
        <video
          ref={videoRef}
          key={currentVideo.key}
          className="w-full h-full object-cover"
          style={{ 
            filter: `brightness(${videoBrightness})`
          }}
          src={currentVideo.url}
          autoPlay
          loop={isLoopMode}
          muted={true}
          playsInline
          onEnded={handleVideoEnded}
          onError={(e) => {
            console.error('[VideoPlayer] Video playback error:', e);
            setError('Failed to play video');
          }}
        />
      )}

      {/* Hidden Preload Video */}
      {nextVideo && !isLoopMode && (
        <video
          ref={nextVideoRef}
          className="hidden"
          src={nextVideo.url}
          muted={true}
          playsInline
          preload="auto"
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
              onClick={loadVideoManifest}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Color Overlay */}
      {currentVideo && !error && showOverlay && (
        <div 
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            backgroundColor: userColor,
            opacity: overlayOpacity,
            mixBlendMode: blendMode as any,
          }}
        />
      )}

      {/* Controls Overlay */}
      {currentVideo && !error && (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          {/* Brightness Slider (leftmost) */}
          <div className="flex items-center bg-black/50 backdrop-blur-sm rounded-full px-3 py-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={videoBrightness}
              onChange={(e) => handleBrightnessChange(parseFloat(e.target.value))}
              className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, ${getDarkerColor(userColor, 0.2)} 0%, ${userColor} ${videoBrightness * 100}%, rgba(255,255,255,0.2) ${videoBrightness * 100}%, rgba(255,255,255,0.2) 100%)`,
              }}
              title="Brightness"
            />
          </div>

          {/* Opacity Slider */}
          {showOverlay && (
            <div className="flex items-center bg-black/50 backdrop-blur-sm rounded-full px-3 py-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, ${getDarkerColor(userColor, 0.4)} 0%, ${userColor} ${overlayOpacity * 100}%, rgba(255,255,255,0.2) ${overlayOpacity * 100}%, rgba(255,255,255,0.2) 100%)`,
                  color: userColor
                }}
                title="Filter"
              />
            </div>
          )}

          {/* Blend Mode Menu */}
          {showOverlay && (
            <div className="relative" ref={blendMenuRef}>
              <button
                onClick={() => setShowBlendMenu(!showBlendMenu)}
                className="flex items-center gap-1 px-3 py-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/60 transition-all"
                title="Change blend mode"
              >
                <span className="text-xs" style={{ color: getDarkerColor(userColor, 0.6) }}>{blendMode}</span>
                <ChevronDown className="w-3 h-3" style={{ color: getDarkerColor(userColor, 0.6) }} />
              </button>
              
              {showBlendMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-md rounded-lg p-1 min-w-[140px] grid grid-cols-2 gap-0.5">
                  {blendModes.map(mode => (
                    <button
                      key={mode}
                      onClick={() => handleBlendModeChange(mode)}
                      className={`text-left px-2 py-1.5 text-xs rounded transition-colors ${
                        mode === blendMode
                          ? 'bg-white/20'
                          : 'hover:bg-white/10'
                      }`}
                      style={{
                        color: mode === blendMode ? userColor : getDarkerColor(userColor, 0.6)
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Color Overlay Toggle */}
          <button
            onClick={toggleOverlay}
            className={`p-2 rounded-full transition-all ${
              showOverlay ? 'bg-black/50' : 'bg-black/30'
            } backdrop-blur-sm hover:bg-black/60`}
            title={showOverlay ? "Hide color overlay" : "Show color overlay"}
          >
            <Palette 
              className="w-4 h-4"
              style={{ 
                color: showOverlay ? userColor : getDarkerColor(userColor, 0.4),
                opacity: showOverlay ? 1 : 0.6
              }}
            />
          </button>

          {/* Random/Loop Switch */}
          <div className="flex bg-black/50 backdrop-blur-sm rounded-full p-1">
            {/* Random Mode (Left) */}
            <button
              onClick={togglePlayMode}
              className={`px-3 py-2 rounded-full transition-all ${
                !isLoopMode ? 'bg-black/60' : 'hover:bg-black/20'
              }`}
              title="Random mode - play videos randomly"
            >
              <Shuffle 
                className="w-4 h-4"
                style={{ 
                  color: !isLoopMode ? userColor : getDarkerColor(userColor, 0.3)
                }}
              />
            </button>

            {/* Loop Mode (Right) */}
            <button
              onClick={togglePlayMode}
              className={`px-3 py-2 rounded-full transition-all ${
                isLoopMode ? 'bg-black/60' : 'hover:bg-black/20'
              }`}
              title="Loop mode - repeat current video"
            >
              <Repeat 
                className="w-4 h-4"
                style={{ 
                  color: isLoopMode ? userColor : getDarkerColor(userColor, 0.3)
                }}
              />
            </button>
          </div>

          {/* Share Button (rightmost) */}
          <button
            onClick={shareVideo}
            className="p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/60 transition-all"
            title="Share this video in chat"
          >
            <ArrowUp 
              className="w-4 h-4"
              style={{ 
                color: userColor,
                opacity: 0.8
              }}
            />
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
