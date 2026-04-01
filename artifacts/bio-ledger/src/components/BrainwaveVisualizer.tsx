import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface BrainwaveVisualizerProps {
  hrv: number;
  blinkRate: number;
  headStability: number;
  isActive: boolean;
  className?: string;
  compact?: boolean;
}

/* ── wave band definitions ── */
interface WaveBand {
  label: string;
  shortLabel: string;
  color: string;
  /** visual cycles per canvas-width */
  baseFreq: number;
  /** map a 0-1 normalised input to amplitude (fraction of lane height) */
  amplitude: (norm: number) => number;
}

const BANDS: WaveBand[] = [
  {
    label: 'α Calm',
    shortLabel: 'α',
    color: '#8b5cf6',
    baseFreq: 3, // ~10 Hz visual feel at typical scroll speed
    amplitude: (n) => 0.15 + n * 0.7, // higher HRV → bigger wave
  },
  {
    label: 'β Focus',
    shortLabel: 'β',
    color: '#3b82f6',
    baseFreq: 6, // faster oscillation
    amplitude: (n) => 0.15 + n * 0.7,
  },
  {
    label: 'θ Flow',
    shortLabel: 'θ',
    color: '#10b981',
    baseFreq: 1.5, // slow rolling wave
    amplitude: (n) => 0.15 + n * 0.7,
  },
];

/* ── helpers ── */
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Normalise each biometric into 0-1 for the corresponding band */
function normInputs(hrv: number, blinkRate: number, headStability: number) {
  return [
    clamp01((hrv - 40) / 60),              // alpha ← HRV  (40-100 → 0-1)
    clamp01(1 - blinkRate / 30),            // beta  ← inverse blink rate
    clamp01(headStability / 100),           // theta ← head stability
  ];
}

/* ── component ── */
export default function BrainwaveVisualizer({
  hrv,
  blinkRate,
  headStability,
  isActive,
  className,
  compact = false,
}: BrainwaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  /** smoothed normalised values – lerped each frame to avoid jumps */
  const smoothRef = useRef<number[]>([0, 0, 0]);
  /** monotonic time offset for scroll */
  const tRef = useRef(0);
  const prevTimeRef = useRef<number | null>(null);

  const height = compact ? 80 : 160;

  /* ── draw loop ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const dt = prevTimeRef.current === null ? 16 : now - prevTimeRef.current;
    prevTimeRef.current = now;

    // advance scroll time
    tRef.current += dt * 0.001; // seconds

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // clear
    ctx.clearRect(0, 0, w, h);

    // ── subtle grid ──
    ctx.strokeStyle = 'rgba(139,92,246,0.06)';
    ctx.lineWidth = 0.5;
    const gridSpacing = compact ? 16 : 24;
    for (let y = gridSpacing; y < h; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let x = gridSpacing; x < w; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // ── scan line ──
    const scanX = ((tRef.current * 40) % w);
    const scanGrad = ctx.createLinearGradient(scanX - 30, 0, scanX + 2, 0);
    scanGrad.addColorStop(0, 'rgba(139,92,246,0)');
    scanGrad.addColorStop(1, 'rgba(139,92,246,0.08)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(scanX - 30, 0, 32, h);

    // ── target normalised values ──
    const targets = isActive ? normInputs(hrv, blinkRate, headStability) : [0, 0, 0];

    // lerp smoothed values
    const lerpFactor = 1 - Math.pow(0.04, dt * 0.001); // ~exponential ease
    for (let i = 0; i < 3; i++) {
      smoothRef.current[i] += (targets[i] - smoothRef.current[i]) * lerpFactor;
    }

    const laneH = h / 3;
    const t = tRef.current;
    const step = 2; // pixel step for perf

    // ── draw each band ──
    BANDS.forEach((band, bi) => {
      const norm = smoothRef.current[bi];
      const amp = band.amplitude(norm) * laneH * 0.4;
      const freq = band.baseFreq;
      const centerY = laneH * (bi + 0.5);

      // glow layer
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = band.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = band.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let x = 0; x <= w; x += step) {
        const phase = (x / w) * freq * Math.PI * 2 - t * freq * 1.2;
        // slight harmonic + noise for realism
        const noise = Math.sin(phase * 3.17 + t * 2.3) * 0.12 +
                      Math.sin(phase * 0.7 - t * 1.1) * 0.08;
        const y = centerY + Math.sin(phase) * amp + noise * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // main line
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = band.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += step) {
        const phase = (x / w) * freq * Math.PI * 2 - t * freq * 1.2;
        const noise = Math.sin(phase * 3.17 + t * 2.3) * 0.12 +
                      Math.sin(phase * 0.7 - t * 1.1) * 0.08;
        const y = centerY + Math.sin(phase) * amp + noise * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    });

    // ── labels (non-compact) ──
    if (!compact) {
      ctx.save();
      ctx.font = '10px monospace';
      BANDS.forEach((band, bi) => {
        const centerY = laneH * (bi + 0.5);
        ctx.fillStyle = band.color;
        ctx.globalAlpha = 0.7;
        ctx.fillText(band.label, 6, centerY - laneH * 0.28);
      });
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [hrv, blinkRate, headStability, isActive, compact, height]);

  useEffect(() => {
    prevTimeRef.current = null;
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <div
      className={cn('relative w-full rounded-lg overflow-hidden', className)}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
