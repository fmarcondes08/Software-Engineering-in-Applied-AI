'use client';

import { Prediction } from '@/lib/classifier';
import { useState } from 'react';

interface ResultCardProps {
  predictions: Prediction[];
  inputImageUrl: string;
}

export default function ResultCard({ predictions, inputImageUrl }: ResultCardProps) {
  const top = predictions[0];
  const [signImgError, setSignImgError] = useState(false);
  const referenceUrl = `/signs/${top.label}.jpg`;

  return (
    <div className="w-full max-w-2xl bg-zinc-800 rounded-2xl p-6 border border-zinc-700 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-4 text-center">
        Prediction Result
      </h2>

      {/* Top images row */}
      <div className="flex gap-6 justify-center mb-6 flex-wrap">
        {/* Input image */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">Input</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={inputImageUrl}
            alt="Input"
            className="w-36 h-36 object-cover rounded-xl border border-zinc-600"
          />
        </div>

        {/* Arrow */}
        <div className="flex items-center text-2xl text-zinc-500 self-center">→</div>

        {/* Reference sign */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">Reference Sign</span>
          {signImgError ? (
            <div className="w-36 h-36 rounded-xl border border-zinc-600 bg-zinc-700 flex items-center justify-center">
              <span className="text-5xl font-bold text-white">{top.label}</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={referenceUrl}
              alt={`Sign for ${top.label}`}
              onError={() => setSignImgError(true)}
              className="w-36 h-36 object-cover rounded-xl border border-zinc-600"
            />
          )}
        </div>
      </div>

      {/* Top prediction badge */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <span className="text-3xl font-extrabold text-indigo-400">{top.label}</span>
        <span className="text-lg text-zinc-300">{(top.confidence * 100).toFixed(1)}%</span>
      </div>

      {/* All predictions bar chart */}
      <div className="flex flex-col gap-2">
        {predictions.map((p) => (
          <div key={p.label} className="flex items-center gap-3">
            <span className="w-14 text-right text-sm font-medium text-zinc-300 shrink-0">
              {p.label}
            </span>
            <div className="flex-1 bg-zinc-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${(p.confidence * 100).toFixed(1)}%` }}
              />
            </div>
            <span className="w-12 text-left text-xs text-zinc-400 shrink-0">
              {(p.confidence * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
