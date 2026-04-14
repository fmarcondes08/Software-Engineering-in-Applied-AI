'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchHistory, streamChat, type UserRole } from '@/lib/api';
import { RoleBadge } from '@/components/RoleBadge';
import { DocumentUpload } from '@/components/DocumentUpload';

type User = { id: string; name: string; role: UserRole };

type Document = {
  filename: string;
  content: string;
  uploadedAt: string;
};

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('hm_user');
    if (!stored) { router.push('/'); return; }
    const u: User = JSON.parse(stored);
    setUser(u);

    fetchHistory(u.id).then((data) => {
      setDocuments(data.documents ?? []);
      setLoading(false);
    });
  }, [router]);

  const handleUploadFile = async (file: File) => {
    if (!user) return;

    setUploadState('uploading');
    setUploadMessage(`Uploading "${file.name}"…`);

    try {
      await streamChat(
        {
          message: 'I am uploading a medical document for analysis.',
          userId: user.id,
          userName: user.name,
          role: user.role,
          guardrailsEnabled: true,
          threadId: 'default',
          file,
        },
        {
          onToken: () => {},   // discard streaming tokens — we just want the done event
          onDone: (payload) => {
            if (payload.documentStored) {
              setUploadState('success');
              setUploadMessage(`"${file.name}" uploaded successfully! Redirecting to chat…`);
              // Refresh document list then navigate to chat after a short delay
              fetchHistory(user.id).then((data) => setDocuments(data.documents ?? []));
              setTimeout(() => router.push('/chat'), 1500);
            } else {
              setUploadState('error');
              setUploadMessage('Document was processed but could not be stored. Please try again.');
            }
          },
          onError: (err) => {
            setUploadState('error');
            setUploadMessage(`Upload failed: ${err}`);
          },
        },
      );
    } catch (err) {
      setUploadState('error');
      setUploadMessage(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">+</div>
          <span className="font-semibold text-slate-900">HealthMind AI</span>
          <span className="text-slate-400 text-sm">/ Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <RoleBadge role={user.role} />
          <span className="text-sm text-slate-600">{user.name}</span>
          <button
            onClick={() => router.push('/chat')}
            className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Open Chat
          </button>
          <button
            onClick={() => { localStorage.removeItem('hm_user'); router.push('/'); }}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Health Overview</h1>
          <p className="text-slate-500 mt-1">Your personal health records and uploaded documents</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-2xl font-bold text-brand-600">{documents.length}</div>
            <div className="text-sm text-slate-500 mt-1">Documents Uploaded</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-2xl font-bold text-green-600">
              {user.role === 'patient' ? 'Active' : 'Pro'}
            </div>
            <div className="text-sm text-slate-500 mt-1">Account Status</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-2xl font-bold text-purple-600 capitalize">{user.role}</div>
            <div className="text-sm text-slate-500 mt-1">Access Level</div>
          </div>
        </div>

        {/* Upload new document */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Upload Medical Document</h2>

          {/* Upload status banner */}
          {uploadState !== 'idle' && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
              uploadState === 'uploading' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
              uploadState === 'success'   ? 'bg-green-50 text-green-700 border border-green-200' :
                                           'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {uploadState === 'uploading' && (
                <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {uploadState === 'success' && <span className="flex-shrink-0">✅</span>}
              {uploadState === 'error'   && <span className="flex-shrink-0">❌</span>}
              <span>{uploadMessage}</span>
            </div>
          )}

          <DocumentUpload
            onFile={handleUploadFile}
            disabled={uploadState === 'uploading' || uploadState === 'success'}
          />
          <p className="text-xs text-slate-400 mt-2 text-center">
            PDF is uploaded, analysed and stored — then you can ask questions about it in the chat
          </p>
        </div>

        {/* Document history */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Uploaded Documents</h2>

          {loading && (
            <div className="text-sm text-slate-400 text-center py-6">Loading records…</div>
          )}

          {!loading && documents.length === 0 && (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm text-slate-500">No documents uploaded yet</p>
              <p className="text-xs text-slate-400 mt-1">Upload lab reports and prescriptions to get started</p>
            </div>
          )}

          {!loading && documents.length > 0 && (
            <div className="space-y-3">
              {documents.map((doc, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <div className="text-xl">📄</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{doc.filename}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{doc.content}</div>
                    {doc.uploadedAt && (
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
