import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
];

export function useInactivityLogout(enabled: boolean) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Clear any existing timeout if feature is disabled
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      return;
    }

    const handleLogout = () => {
      logout();
      navigate('/login');
    };

    const resetTimer = () => {
      // Clear existing timeout
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      // Set new timeout
      timeoutIdRef.current = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);
    };

    // Initialize timer
    resetTimer();

    // Add event listeners for user activity
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, resetTimer, true);
    });

    // Cleanup
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, resetTimer, true);
      });
    };
  }, [enabled, logout, navigate]);
}
