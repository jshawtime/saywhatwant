'use client';

import React, { useState, useEffect } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import CommentsStream from '@/components/CommentsStream';
import { getRandomColor } from '@/modules/colorSystem';

export default function Home() {
  const [showVideo, setShowVideo] = useState(false);
  const [userColor, setUserColor] = useState(() => getRandomColor());

  // Load video preference from localStorage
  useEffect(() => {
    const savedShowVideo = localStorage.getItem('sww-show-video');
    if (savedShowVideo !== null) {
      setShowVideo(savedShowVideo === 'true');
    }
  }, []);

  // Load and sync user color
  useEffect(() => {
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
    <main className="flex h-screen bg-black relative">
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
