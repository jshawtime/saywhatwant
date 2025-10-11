'use client';

import React, { useState, useEffect, useLayoutEffect } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import CommentsStream from '@/components/CommentsStream';
import { getRandomColor } from '@/modules/colorSystem';

export default function Home() {
  // Video visible by default on first visit
  const [showVideo, setShowVideo] = useState(true);
  // Initialize color - client generates random, server uses deterministic value
  const [userColor, setUserColor] = useState(() => {
    // Client: generate random and save immediately
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sww-color');
      if (saved) return saved;
      const newColor = getRandomColor();
      localStorage.setItem('sww-color', newColor);
      return newColor;
    }
    // Server: use first color from palette (deterministic, no mismatch)
    return '096165250'; // Blue from COLOR_PALETTE[0]
  });

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

  // Sync user color from localStorage - runs BEFORE paint (very early)
  useLayoutEffect(() => {
    const loadColor = () => {
      const savedColor = localStorage.getItem('sww-color');
      if (savedColor) {
        setUserColor(savedColor);
      }
    };

    // Initial load
    loadColor();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sww-color' && e.newValue) {
        setUserColor(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event for same-tab changes
    const handleColorChange = () => loadColor();
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
        {showVideo && <VideoPlayer toggleVideo={toggleVideo} userColor={userColor} />}
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
