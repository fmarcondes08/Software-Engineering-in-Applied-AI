'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/lib/api';

const ROLES: { value: UserRole; label: string; description: string; color: string }[] = [
  {
    value: 'patient',
    label: 'Patient',
    description: 'Book appointments, upload records, check symptoms',
    color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  },
  {
    value: 'doctor',
    label: 'Doctor',
    description: 'Full medical context, detailed clinical information',
    color: 'bg-green-50 border-green-200 hover:border-green-400',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'System access, security toggles, all permissions',
    color: 'bg-purple-50 border-purple-200 hover:border-purple-400',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [error, setError] = useState('');

  const handleStart = () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    const userId = `${role}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    localStorage.setItem('hm_user', JSON.stringify({ id: userId, name: name.trim(), role }));
    router.push('/chat');
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4">
            <span className="text-white text-3xl">+</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">HealthMind AI</h1>
          <p className="text-slate-500 mt-1">Your intelligent healthcare navigator</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              placeholder="e.g. Jane Smith"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          {/* Role selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Role</label>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${r.color} ${
                    role === r.value ? 'ring-2 ring-brand-500' : ''
                  }`}
                >
                  <div className="font-medium text-slate-900">{r.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{r.description}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            Start Session
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          HealthMind AI is not a substitute for professional medical advice.
        </p>
      </div>
    </main>
  );
}
