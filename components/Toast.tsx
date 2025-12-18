/**
 * Toast Component
 * 
 * A simple toast notification system that can be triggered from anywhere
 * via custom events. Renders as a portal at the top of the viewport.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, Bookmark, X } from 'lucide-react';

interface ToastData {
  message: string;
  subMessage?: string;
  type?: 'success' | 'info' | 'bookmark';
  duration?: number; // 0 or undefined for persistent (requires manual dismiss)
  persistent?: boolean;
}

// Global function to show toast
export const showToast = (data: ToastData) => {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: data }));
};

// Toast Provider Component - add this once at app root level
export const ToastProvider: React.FC<{ userColorRgb?: string }> = ({ userColorRgb = 'rgb(56, 189, 248)' }) => {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hideToast = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => setToast(null), 300); // Wait for fade out
  }, []);

  useEffect(() => {
    const handleShowToast = (e: CustomEvent<ToastData>) => {
      setToast(e.detail);
      setIsVisible(true);
      
      // Only auto-hide if not persistent and duration > 0
      if (!e.detail.persistent && e.detail.duration && e.detail.duration > 0) {
        setTimeout(hideToast, e.detail.duration);
      }
    };

    window.addEventListener('show-toast', handleShowToast as EventListener);
    return () => {
      window.removeEventListener('show-toast', handleShowToast as EventListener);
    };
  }, [hideToast]);

  if (!mounted || !toast) return null;

  // Special large layout for bookmark toast
  if (toast.type === 'bookmark') {
    return createPortal(
      <div
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <div 
          className="bg-black/95 backdrop-blur-md border-2 rounded-xl shadow-2xl px-6 py-5 flex flex-col items-center gap-4 min-w-[280px] relative"
          style={{ borderColor: userColorRgb }}
        >
          {/* Close Button */}
          <button
            onClick={hideToast}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-white/50 hover:text-white/80" />
          </button>
          
          {/* Icon */}
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${userColorRgb}25` }}
          >
            <Bookmark className="w-6 h-6" style={{ color: userColorRgb }} />
          </div>
          
          {/* URL Copied confirmation */}
          <p className="text-white/70 text-sm">{toast.message}</p>
          
          {/* Large Keyboard Shortcut */}
          {toast.subMessage && (
            <div 
              className="px-5 py-3 rounded-lg"
              style={{ backgroundColor: `${userColorRgb}15` }}
            >
              <p 
                className="text-xl font-bold tracking-wide"
                style={{ color: userColorRgb }}
              >
                {toast.subMessage}
              </p>
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }

  // Standard toast for other types
  const icon = (
    <Check className="w-5 h-5" style={{ color: userColorRgb }} />
  );

  return createPortal(
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div 
        className="bg-black/95 backdrop-blur-md border rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 relative"
        style={{ borderColor: `${userColorRgb}40` }}
      >
        {/* Close Button for persistent toasts */}
        {toast.persistent && (
          <button
            onClick={hideToast}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3 h-3 text-white/50 hover:text-white/80" />
          </button>
        )}
        
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${userColorRgb}20` }}
        >
          {icon}
        </div>
        <div className={toast.persistent ? 'pr-6' : ''}>
          <p className="text-white text-sm font-medium">{toast.message}</p>
          {toast.subMessage && (
            <p className="text-white/60 text-xs mt-0.5">{toast.subMessage}</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ToastProvider;
