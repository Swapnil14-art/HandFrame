import React, { useEffect, useState } from 'react';

interface ToastNotificationProps {
  message: string | null;
  onClear: () => void;
}

/**
 * ToastNotification Component:
 * Displays transient, non-intrusive HUD notifications (e.g. filter name upon gesture trigger,
 * snapshot capture confirmation, or countdown timer status) centered at the top of the viewport.
 */
export const ToastNotification: React.FC<ToastNotificationProps> = ({ message, onClear }) => {
  const [visible, setVisible] = useState(false);

  // Auto-dismisses the toast notification after 1400ms duration
  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onClear();
      }, 1400);

      // Clean up timer on unmount or when message changes rapidly
      return () => clearTimeout(timer);
    }
  }, [message, onClear]);

  if (!message || !visible) return null;

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 transform animate-in fade-in zoom-in-95">
      <div className="bg-black/60 backdrop-blur-md text-white/90 px-6 py-2 rounded-full border border-white/10 shadow-2xl text-xs font-mono tracking-widest uppercase flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        {message}
      </div>
    </div>
  );
};
