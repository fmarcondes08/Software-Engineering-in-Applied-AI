'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Prediction } from '@/lib/classifier';

interface WebcamProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  onResult: (predictions: Prediction[], imageUrl: string) => void;
}

export default function Webcam({ model, onResult }: WebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const classifyingRef = useRef(false);

  const [isActive, setIsActive] = useState(false);
  const [livePredictions, setLivePredictions] = useState<Prediction[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Continuous inference loop
  const inferenceLoop = useCallback(async () => {
    if (!model || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA && !classifyingRef.current) {
      classifyingRef.current = true;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);

      try {
        const { classify: runClassify } = await import('@/lib/classifier');
        const results = await runClassify(model, canvas);
        setLivePredictions(results);
      } catch {
        // swallow per-frame errors silently
      } finally {
        classifyingRef.current = false;
      }
    }

    rafRef.current = requestAnimationFrame(inferenceLoop);
  }, [model]);

  // Start / stop the loop when isActive changes
  useEffect(() => {
    if (isActive) {
      rafRef.current = requestAnimationFrame(inferenceLoop);
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setLivePredictions([]);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, inferenceLoop]);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 400 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
    } catch {
      setError('Camera access denied or not available.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsActive(false);
  }

  // Clean up on unmount
  useEffect(() => () => { stopCamera(); }, []);

  function snapshot() {
    if (!canvasRef.current || livePredictions.length === 0) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onResult(livePredictions, dataUrl);
  }

  const top = livePredictions[0];

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {!isActive ? (
        <button
          onClick={startCamera}
          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
        >
          📷 Start Camera
        </button>
      ) : (
        <button
          onClick={stopCamera}
          className="px-6 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold transition-colors"
        >
          Stop Camera
        </button>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className={`${isActive ? 'flex' : 'hidden'} flex-col items-center gap-4 w-full max-w-md`}>
        {/* Live label overlay */}
        {top && (
          <div className="w-full flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2">
            <span className="text-sm text-zinc-400">Live prediction</span>
            <span className="text-xl font-bold text-indigo-400">
              {top.label}
              <span className="ml-2 text-sm font-normal text-zinc-400">
                {(top.confidence * 100).toFixed(1)}%
              </span>
            </span>
          </div>
        )}

        <video
          ref={videoRef}
          muted
          playsInline
          className="rounded-xl w-full border border-zinc-700 bg-zinc-900"
        />
        <canvas ref={canvasRef} className="hidden" />

        <button
          onClick={snapshot}
          disabled={livePredictions.length === 0}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
        >
          📸 Use This Frame
        </button>
      </div>
    </div>
  );
}
