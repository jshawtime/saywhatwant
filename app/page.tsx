import VideoPlayer from '@/components/VideoPlayer';
import CommentsStream from '@/components/CommentsStream';

export default function Home() {
  return (
    <main className="flex h-screen bg-black">
      {/* Left Side - Video Player (9:16 aspect ratio container) */}
      <div className="relative h-full" style={{ width: 'calc(100vh * 9 / 16)' }}>
        <VideoPlayer />
      </div>

      {/* Right Side - Comments Stream */}
      <div className="flex-1 h-full min-w-0">
        <CommentsStream />
      </div>
    </main>
  );
}
