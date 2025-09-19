'use client';

import React, { useState, useEffect } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import CommentsStream from '@/components/CommentsStream';
import { Eye, EyeOff } from 'lucide-react';

export default function Home() {
  const [showVideo, setShowVideo] = useState(true);

  // Load video preference from localStorage
  useEffect(() => {
    const savedShowVideo = localStorage.getItem('sww-show-video');
    if (savedShowVideo !== null) {
      setShowVideo(savedShowVideo === 'true');
    }
  }, []);

  const toggleVideo = () => {
    const newState = !showVideo;
    setShowVideo(newState);
    localStorage.setItem('sww-show-video', String(newState));
  };

  return (
    <main className="flex h-screen bg-black relative">
      {/* Video Toggle Button */}
      <button
        onClick={toggleVideo}
        className="absolute top-4 left-4 z-50 p-2 bg-black/50 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-black/70 transition-colors group"
        title={showVideo ? 'Hide video' : 'Show video'}
      >
        {showVideo ? (
          <EyeOff className="w-5 h-5 text-white/70 group-hover:text-white" />
        ) : (
          <Eye className="w-5 h-5 text-white/70 group-hover:text-white" />
        )}
      </button>

      {/* Left Side - Video Player (9:16 aspect ratio container) */}
      {showVideo && (
        <div className="relative h-full" style={{ width: 'calc(100vh * 9 / 16)' }}>
          <VideoPlayer />
        </div>
      )}

      {/* Right Side - Comments Stream */}
      <div className="flex-1 h-full min-w-0">
        <CommentsStream />
      </div>
    </main>
  );
}
