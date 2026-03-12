'use client';

import type { Detection } from '@/lib/detector';

interface StatsPanelProps {
  detections: Detection[];
  frameCount: number;
  fps: number;
  isRunning: boolean;
}

export default function StatsPanel({
  detections,
  frameCount,
  fps,
  isRunning,
}: StatsPanelProps) {
  const top = detections[0] ?? null;

  return (
    <div className="w-full bg-zinc-900 rounded-2xl p-5 border border-zinc-800 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Detection Stats
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
            isRunning
              ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
              : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
            }`}
          />
          {isRunning ? 'Running' : 'Paused'}
        </span>
      </div>

      {/* Top prediction badge */}
      {top && (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
            top.label === 'bird'
              ? 'bg-emerald-950/40 border-emerald-800'
              : 'bg-red-950/40 border-red-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {top.label === 'bird' ? '⊙' : '✕'}
            </span>
            <span
              className={`text-xl font-extrabold ${
                top.label === 'bird' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {top.label.toUpperCase()}
            </span>
          </div>
          <span className="text-lg font-semibold text-zinc-300">
            {(top.confidence * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {/* Confidence bars for all classes */}
      <div className="flex flex-col gap-3">
        {detections.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-12 text-right text-sm font-medium text-zinc-300 shrink-0">
              {d.label}
            </span>
            <div className="flex-1 bg-zinc-700 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  d.label === 'bird' ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${(d.confidence * 100).toFixed(1)}%` }}
              />
            </div>
            <span className="w-12 text-left text-xs text-zinc-400 shrink-0">
              {(d.confidence * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Metadata row */}
      <div className="flex gap-4 text-xs text-zinc-500 border-t border-zinc-800 pt-3">
        <span>Frame {frameCount.toLocaleString()}</span>
        <span>{fps} FPS (inference)</span>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Legend</p>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="w-4 h-4 rounded-full border-2 border-emerald-500 flex-shrink-0" />
          Bird detected
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="font-bold text-red-500 text-base leading-none flex-shrink-0">✕</span>
          Drone detected
        </div>
      </div>
    </div>
  );
}
