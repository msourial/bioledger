import { useState, useEffect, useRef } from 'react';

/**
 * Tracks Actions Per Minute (APM) based on mouse clicks and keypresses
 * over a rolling 60-second window.
 */
export function useAPM(isActive: boolean) {
  const [apm, setApm] = useState(0);
  const actionsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isActive) {
      setApm(0);
      actionsRef.current = [];
      return;
    }

    const recordAction = () => {
      actionsRef.current.push(Date.now());
    };

    window.addEventListener('click', recordAction);
    window.addEventListener('keydown', recordAction);

    const interval = setInterval(() => {
      const now = Date.now();
      // Keep only actions from the last 60 seconds
      actionsRef.current = actionsRef.current.filter(time => now - time < 60000);
      setApm(actionsRef.current.length);
    }, 1000);

    return () => {
      window.removeEventListener('click', recordAction);
      window.removeEventListener('keydown', recordAction);
      clearInterval(interval);
    };
  }, [isActive]);

  return apm;
}
