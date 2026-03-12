'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type * as tf from '@tensorflow/tfjs';
import type { Detection } from '@/lib/detector';
import { drawDetection, clearOverlay } from '@/components/DetectionOverlay';
import StatsPanel from '@/components/StatsPanel';

interface VideoDetectorProps {
  model: tf.GraphModel | null;
  videoUrl: string;
  isModelLoading: boolean;
}

export default function VideoDetector({
  model,
  videoUrl,
  isModelLoading,
}: VideoDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // Prevents overlapping async inference calls inside the RAF loop
  const inferringRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);

  const fpsTimestampRef = useRef<number>(performance.now());
  const fpsFrameCountRef = useRef(0);

  /**
   * Sync overlay canvas logical pixel dimensions to the video's intrinsic
   * resolution (videoWidth/videoHeight), NOT the CSS display size.
   * This ensures drawing coordinates align with the displayed image.
   */
  function syncCanvasSize() {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || video.offsetWidth;
    const h = video.videoHeight || video.offsetHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  /**
   * Core inference + draw loop.
   *
   * Patterns from existing codebase:
   * - inferringRef guard: same as `classifyingRef` in module-02/Webcam.tsx
   * - Dynamic import of TF.js: avoids SSR breakage (module-02/hooks pattern)
   * - tf.tidy() inside detectAllClasses: matches DuckHunt's worker.js preprocessImage
   */
  const inferenceLoop = useCallback(async () => {
    const video = videoRef.current;
    const canvas = overlayRef.current;

    if (!video || !canvas || !model || video.paused || video.ended) {
      rafRef.current = requestAnimationFrame(inferenceLoop);
      return;
    }

    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(inferenceLoop);
      return;
    }

    if (!inferringRef.current) {
      inferringRef.current = true;

      try {
        const tfLib = await import('@tensorflow/tfjs');
        const { detectAllClasses } = await import('@/lib/detector');

        const allDetections = await detectAllClasses(model, video, tfLib);

        const ctx = canvas.getContext('2d');
        if (ctx && allDetections.length > 0) {
          syncCanvasSize();
          drawDetection(ctx, allDetections[0], canvas.width, canvas.height);
        }

        setDetections(allDetections);
        setFrameCount((c) => c + 1);

        // Compute inference FPS (not render FPS)
        fpsFrameCountRef.current += 1;
        const now = performance.now();
        const elapsed = now - fpsTimestampRef.current;
        if (elapsed >= 1000) {
          setFps(Math.round((fpsFrameCountRef.current * 1000) / elapsed));
          fpsFrameCountRef.current = 0;
          fpsTimestampRef.current = now;
        }
      } catch {
        // Swallow per-frame errors silently
      } finally {
        inferringRef.current = false;
      }
    }

    rafRef.current = requestAnimationFrame(inferenceLoop);
  }, [model]);

  // Start/stop the RAF loop when model availability changes
  useEffect(() => {
    if (model) {
      rafRef.current = requestAnimationFrame(inferenceLoop);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [model, inferenceLoop]);

  // Clear overlay when video is paused
  useEffect(() => {
    if (!isPlaying) {
      const canvas = overlayRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) clearOverlay(ctx, canvas.width, canvas.height);
    }
  }, [isPlaying]);

  function handlePlay() {
    videoRef.current?.play();
    setIsPlaying(true);
  }

  function handlePause() {
    videoRef.current?.pause();
    setIsPlaying(false);
  }

  function handleRestart() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play();
    setIsPlaying(true);
    setFrameCount(0);
    fpsFrameCountRef.current = 0;
    fpsTimestampRef.current = performance.now();
  }

  return (
    <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-6">
      {/* Left: Video + Canvas Overlay */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          {/* Video container with absolutely-positioned overlay canvas */}
          <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              src={videoUrl}
              loop
              muted
              playsInline
              onLoadedMetadata={syncCanvasSize}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain bg-black"
            />

            {/* Canvas sits exactly on top of the video; pointer-events-none
                lets mouse events (play/pause via click) pass through to video */}
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Model loading overlay */}
            {isModelLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="flex items-center gap-2 text-zinc-300 text-sm">
                  <span className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                  Loading TensorFlow.js model…
                </div>
              </div>
            )}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-zinc-800">
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                disabled={isModelLoading}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                Play
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="px-5 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold transition-colors"
              >
                Pause
              </button>
            )}

            <button
              onClick={handleRestart}
              disabled={isModelLoading}
              className="px-5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-300 text-sm font-semibold transition-colors"
            >
              Restart
            </button>

            <span className="ml-auto text-xs text-zinc-500">
              {model
                ? 'Model ready'
                : isModelLoading
                ? 'Loading model…'
                : 'No model loaded'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Stats panel */}
      <div className="w-full lg:w-72 shrink-0">
        <StatsPanel
          detections={detections}
          frameCount={frameCount}
          fps={fps}
          isRunning={isPlaying && model !== null}
        />
      </div>
    </div>
  );
}
