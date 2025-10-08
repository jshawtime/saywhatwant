import React from 'react';

interface ParseOptions {
  onWordClick?: (word: string) => void;
  onVideoClick?: (videoKey: string) => void;
}

/**
 * Parses comment text to make words clickable and handle video links
 */
export const parseCommentText = (
  text: string, 
  options: ParseOptions = {}
): React.ReactNode[] => {
  const { onWordClick, onVideoClick } = options;
  
  // Check for video links first
  const videoRegex = /\[video:([^\]]+)\] <-- video/g;
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  
  // Split by video links first
  const videoParts = text.split(videoRegex);
  const result: React.ReactNode[] = [];
  
  for (let i = 0; i < videoParts.length; i++) {
    if (i % 2 === 1) {
      // This is a video key
      const videoKey = videoParts[i];
      result.push(
        <button
          key={`video-${i}`}
          onClick={() => onVideoClick?.(videoKey)}
          className="inline-flex items-center gap-1 underline hover:opacity-80"
          style={{ color: 'inherit' }}
          title={`Play video: ${videoKey}`}
        >
          <span>←</span> video
        </button>
      );
    } else {
      // This is regular text, parse for URLs
      const urlParts = videoParts[i].split(urlRegex);
      urlParts.forEach((part, urlIndex) => {
        if (part.match(urlRegex)) {
          result.push(
            <a
              key={`url-${i}-${urlIndex}`}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="underline break-all hover:opacity-80"
              style={{ color: 'inherit' }}
            >
              {part}
            </a>
          );
          } else if (part) {
          // Split text into words and make each clickable if handler provided
          if (onWordClick) {
            const words = part.split(/(\s+)/);
            words.forEach((word, wordIndex) => {
              // Check if this is whitespace
              if (/^\s+$/.test(word)) {
                result.push(<span key={`space-${i}-${urlIndex}-${wordIndex}`}>{word}</span>);
              } else if (word) {
                // This is an actual word - make it clickable
                result.push(
                  <span
                    key={`word-${i}-${urlIndex}-${wordIndex}`}
                    onClick={() => onWordClick(word)}
                    className="hover:underline cursor-pointer"
                    style={{ color: 'inherit' }}
                    title={`Click to filter by: ${word}`}
                  >
                    {word}
                  </span>
                );
              }
            });
          } else {
            // No word click handler, just render as plain text
            result.push(<span key={`text-${i}-${urlIndex}`}>{part}</span>);
          }
        }
      });
    }
  }
  
  return result;
};

/**
 * Gets a darker version of a hex color
 */
export const getDarkerColor = (color: string, factor: number = 0.6): string => {
  // Convert hex to RGB, reduce brightness by factor
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  const darkerR = Math.floor(r * factor);
  const darkerG = Math.floor(g * factor);
  const darkerB = Math.floor(b * factor);
  
  return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
};
