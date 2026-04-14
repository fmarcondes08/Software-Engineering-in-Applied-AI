'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatWindow, type Message } from '@/components/ChatWindow';
import { MessageInput } from '@/components/MessageInput';
import { RoleBadge } from '@/components/RoleBadge';
import { streamChat, type UserRole, type ChatDonePayload } from '@/lib/api';

type User = { id: string; name: string; role: UserRole };

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(true);
  // Each threadId maps to an independent LangGraph checkpoint in SQLite.
  // Persisted in sessionStorage so page reloads within the same tab keep the same thread,
  // while opening a new tab always starts fresh.
  const [threadId, setThreadId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default';
    return sessionStorage.getItem('hm_thread_id') ?? 'default';
  });
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('hm_user');
    if (!stored) { router.push('/'); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  /** Start a fresh conversation: new threadId = new SQLite checkpoint = blank memory */
  const handleNewChat = () => {
    if (loading) return;
    const newId = crypto.randomUUID();
    sessionStorage.setItem('hm_thread_id', newId);
    setMessages([]);
    setThreadId(newId);
  };

  const handleSend = async (message: string, file?: File) => {
    if (!user || loading) return;

    const userMsgId = crypto.randomUUID();
    const asstMsgId = crypto.randomUUID();
    streamingIdRef.current = asstMsgId;

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: file ? `${message} [${file.name}]` : message },
      { id: asstMsgId, role: 'assistant', content: '', streaming: true },
    ]);

    setLoading(true);

    await streamChat(
      { message, userId: user.id, userName: user.name, role: user.role, guardrailsEnabled, threadId, file },
      {
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId ? { ...m, content: m.content + token } : m,
            ),
          );
        },
        onDone: (payload: ChatDonePayload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? { ...m, content: payload.answer, streaming: false, meta: payload }
                : m,
            ),
          );
          setLoading(false);
        },
        onError: (errMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? { ...m, content: `Error: ${errMsg}`, streaming: false }
                : m,
            ),
          );
          setLoading(false);
        },
      },
    );
  };

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            +
          </div>
          <div>
            <span className="font-semibold text-slate-900 text-sm">HealthMind AI</span>
            <span className="text-slate-400 text-xs ml-2">{user.name}</span>
          </div>
          <RoleBadge role={user.role} />
        </div>

        <div className="flex items-center gap-3">
          {/* Guardrails toggle — visible to admin for demo */}
          {user.role === 'admin' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Guardrails</span>
              <button
                onClick={() => setGuardrailsEnabled((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  guardrailsEnabled ? 'bg-green-500' : 'bg-red-400'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    guardrailsEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className={guardrailsEnabled ? 'text-green-600' : 'text-red-500'}>
                {guardrailsEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
          )}

          {/* New Chat — clears messages and starts a fresh LangGraph thread */}
          <button
            onClick={handleNewChat}
            disabled={loading}
            title="Start a new conversation (clears memory)"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 border border-slate-200 hover:border-brand-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            Dashboard
          </button>

          <button
            onClick={() => { localStorage.removeItem('hm_user'); router.push('/'); }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Chat area */}
      <ChatWindow messages={messages} />

      {/* Input */}
      <MessageInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
