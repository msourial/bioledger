import { useRef, useState, useEffect, useCallback } from 'react';

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  faceDetected: boolean;
  secondsUntilLock: number;
  /** Current frame-diff activity level, 0–100. Reflects live pixel motion. */
  frameDiff: number;
  error: string | null;
}

const PRESENCE_TIMEOUT_MS = 30_000;
const MOTION_THRESHOLD = 8;
/** avgDiff rarely exceeds 35 in practice; clamp to 30 for the 0-100 scale */
const DIFF_SCALE = 30;

/**
 * useCamera — getUserMedia camera hook with 30-second sovereign presence detection.
 * Pixel-diff frame analysis: if no significant motion for 30 s, faceDetected = false.
 * Exposes frameDiff (0-100) so the UI can render a live activity bar.
 */
export function useCamera(enabled: boolean): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastFrameRef = useRef<Uint8ClampedArray | null>(null);
  const lastPresenceRef = useRef<number>(Date.now());

  const [isActive, setIsActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [secondsUntilLock, setSecondsUntilLock] = useState(30);
  const [frameDiff, setFrameDiff] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
    setFaceDetected(false);
    setSecondsUntilLock(30);
    setFrameDiff(0);
    lastFrameRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      lastPresenceRef.current = Date.now();
      setIsActive(true);
      setFaceDetected(true);
      setSecondsUntilLock(30);
      setFrameDiff(0);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera unavailable';
      setError(msg);
      setIsActive(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [enabled, startCamera, stopCamera]);

  /** Compare consecutive frames; update lastPresenceRef and frameDiff on motion. */
  const analyzeFocus = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    const w = video.videoWidth || 160;
    const h = video.videoHeight || 120;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h).data;

    if (lastFrameRef.current && lastFrameRef.current.length === frame.length) {
      let diff = 0;
      const step = 20;
      const count = Math.floor(frame.length / step);
      for (let i = 0; i < frame.length; i += step) {
        diff += Math.abs(frame[i] - lastFrameRef.current[i]);
      }
      const avgDiff = diff / count;

      // Normalize to 0–100 for the activity bar
      const normalized = Math.min(100, Math.round((avgDiff / DIFF_SCALE) * 100));
      setFrameDiff(normalized);

      if (avgDiff > MOTION_THRESHOLD) {
        lastPresenceRef.current = Date.now();
        if (avgDiff > 12) {
          console.log('[Bio-Ledger] Blink Event', { avgDiff: avgDiff.toFixed(2), ts: Date.now() });
        }
      }
    }

    lastFrameRef.current = new Uint8ClampedArray(frame);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(analyzeFocus, 500);
    return () => clearInterval(id);
  }, [isActive, analyzeFocus]);

  /** Presence watchdog: check every second if the 30 s window has elapsed. */
  useEffect(() => {
    if (!isActive) return;

    const watchdog = setInterval(() => {
      const elapsed = Date.now() - lastPresenceRef.current;
      const remaining = Math.max(0, Math.ceil((PRESENCE_TIMEOUT_MS - elapsed) / 1000));
      const detected = elapsed < PRESENCE_TIMEOUT_MS;
      setFaceDetected(detected);
      setSecondsUntilLock(remaining);
    }, 1000);

    return () => clearInterval(watchdog);
  }, [isActive]);

  return { videoRef, canvasRef, isActive, faceDetected, secondsUntilLock, frameDiff, error };
}
