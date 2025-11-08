'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VideoItem, VideoManifest } from '@/types';
import { getVideoSource } from '@/config/video-source';
import { Shuffle, Repeat, Palette, Share2, ChevronDown, Settings, Sun, Layers, Tv } from 'lucide-react';
import { adjustColorBrightness as getDarkerColor } from '@/modules/colorSystem';
import { OPACITY_LEVELS } from '@/modules/colorOpacity';

interface VideoPlayerProps {
  toggleVideo?: () => void;
  userColor: string;
  userColorRgb: string; // RGB format string e.g. "rgb(100, 200, 150)"
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ toggleVideo, userColor, userColorRgb }) => {
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [nextVideo, setNextVideo] = useState<VideoItem | null>(null);
  const [availableVideos, setAvailableVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoopMode, setIsLoopMode] = useState(false);
  // userColor now comes from props - removed duplicate state
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(1.0);  // Default, will read from CSS if available
  const [blendMode, setBlendMode] = useState('hue');  // Default, will read from CSS if available
  const [showBlendMenu, setShowBlendMenu] = useState(false);
  const [videoBrightness, setVideoBrightness] = useState(0.45); // 0.45 = 45% brightness (default)
  const [showSettings, setShowSettings] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const blendMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Available blend modes
  const blendModes = [
    'normal', 'multiply', 'screen', 'overlay', 
    'darken', 'lighten', 'color-dodge', 'color-burn',
    'hard-light', 'soft-light', 'difference', 'exclusion',
    'hue', 'saturation', 'color', 'luminosity'
  ];
  
  // Force re-render when userColor changes (ensures overlay updates)
  const [, forceUpdate] = useState({});
  useEffect(() => {
    forceUpdate({});  // Trigger re-render when color changes
  }, [userColorRgb]);

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
        // For local videos, the manifest already contains the full path
        // For R2, we might need to prepend the base URL if not already included
        if (videoSource.type === 'r2') {
          if (video.url.startsWith('http')) {
            // Already a full URL, use as-is
            processedVideo.url = video.url;
          } else {
            // Remove /sww-videos/ prefix if present (cached manifest issue)
            let cleanPath = video.url;
            if (cleanPath.startsWith('/sww-videos/')) {
              cleanPath = cleanPath.replace('/sww-videos/', '/');
            }
            // Prepend R2 base URL
            processedVideo.url = `${videoSource.baseUrl}${cleanPath}`;
          }
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
    
    // Load opacity from localStorage or CSS
    if (savedOpacity !== null) {
      setOverlayOpacity(parseFloat(savedOpacity));
    } else {
      // Try to get initial value from CSS
      const cssOpacity = getComputedStyle(document.documentElement)
        .getPropertyValue('--video-overlay-opacity').trim();
      if (cssOpacity) {
        setOverlayOpacity(parseFloat(cssOpacity));
      }
    }
    
    // Load blend mode from localStorage or CSS
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

  // userColor now synced from parent component - no need for local updates

  // Close blend menu and settings on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (blendMenuRef.current && !blendMenuRef.current.contains(event.target as Node)) {
        setShowBlendMenu(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        // Check if the click is not on the settings button itself
        const target = event.target as HTMLElement;
        if (!target.closest('[data-settings-button]')) {
          setShowSettings(false);
        }
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

  // Using getDarkerColor from colorSystem module now (handles RGB colors)

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
            backgroundColor: userColorRgb,  // RGB format required for valid CSS
            opacity: overlayOpacity,
            mixBlendMode: blendMode as any,
          }}
        />
      )}

      {/* Settings and Share Buttons */}
      {currentVideo && !error && (
        <>
          {/* Settings Button (bottom left) */}
          <div className="absolute bottom-4 left-4 z-20">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-full transition-all ${
                showSettings ? 'bg-black/70' : 'bg-black/50'
              } backdrop-blur-sm hover:bg-black/60`}
              title="Video settings"
              data-settings-button
            >
              <Settings 
                className="w-4 h-4"
                style={{ 
                  color: showSettings 
                    ? getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT) // Active: 60% opacity
                    : getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK) // Inactive: 40% opacity
                }}
              />
            </button>
          </div>

          {/* Share Button (bottom right) */}
          <div className="absolute bottom-4 right-4 z-20">
            <button
              onClick={shareVideo}
              className="p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/60 transition-all"
              title="Share this video in chat"
            >
              <Share2 
                className="w-4 h-4"
                style={{ 
                  color: getDarkerColor(userColorRgb, OPACITY_LEVELS.MEDIUM) // 50% opacity for consistency
                }}
              />
            </button>
          </div>

          {/* TV Toggle (top right) - Match main UI TV button styling */}
          {toggleVideo && (
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={toggleVideo}
                className="p-2 hover:opacity-80 transition-opacity"
                title="Close video area"
              >
                <Tv 
                  className="w-5 h-5"
                  style={{ 
                    color: getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT), // Match main UI (60% opacity)
                    opacity: 1 // Always visible when drawer is open
                  }}
                />
              </button>
            </div>
          )}

          {/* Settings Menu (slides up from bottom) */}
          <div 
            ref={settingsRef}
            className={`absolute bottom-16 left-4 z-30 transition-all duration-300 ease-out ${
              showSettings ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-4 opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex flex-col gap-2 bg-black/60 backdrop-blur-md rounded-lg p-2">
              {/* Brightness */}
              <div className="flex items-center gap-2 bg-black/40 rounded-full px-2 py-1">
                <Sun 
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: getDarkerColor(userColorRgb, OPACITY_LEVELS.MEDIUM) }} // 50% opacity
                />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={videoBrightness}
                  onChange={(e) => handleBrightnessChange(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, ${getDarkerColor(userColor, 0.4)} 0%, ${userColor} ${videoBrightness * 100}%, rgba(255,255,255,0.2) ${videoBrightness * 100}%, rgba(255,255,255,0.2) 100%)`,
                    color: userColor
                  }}
                  title="Brightness"
                />
              </div>

              {/* Filter Opacity with Toggle */}
              <div className="flex items-center gap-2 bg-black/40 rounded-full px-2 py-1">
                <button
                  onClick={toggleOverlay}
                  className="flex-shrink-0"
                  title={showOverlay ? "Disable color overlay" : "Enable color overlay"}
                >
                  <Palette 
                    className="w-4 h-4"
                    style={{ 
                      color: showOverlay 
                        ? getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT) // Active: 60% opacity
                        : getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK) // Inactive: 40% opacity
                    }}
                  />
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={overlayOpacity}
                  onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                  disabled={!showOverlay}
                  className={`w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider ${
                    !showOverlay ? 'opacity-30 cursor-default' : ''
                  }`}
                  style={{
                    background: showOverlay 
                      ? `linear-gradient(to right, ${getDarkerColor(userColor, 0.4)} 0%, ${userColor} ${overlayOpacity * 100}%, rgba(255,255,255,0.2) ${overlayOpacity * 100}%, rgba(255,255,255,0.2) 100%)`
                      : 'rgba(255,255,255,0.1)',
                    color: userColor
                  }}
                  title="Filter opacity"
                />
              </div>

              {/* Blend Mode */}
              <div className="relative">
                <button
                  onClick={() => showOverlay && setShowBlendMenu(!showBlendMenu)}
                  className={`flex items-center gap-1 px-2 py-2 bg-black/40 rounded-full transition-all w-full ${
                    showOverlay ? 'hover:bg-black/50' : 'cursor-default'
                  }`}
                  title="Blend mode"
                >
                  <Layers 
                    className="w-4 h-4"
                    style={{ 
                      color: showOverlay 
                        ? getDarkerColor(userColorRgb, OPACITY_LEVELS.MEDIUM) // Active: 50% opacity
                        : getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK) // Inactive: 40% opacity
                    }}
                  />
                  <span 
                    className="text-xs" 
                    style={{ 
                      color: showOverlay 
                        ? getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT) // Active: 60% opacity
                        : getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK) // Inactive: 40% opacity
                    }}
                  >
                    {blendMode}
                  </span>
                </button>
                
                {showBlendMenu && showOverlay && (
                  <div className="absolute bottom-full mb-2 left-0 bg-black/90 backdrop-blur-md rounded-lg p-1 min-w-[140px] grid grid-cols-2 gap-0.5">
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
                          color: mode === blendMode 
                            ? getDarkerColor(userColorRgb, OPACITY_LEVELS.LIGHT) // Selected: 60% opacity
                            : getDarkerColor(userColorRgb, OPACITY_LEVELS.DARK) // Unselected: 40% opacity
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Playback Mode Toggle - Mutually Exclusive States */}
              <div className="flex justify-center bg-black/40 rounded-full p-0.5">
                <button
                  onClick={togglePlayMode}
                  className={`px-3 py-2 rounded-full transition-all ${
                    !isLoopMode ? 'bg-black/40' : 'hover:bg-black/20'
                  }`}
                  title="Random playback mode"
                >
                  <Shuffle 
                    className="w-4 h-4"
                    style={{ 
                      color: !isLoopMode 
                        ? userColorRgb  // Active: FULL color (100% brightness - highly visible)
                        : getDarkerColor(userColorRgb, 0.6)  // Inactive: 60% (dimmer but still visible)
                    }}
                  />
                </button>
                <button
                  onClick={togglePlayMode}
                  className={`px-3 py-2 rounded-full transition-all ${
                    isLoopMode ? 'bg-black/40' : 'hover:bg-black/20'
                  }`}
                  title="Loop current video mode"
                >
                  <Repeat 
                    className="w-4 h-4"
                    style={{ 
                      color: isLoopMode 
                        ? userColorRgb  // Active: FULL color (100% brightness - highly visible)
                        : getDarkerColor(userColorRgb, 0.6)  // Inactive: 60% (dimmer but still visible)
                    }}
                  />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoPlayer;
