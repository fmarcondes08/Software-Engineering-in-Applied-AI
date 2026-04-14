'use client';

import { useRef, useState } from 'react';

type MessageInputProps = {
  onSend: (message: string, file?: File) => void;
  disabled?: boolean;
};

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !file) return;
    onSend(trimmed, file ?? undefined);
    setText('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      {file && (
        <div className="flex items-center gap-2 mb-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-1.5">
          <span className="text-sm">📄</span>
          <span className="text-xs text-brand-700 font-medium flex-1 truncate">{file.name}</span>
          <button
            onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            className="text-slate-400 hover:text-slate-600 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* PDF attach */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 text-slate-400 hover:text-brand-600 transition-colors disabled:opacity-50"
          title="Attach PDF"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about symptoms, book an appointment..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 max-h-32 overflow-y-auto"
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !file)}
          className="p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
