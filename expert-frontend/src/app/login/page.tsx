// expert-frontend/src/app/login/page.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { login, fetchMe, clearToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      const token = await login(email.trim(), password);

      const me = await fetchMe(token);
      if (me.role !== 'EXPERT') {
        clearToken();
        setErr('Acesso não permitido neste painel.');
        return;
      }

      router.replace('/');
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'E-mail ou senha inválidos';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Background premium */}
      <div className="absolute inset-0 bg-[#050713]" />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 opacity-80 blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, rgba(106,92,255,0.22), transparent 65%), radial-gradient(closest-side, rgba(62,120,255,0.14), transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, rgba(62,120,255,0.16), transparent 65%), radial-gradient(closest-side, rgba(106,92,255,0.10), transparent 60%)',
        }}
      />

      {/* subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(70% 60% at 50% 30%, black 60%, transparent 100%)',
        }}
      />

      <style jsx global>{`
        button:focus-visible,
        a:focus-visible,
        input:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(106, 92, 255, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.14) inset;
          border-color: rgba(255, 255, 255, 0.22) !important;
        }
        ::selection {
          background: rgba(106, 92, 255, 0.35);
          color: rgba(255, 255, 255, 0.95);
        }
      `}</style>

      <div className="relative min-h-screen grid place-items-center px-4 py-10">
        <div className="w-full max-w-[980px] grid grid-cols-1 md:grid-cols-2 gap-0 rounded-3xl border border-white/10 overflow-hidden shadow-[0_40px_160px_rgba(0,0,0,0.78)]">
          {/* Left panel */}
          <div className="hidden md:block relative bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
            <div
              className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 opacity-80 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(106,92,255,0.32), transparent 60%)' }}
            />
            <div
              className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 opacity-70 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(62,120,255,0.22), transparent 60%)' }}
            />

            <div className="relative h-full p-10 flex flex-col justify-between">
              <div>
                {/* ✅ Logo PNG SEM borda / sem fundo / sem container */}
                <div className="flex items-center gap-3">
                  <Image
                    src="/logozonainvest.png"
                    alt="Zona Invest"
                    width={56}
                    height={56}
                    priority
                    className="select-none"
                  />

                  <div>
                    <div className="text-white/92 font-semibold tracking-tight text-lg leading-tight">Zona Invest</div>
                    <div className="text-white/55 text-sm -mt-0.5">Expert Panel</div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="text-white/92 text-[26px] leading-tight font-semibold tracking-tight">
                    Acesse seu Painel Expert.
                  </div>
                  <div className="mt-3 text-white/55 text-sm leading-relaxed">
                    Visão de métricas, notificações e performance.
                  </div>
                </div>
              </div>

              <div className="pt-10">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-white/75 text-sm font-medium">Dica</div>
                  <div className="mt-1 text-white/50 text-sm">
                    Aqui o Garrido é conhecido como Darrindo.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel (form) */}
          <div className="relative bg-[#070A15]">
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  'radial-gradient(600px 220px at 70% 10%, rgba(106,92,255,0.18), transparent 60%), radial-gradient(520px 220px at 20% 30%, rgba(62,120,255,0.10), transparent 60%)',
              }}
            />

            <div className="relative p-7 sm:p-9">
              {/* ✅ Aqui fica só o título do formulário (sem logo) */}
              <div>
                <div className="text-white/92 font-semibold tracking-tight text-lg leading-tight">Entrar</div>
                <div className="text-white/55 text-sm mt-1">Use seu e-mail e senha para acessar.</div>
              </div>

              {err ? (
                <div className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
                  {err}
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <div className="text-white/60 text-xs mb-2">E-mail</div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    type="email"
                    className="w-full h-12 rounded-2xl border border-white/10 bg-black/35 px-4 text-white/90 text-sm outline-none focus:border-white/20"
                    placeholder="seuemail@dominio.com"
                  />
                </div>

                <div>
                  <div className="text-white/60 text-xs mb-2">Senha</div>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    className="w-full h-12 rounded-2xl border border-white/10 bg-black/35 px-4 text-white/90 text-sm outline-none focus:border-white/20"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`
                    w-full h-12 rounded-2xl border border-white/10
                    bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF]
                    text-white font-semibold text-sm
                    shadow-[0_18px_70px_rgba(62,120,255,0.22)]
                    hover:opacity-95 transition disabled:opacity-60
                  `}
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>

                <div className="pt-2 text-center text-white/45 text-xs">
                  Ao entrar, você concorda com as políticas internas de acesso.
                </div>
              </form>

              {/* Mobile helper (since left panel is hidden) */}
              <div className="md:hidden mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-white/75 text-sm font-medium">Dica</div>
                <div className="mt-1 text-white/50 text-sm">
                  No painel, use o ícone do olho para ocultar/mostrar dados sensíveis.
                </div>
              </div>
            </div>

            {/* bottom hairline */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
