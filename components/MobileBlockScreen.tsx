/**
 * MobileBlockScreen Component
 * 
 * Displays message on mobile devices that HigherMind.ai is desktop-only
 * Includes copy button for the URL with visual feedback
 */

'use client';

import React, { useState } from 'react';

export const MobileBlockScreen: React.FC = () => {
  const [copiedSite, setCopiedSite] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopySite = async () => {
    try {
      await navigator.clipboard.writeText('HigherMind.ai');
      setCopiedSite(true);
      setTimeout(() => setCopiedSite(false), 3000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = 'HigherMind.ai';
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedSite(true);
        setTimeout(() => setCopiedSite(false), 3000);
      } catch (e) {
        console.error('Failed to copy:', e);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleCopyUrl = async () => {
    const currentUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 3000);
      } catch (e) {
        console.error('Failed to copy:', e);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white p-8">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="text-2xl mb-6" style={{ color: '#D946EF' }}>
            HigherMind.ai is a desktop only site
          </div>
          <div className="text-xl" style={{ color: '#D946EF' }}>
            that may just change your life for the better.
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleCopySite}
            className="px-6 py-3 text-lg rounded-lg transition-all duration-200"
            style={{
              backgroundColor: copiedSite ? 'rgb(34, 197, 94)' : '#D946EF',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              minWidth: '200px',
              width: '100%'
            }}
          >
            {copiedSite ? 'Copied!' : 'Copy HigherMind.ai'}
          </button>

          <button
            onClick={handleCopyUrl}
            className="px-6 py-3 text-lg rounded-lg transition-all duration-200"
            style={{
              backgroundColor: copiedUrl ? 'rgb(34, 197, 94)' : '#D946EF',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              minWidth: '200px',
              width: '100%',
              minHeight: '80px'
            }}
          >
            {copiedUrl ? 'Copied!' : 'Continue the AI Conversation on Desktop'}
          </button>
        </div>

        <div className="mt-6 text-sm" style={{ color: '#9333EA' }}>
          Visit on desktop for the full experience
        </div>
      </div>
    </div>
  );
};

