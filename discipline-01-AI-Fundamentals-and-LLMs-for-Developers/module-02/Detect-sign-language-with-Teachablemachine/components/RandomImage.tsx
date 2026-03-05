'use client';

import { useRef, useState, useCallback } from 'react';
import { Prediction } from '@/lib/classifier';

interface RandomImageProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  onResult: (predictions: Prediction[], imageUrl: string) => void;
}

export default function RandomImage({ model, onResult }: RandomImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const pickRandom = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    try {
      const res = await fetch('/api/samples');
      const data = await res.json() as { files: string[] };
      if (data.files.length === 0) {
        setError('No sample images found. Add images to public/samples/.');
        return;
      }
      const file = data.files[Math.floor(Math.random() * data.files.length)];
      setImageUrl(`/samples/${file}`);
    } catch {
      setError('Failed to fetch sample list.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function classify() {
    if (!model || !imgRef.current) return;
    setIsClassifying(true);
    try {
      const { classify: runClassify } = await import('@/lib/classifier');
      const results = await runClassify(model, imgRef.current);
      onResult(results, imageUrl!);
    } finally {
      setIsClassifying(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <button
        onClick={pickRandom}
        disabled={isLoading}
        className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
      >
        {isLoading ? 'Loading…' : '🎲 Pick Random Image'}
      </button>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {imageUrl && (
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Random sample"
            crossOrigin="anonymous"
            onLoad={() => setIsLoading(false)}
            className="rounded-xl max-h-64 object-contain border border-zinc-700"
          />
          <button
            onClick={classify}
            disabled={isClassifying}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-semibold transition-colors"
          >
            {isClassifying ? 'Classifying…' : 'Classify'}
          </button>
        </div>
      )}
    </div>
  );
}
