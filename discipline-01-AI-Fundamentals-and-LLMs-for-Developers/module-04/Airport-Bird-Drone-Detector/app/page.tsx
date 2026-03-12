'use client';

import { useTFModel } from '@/hooks/useTFModel';
import VideoDetector from '@/components/VideoDetector';

const MODEL_URL = '/model/model.json';
const VIDEO_URL = '/video/airport_birds_drones_sample.mp4';

export default function Home() {
  const { model, isLoading, error: modelError } = useTFModel(MODEL_URL);

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center px-4 py-10">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          Airport Bird &amp; Drone Detector
        </h1>
        <p className="text-zinc-400 text-sm max-w-lg">
          A MobileNetV2 TensorFlow.js classifier runs on every video frame,
          overlaying a <span className="text-emerald-400 font-semibold">green circle ⊙</span> for
          birds and a <span className="text-red-400 font-semibold">red X ✕</span> for drones
          detected in airport surveillance footage.
        </p>
      </header>

      {/* Model loading spinner */}
      {isLoading && (
        <div className="mb-8 flex items-center gap-2 text-zinc-400">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          Loading TensorFlow.js model…
        </div>
      )}

      {/* Model error */}
      {modelError && (
        <div className="mb-8 bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm max-w-lg text-center">
          <strong>Model error:</strong> {modelError}
          <br />
          <span className="text-xs text-red-400 mt-1 block">
            Export the model from Colab and place{' '}
            <code className="font-mono">model.json</code> + weight shards
            inside <code className="font-mono">public/model/</code>.
          </span>
        </div>
      )}

      {/* Main detector — renders immediately so video is visible while model loads */}
      <VideoDetector
        model={model}
        videoUrl={VIDEO_URL}
        isModelLoading={isLoading}
      />

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-zinc-600">
        Postgraduate in Software Engineering in Applied AI — Module 04
        <br />
        Dataset:{' '}
        <a
          href="https://www.kaggle.com/datasets/stealthknight/bird-vs-drone"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 hover:text-zinc-300 underline transition-colors"
        >
          Kaggle Bird vs Drone
        </a>
      </footer>
    </main>
  );
}
