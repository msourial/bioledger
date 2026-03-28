import { useState, useEffect, useRef } from 'react';

/**
 * Tracks Input Actions Per Minute (APM) — counts mouse clicks and keydown events
 * over a rolling 60-second window. Resets to 0 when session is not active.
 *
 * Note: "APM" here means discrete input actions (click + keydown), not pointer
 * movement velocity. Suitable as a focus/engagement proxy metric.
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
