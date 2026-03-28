import { useRef, useState, useEffect, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VisionMetrics {
  blinkCount: number;
  avgBlinkRate: number;
  headStability: number;
  certifiedPresence: boolean;
}

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** 48×36 canvas with pixelated rendering — use this for the display */
  pixelCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  faceDetected: boolean;
  secondsUntilLock: number;
  frameDiff: number;
  blinkCount: number;
  postureWarning: boolean;
  visionMetrics: VisionMetrics;
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESENCE_TIMEOUT_MS = 5_000;
const BLINK_THRESHOLD = 0.5;
const HEAD_TILT_THRESHOLD = 18;
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** Singleton — the model loads once across all hook instances. */
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/** Extract pitch (x-axis) and roll (z-axis) from a 4×4 row-major affine matrix. */
function extractEulerAngles(m: Float32Array | number[]): { pitch: number; roll: number } {
  const pitch = Math.atan2(-m[9], m[10]) * (180 / Math.PI);
  const roll = Math.atan2(m[4], m[0]) * (180 / Math.PI);
  return { pitch, roll };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCamera(enabled: boolean): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastPresenceRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const wasBlinkingRef = useRef(false);
  const blinkCountRef = useRef(0);
  const totalFramesRef = useRef(0);
  const stableFramesRef = useRef(0);

  const [isActive, setIsActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [secondsUntilLock, setSecondsUntilLock] = useState(5);
  const [frameDiff, setFrameDiff] = useState(0);
  const [blinkCount, setBlinkCount] = useState(0);
  const [postureWarning, setPostureWarning] = useState(false);
  const [visionMetrics, setVisionMetrics] = useState<VisionMetrics>({
    blinkCount: 0,
    avgBlinkRate: 0,
    headStability: 100,
    certifiedPresence: false,
  });
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
    setFaceDetected(false);
    setSecondsUntilLock(5);
    setFrameDiff(0);
    setBlinkCount(0);
    setPostureWarning(false);
    blinkCountRef.current = 0;
    totalFramesRef.current = 0;
    stableFramesRef.current = 0;
  }, []);

  const runLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = pixelCanvasRef.current;
    const lm = landmarkerRef.current;

    if (!video || !lm || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }

    const now = performance.now();
    let faceFound = false;

    try {
      const result = lm.detectForVideo(video, now);

      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        faceFound = true;
        lastPresenceRef.current = Date.now();

        // ── Blink detection via blendshapes ──────────────────────────────
        if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
          const shapes = result.faceBlendshapes[0].categories;
          const eyeL = shapes.find((s) => s.categoryName === 'eyeBlinkLeft')?.score ?? 0;
          const eyeR = shapes.find((s) => s.categoryName === 'eyeBlinkRight')?.score ?? 0;
          const isBlink = eyeL > BLINK_THRESHOLD || eyeR > BLINK_THRESHOLD;
          if (isBlink && !wasBlinkingRef.current) {
            blinkCountRef.current += 1;
            setBlinkCount(blinkCountRef.current);
          }
          wasBlinkingRef.current = isBlink;
        }

        // ── Head pose via facial transformation matrix ────────────────────
        if (
          result.facialTransformationMatrixes &&
          result.facialTransformationMatrixes.length > 0
        ) {
          const mat = result.facialTransformationMatrixes[0].data;
          const { pitch, roll } = extractEulerAngles(mat);
          totalFramesRef.current += 1;
          const isStable =
            Math.abs(pitch) < HEAD_TILT_THRESHOLD && Math.abs(roll) < HEAD_TILT_THRESHOLD;
          if (isStable) stableFramesRef.current += 1;
          setPostureWarning(!isStable);
          const activity = Math.min(100, Math.round((Math.abs(pitch) + Math.abs(roll)) * 2));
          setFrameDiff(activity);
        }
      }
    } catch {
      // Silently continue if model hasn't warmed up yet
    }

    setFaceDetected(faceFound);

    // ── Vision metrics snapshot every ~60 frames ──────────────────────────
    if (totalFramesRef.current > 0 && totalFramesRef.current % 60 === 0) {
      const elapsedMin = (Date.now() - sessionStartRef.current) / 60_000;
      const rate = elapsedMin > 0 ? blinkCountRef.current / elapsedMin : 0;
      const stability =
        Math.round((stableFramesRef.current / totalFramesRef.current) * 100);
      setVisionMetrics({
        blinkCount: blinkCountRef.current,
        avgBlinkRate: Math.round(rate * 10) / 10,
        headStability: stability,
        certifiedPresence: faceFound,
      });
    }

    // ── Pixelated canvas: draw at 48×36 with no smoothing ────────────────
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    }

    rafRef.current = requestAnimationFrame(runLoop);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        await video.play().catch(() => {});
      }

      landmarkerRef.current = await getLandmarker();

      lastPresenceRef.current = Date.now();
      sessionStartRef.current = Date.now();
      blinkCountRef.current = 0;
      totalFramesRef.current = 0;
      stableFramesRef.current = 0;
      setBlinkCount(0);
      setIsActive(true);
      setFaceDetected(true);
      setSecondsUntilLock(5);
      setError(null);

      rafRef.current = requestAnimationFrame(runLoop);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera unavailable';
      setError(msg);
      setIsActive(false);
    }
  }, [runLoop]);

  useEffect(() => {
    if (enabled) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => { stopCamera(); };
  }, [enabled, startCamera, stopCamera]);

  /** Presence watchdog: update faceDetected + countdown every second */
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - lastPresenceRef.current;
      const remaining = Math.max(0, Math.ceil((PRESENCE_TIMEOUT_MS - elapsed) / 1000));
      setFaceDetected(elapsed < PRESENCE_TIMEOUT_MS);
      setSecondsUntilLock(remaining);
    }, 1000);
    return () => clearInterval(id);
  }, [isActive]);

  return {
    videoRef,
    pixelCanvasRef,
    isActive,
    faceDetected,
    secondsUntilLock,
    frameDiff,
    blinkCount,
    postureWarning,
    visionMetrics,
    error,
  };
}
