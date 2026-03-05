'use client';

import { useState } from 'react';
import { useTeachableModel } from '@/hooks/useTeachableModel';
import { Prediction } from '@/lib/classifier';
import ImageUpload from '@/components/ImageUpload';
import RandomImage from '@/components/RandomImage';
import WebcamCapture from '@/components/Webcam';
import ResultCard from '@/components/ResultCard';

const MODEL_URL = '/model/model.json';
const METADATA_URL = '/model/metadata.json';

type Mode = 'upload' | 'random' | 'webcam';

const TABS: { id: Mode; label: string; icon: string }[] = [
  { id: 'upload', label: 'Upload', icon: '📂' },
  { id: 'random', label: 'Random', icon: '🎲' },
  { id: 'webcam', label: 'Webcam', icon: '📷' },
];

export default function Home() {
  const { model, isLoading, error: modelError } = useTeachableModel(MODEL_URL, METADATA_URL);
  const [mode, setMode] = useState<Mode>('upload');
  const [result, setResult] = useState<{ predictions: Prediction[]; imageUrl: string } | null>(null);

  function handleResult(predictions: Prediction[], imageUrl: string) {
    setResult({ predictions, imageUrl });
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center px-4 py-10">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          ✋ Sign Language Classifier
        </h1>
        <p className="text-zinc-400 text-sm max-w-md">
          Upload an image, pick a random sample, or use your webcam to classify
          American Sign Language (ASL) hand signs using a Teachable Machine model.
        </p>
      </header>

      {/* Model status */}
      {isLoading && (
        <div className="mb-8 flex items-center gap-2 text-zinc-400">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          Loading model…
        </div>
      )}
      {modelError && (
        <div className="mb-8 bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm max-w-md text-center">
          <strong>Model error:</strong> {modelError}
          <br />
          <span className="text-xs text-red-400">
            Make sure model.json, metadata.json, and weights.bin are placed inside{' '}
            <code className="font-mono">public/model/</code>.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-zinc-800 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setMode(tab.id); setResult(null); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-colors
              ${mode === tab.id
                ? 'bg-indigo-600 text-white shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Input panel */}
      <div className="w-full max-w-lg bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-8">
        {!model && !isLoading && !modelError ? (
          <p className="text-zinc-500 text-sm text-center">Waiting for model…</p>
        ) : model ? (
          <>
            {mode === 'upload' && (
              <ImageUpload model={model} onResult={handleResult} />
            )}
            {mode === 'random' && (
              <RandomImage model={model} onResult={handleResult} />
            )}
            {mode === 'webcam' && (
              <WebcamCapture model={model} onResult={handleResult} />
            )}
          </>
        ) : null}
      </div>

      {/* Result */}
      {result && (
        <ResultCard predictions={result.predictions} inputImageUrl={result.imageUrl} />
      )}
    </main>
  );
}
