'use client';

import { useRef, useState } from 'react';

type DocumentUploadProps = {
  onFile: (file: File) => void;
  disabled?: boolean;
};

export function DocumentUpload({ onFile, disabled }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Only PDF files are supported');
      return;
    }
    onFile(file);
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
        ${dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white hover:border-brand-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        disabled={disabled}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div className="text-2xl mb-2">📄</div>
      <p className="text-sm font-medium text-slate-700">Drop a PDF here or click to browse</p>
      <p className="text-xs text-slate-400 mt-1">Lab reports, prescriptions, discharge summaries</p>
    </div>
  );
}
