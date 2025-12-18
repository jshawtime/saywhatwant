/**
 * Toast Component
 * 
 * A simple toast notification system that can be triggered from anywhere
 * via custom events. Renders as a portal at the top of the viewport.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, Bookmark } from 'lucide-react';

interface ToastData {
  message: string;
  subMessage?: string;
  type?: 'success' | 'info' | 'bookmark';
  duration?: number;
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
      
      // Auto-hide after duration
      const duration = e.detail.duration || 3000;
      setTimeout(hideToast, duration);
    };

    window.addEventListener('show-toast', handleShowToast as EventListener);
    return () => {
      window.removeEventListener('show-toast', handleShowToast as EventListener);
    };
  }, [hideToast]);

  if (!mounted || !toast) return null;

  const icon = toast.type === 'bookmark' ? (
    <Bookmark className="w-5 h-5" style={{ color: userColorRgb }} />
  ) : (
    <Check className="w-5 h-5" style={{ color: userColorRgb }} />
  );

  return createPortal(
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div 
        className="bg-black/95 backdrop-blur-md border rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3"
        style={{ borderColor: `${userColorRgb}40` }}
      >
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${userColorRgb}20` }}
        >
          {icon}
        </div>
        <div>
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

