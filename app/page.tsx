'use client';

import React, { useState, useEffect } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import CommentsStream from '@/components/CommentsStream';

export default function Home() {
  const [showVideo, setShowVideo] = useState(true);
  const [userColor, setUserColor] = useState('#60A5FA');

  // Load video preference and color from localStorage
  useEffect(() => {
    const savedShowVideo = localStorage.getItem('sww-show-video');
    if (savedShowVideo !== null) {
      setShowVideo(savedShowVideo === 'true');
    }
    
    // Get user color from localStorage for overlay
    const savedColor = localStorage.getItem('sww-color');
    if (savedColor) {
      setUserColor(savedColor);
    }
    
    // Listen for color changes
    const handleStorageChange = () => {
      const newColor = localStorage.getItem('sww-color');
      if (newColor) {
        setUserColor(newColor);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for same-tab changes
    const interval = setInterval(() => {
      const currentColor = localStorage.getItem('sww-color');
      if (currentColor && currentColor !== userColor) {
        setUserColor(currentColor);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [userColor]);

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
        {showVideo && (
          <>
            <VideoPlayer />
            
            {/* Color Overlay */}
            <div 
              className="absolute inset-0 pointer-events-none video-overlay"
              style={{
                backgroundColor: userColor,
                opacity: 'var(--video-overlay-opacity)',
                mixBlendMode: 'var(--video-overlay-blend)' as any,
              }}
            />
          </>
        )}
      </div>

      {/* Right Side - Comments Stream */}
      <div className="flex-1 h-full min-w-0 transition-all duration-500 ease-in-out">
        <CommentsStream 
          showVideo={showVideo}
          toggleVideo={toggleVideo}
          videoOverlayColor={userColor}
        />
      </div>
    </main>
  );
}
