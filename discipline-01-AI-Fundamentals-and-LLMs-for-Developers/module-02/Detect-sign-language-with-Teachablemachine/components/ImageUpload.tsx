'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { Prediction } from '@/lib/classifier';

interface ImageUploadProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  onResult: (predictions: Prediction[], imageUrl: string) => void;
}

export default function ImageUpload({ model, onResult }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function loadFile(file: File) {
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

  async function classify() {
    if (!model || !imgRef.current) return;
    setIsClassifying(true);
    try {
      const { classify: runClassify } = await import('@/lib/classifier');
      const results = await runClassify(model, imgRef.current);
      onResult(results, preview!);
    } finally {
      setIsClassifying(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-md h-56 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-colors
          ${isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-zinc-600 bg-zinc-800 hover:border-indigo-500 hover:bg-zinc-700'}`}
      >
        <span className="text-4xl mb-2">📂</span>
        <p className="text-zinc-400 text-sm">Drag & drop an image, or click to select</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {preview && (
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={preview}
            alt="Preview"
            crossOrigin="anonymous"
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
