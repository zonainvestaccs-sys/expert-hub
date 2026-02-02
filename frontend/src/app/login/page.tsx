// src/app/login/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, fetchMe, clearToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('admin@experthub.local');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const envLabel = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE;
    if (!base || base === 'undefined' || base === 'null') return 'http://localhost:3000';
    return base;
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      const token = await login(email.trim(), password);

      // opcional: já valida role e direciona
      const me = await fetchMe(token);

      if (me.role === 'ADMIN') {
        router.replace('/admin');
      } else {
        // se vc ainda não criou área do expert, manda pro admin mesmo ou pro dashboard
        router.replace('/admin');
      }
    } catch (e: any) {
      clearToken();
      setErr('Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-adminbg flex items-center justify-center px-6">
      <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-white/[0.04] shadow-soft overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="text-xl font-semibold">ExpertHub</div>
          <div className="text-sm text-white/60">Login</div>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-2">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-white/20"
              placeholder="admin@experthub.local"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-white/20"
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
            />
          </div>

          {err ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {err}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-white/10 bg-white text-black py-3 font-medium hover:bg-white/90 transition disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <div className="pt-2 text-xs text-white/50">
            Ambiente: <span className="text-white/70">{envLabel}</span>
          </div>
        </form>
      </div>
    </div>
  );
}
