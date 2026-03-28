import { useRef, useState, useEffect, useCallback } from 'react';

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  faceDetected: boolean;
  error: string | null;
}

/**
 * useCamera — requests camera access via getUserMedia and provides a video ref
 * for display. Runs analyzeFocus() every 500ms to detect blink events by
 * comparing consecutive frame pixel diffs. faceDetected is true while the
 * stream is live (AI model integration point for future face detection).
 */
export function useCamera(enabled: boolean): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastFrameRef = useRef<Uint8ClampedArray | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
    setFaceDetected(false);
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
      setIsActive(true);
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

  /**
   * analyzeFocus — compares sampled pixels between consecutive frames.
   * A large average diff indicates rapid luminance change (blink placeholder).
   * Logs a 'Blink Event' to console when detected.
   */
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
      if (avgDiff > 12) {
        console.log('[Bio-Ledger] Blink Event', { avgDiff: avgDiff.toFixed(2), ts: Date.now() });
      }
    }

    lastFrameRef.current = new Uint8ClampedArray(frame);
    // Placeholder: face is "detected" whenever stream is live
    setFaceDetected(true);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(analyzeFocus, 500);
    return () => clearInterval(id);
  }, [isActive, analyzeFocus]);

  return { videoRef, canvasRef, isActive, faceDetected, error };
}
