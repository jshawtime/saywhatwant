'use client';

import React, { useState, useEffect, useLayoutEffect } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import CommentsStream from '@/components/CommentsStream';
import { MobileBlockScreen } from '@/components/MobileBlockScreen';
import { getRandomColor, DEFAULT_COLOR, nineDigitToRgb } from '@/modules/colorSystem';

export default function Home() {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Video visible by default on first visit
  const [showVideo, setShowVideo] = useState(true);
  // Color: server has no value, client sets in useLayoutEffect (100% client-side)
  // CRITICAL: Start with valid DEFAULT_COLOR to prevent hydration errors
  const [userColor, setUserColor] = useState(DEFAULT_COLOR);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(width < 1024 || isTouch);
    };
    
    checkMobile();
    setMounted(true);
    
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load video preference from localStorage
  useEffect(() => {
    const savedShowVideo = localStorage.getItem('sww-show-video');
    if (savedShowVideo !== null) {
      setShowVideo(savedShowVideo === 'true');
    } else {
      // First visit - set default to true and save to localStorage
      localStorage.setItem('sww-show-video', 'true');
    }
  }, []);

  // Set client color - runs BEFORE paint (very early, client-only)
  useLayoutEffect(() => {
    const saved = localStorage.getItem('sww-color');
    if (saved) {
      setUserColor(saved);
    } else {
      // First visit - generate and save
      const newColor = getRandomColor();
      setUserColor(newColor);
      localStorage.setItem('sww-color', newColor);
    }
    
    // Listen for changes

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sww-color' && e.newValue) {
        setUserColor(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event for same-tab changes
    const handleColorChange = () => {
      const saved = localStorage.getItem('sww-color');
      if (saved) setUserColor(saved);
    };
    window.addEventListener('colorChanged', handleColorChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('colorChanged', handleColorChange);
    };
  }, []);

  const toggleVideo = () => {
    const newState = !showVideo;
    setShowVideo(newState);
    localStorage.setItem('sww-show-video', String(newState));
  };

  // Convert userColor to RGB string for VideoPlayer
  const userColorRgb = nineDigitToRgb(userColor);

  // Show mobile block if not mounted yet (prevent hydration mismatch)
  if (!mounted) return null;
  
  // Show mobile block screen on mobile devices
  if (isMobile) return <MobileBlockScreen />;

  return (
    <main className="flex h-screen h-dvh bg-black relative overflow-hidden">
      {/* Left Side - Video Player (9:16 aspect ratio container) */}
      <div 
        className={`relative h-full overflow-hidden transition-all duration-500 ease-in-out ${
          showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ 
          width: showVideo ? 'calc(100vh * 9 / 16)' : '0',
        }}
      >
        {showVideo && <VideoPlayer toggleVideo={toggleVideo} userColor={userColor} userColorRgb={userColorRgb} />}
      </div>

      {/* Right Side - Comments Stream */}
      <div className="flex-1 h-full min-w-0 transition-all duration-500 ease-in-out">
        <CommentsStream 
          showVideo={showVideo}
          toggleVideo={toggleVideo}
        />
      </div>
    </main>
  );
}
