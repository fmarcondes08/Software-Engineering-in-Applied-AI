'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { AppointmentCard } from './AppointmentCard';
import type { ChatDonePayload } from '@/lib/api';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  meta?: ChatDonePayload;
};

type ChatWindowProps = {
  messages: Message[];
};

export function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="text-4xl mb-3">🏥</div>
        <h2 className="text-lg font-semibold text-slate-700">How can I help you today?</h2>
        <p className="text-sm text-slate-400 mt-1 max-w-sm">
          Ask about symptoms, upload a lab result, or book an appointment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-sm'
                : msg.meta?.isEmergency
                  ? 'bg-red-50 border border-red-200 text-slate-800 rounded-bl-sm'
                  : msg.meta?.blocked
                    ? 'bg-amber-50 border border-amber-200 text-slate-800 rounded-bl-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
              }`}
          >
            {msg.role === 'assistant' ? (
              <>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                {msg.meta?.appointmentConfirmed && (
                  <AppointmentCard
                    action={msg.meta.appointmentDoctor ? 'schedule' : 'cancel'}
                    doctor={msg.meta.appointmentDoctor}
                    date={msg.meta.appointmentDate}
                    reason={msg.meta.appointmentReason}
                    confirmed={msg.meta.appointmentConfirmed}
                  />
                )}
                {msg.meta?.documentStored && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                    <span>✓</span> Document stored in your records
                  </div>
                )}
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-4 bg-slate-400 animate-pulse ml-0.5 rounded-sm" />
                )}
              </>
            ) : (
              <span>{msg.content}</span>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
