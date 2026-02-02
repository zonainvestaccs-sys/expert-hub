// src/app/expert/profile/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, fetchMe, getToken } from '@/lib/auth';
import { apiFetch, API_BASE } from '@/lib/api';
import ExpertShell from '@/components/ExpertShell';
import { Instagram, Youtube, Send, MessageCircle, User as UserIcon } from 'lucide-react';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function resolvePhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('/')) return `${API_BASE}${photoUrl}`;
  return photoUrl;
}

function getInitials(email: string) {
  const v = (email || '').trim();
  if (!v) return 'EX';
  const left = v.split('@')[0] || v;
  const a = (left[0] || 'E').toUpperCase();
  const b = (left[1] || 'X').toUpperCase();
  return `${a}${b}`;
}

type ExpertProfile = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  photoUrl?: string | null;

  description?: string | null;
  youtubeUrl?: string | null;
  instagramUrl?: string | null;
  telegramUrl?: string | null;
  whatsappUrl?: string | null;
};

function SocialButton({
  kind,
  href,
}: {
  kind: 'youtube' | 'instagram' | 'telegram' | 'whatsapp';
  href?: string | null;
}) {
  const url = String(href ?? '').trim();
  if (!url) return null;

  const cfg = (() => {
    if (kind === 'youtube')
      return {
        label: 'YouTube',
        bg: 'bg-red-500/90 hover:bg-red-500',
        border: 'border-red-500/40 hover:border-red-400/60',
        Icon: Youtube,
      };
    if (kind === 'instagram')
      return {
        label: 'Instagram',
        bg: 'bg-purple-500/90 hover:bg-purple-500',
        border: 'border-purple-500/40 hover:border-purple-400/60',
        Icon: Instagram,
      };
    if (kind === 'telegram')
      return {
        label: 'Telegram',
        bg: 'bg-sky-500/90 hover:bg-sky-500',
        border: 'border-sky-500/40 hover:border-sky-400/60',
        Icon: Send,
      };
    return {
      label: 'WhatsApp',
      bg: 'bg-emerald-500/90 hover:bg-emerald-500',
      border: 'border-emerald-500/40 hover:border-emerald-400/60',
      Icon: MessageCircle,
    };
  })();

  const Icon = cfg.Icon;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`Abrir ${cfg.label}`}
      aria-label={`Abrir ${cfg.label}`}
      className={cx(
        'h-10 w-10 rounded-full border grid place-items-center text-white transition',
        'shadow-[0_18px_60px_rgba(0,0,0,0.40)]',
        'hover:scale-[1.04] active:scale-[0.98]',
        cfg.bg,
        cfg.border,
      )}
    >
      <Icon className="h-5 w-5 text-white" />
    </a>
  );
}

export default function ExpertProfilePage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [profile, setProfile] = useState<ExpertProfile | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      clearToken();
      router.replace('/login');
      return;
    }
    setToken(t);

    (async () => {
      try {
        const user = await fetchMe(t);
        if (user.role !== 'EXPERT') {
          clearToken();
          router.replace('/login');
          return;
        }
        setMe(user);
      } catch {
        clearToken();
        router.replace('/login');
      }
    })();
  }, [router]);

  async function load() {
    if (!token) return;
    setErr('');
    setLoading(true);

    try {
      const p = await apiFetch<ExpertProfile>('/expert/profile', { token });
      setProfile(p);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar perfil';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const email = profile?.email || me?.email || '';
  const avatar = resolvePhotoUrl(profile?.photoUrl ?? me?.photoUrl);
  const initials = useMemo(() => getInitials(email), [email]);

  const description = String(profile?.description ?? '').trim();

  const youtubeUrl = String(profile?.youtubeUrl ?? '').trim();
  const instagramUrl = String(profile?.instagramUrl ?? '').trim();
  const telegramUrl = String(profile?.telegramUrl ?? '').trim();
  const whatsappUrl = String(profile?.whatsappUrl ?? '').trim();

  const hasLinks = !!(youtubeUrl || instagramUrl || telegramUrl || whatsappUrl);

  return (
    <ExpertShell me={me}>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden relative shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-70"
          style={{
            background:
              'radial-gradient(700px 200px at 60% 30%, rgba(90,120,255,0.22), transparent 60%), radial-gradient(600px 220px at 25% 20%, rgba(90,200,255,0.16), transparent 60%)',
          }}
        />

        {/* Header */}
        <div className="relative px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-white/92 font-semibold tracking-tight text-[18px] flex items-center gap-2">
              <span className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.03] grid place-items-center">
                <UserIcon className="h-5 w-5 text-white/80" />
              </span>
              Meu Perfil
            </div>
            <div className="text-white/45 text-sm mt-1 truncate">
              Foto, descrição e links configurados pelo admin
            </div>
          </div>

          <button
            onClick={load}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              'bg-white/[0.02] hover:bg-white/[0.06] transition',
              'text-white/80 text-sm font-medium',
            )}
          >
            Atualizar
          </button>
        </div>

        <div className="relative p-6">
          {err ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
              {err}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5">
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              {/* Avatar */}
              <div
                className={cx(
                  'h-[96px] w-[96px] rounded-2xl border border-white/10 overflow-hidden grid place-items-center shrink-0',
                  'bg-gradient-to-br from-[#3E78FF]/20 via-white/[0.06] to-[#6A5CFF]/18',
                )}
                title={email}
              >
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Foto do perfil" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-white/90 font-semibold text-lg tracking-wide">{initials}</div>
                )}
              </div>

              {/* Conteúdo */}
              <div className="min-w-0 flex-1">
                <div className="text-white/92 font-semibold text-lg truncate">{loading ? '—' : email || 'Expert'}</div>
                <div className="text-white/45 text-xs mt-1">{profile?.id ? `ID: ${profile.id}` : ''}</div>

                {/* Links */}
                <div className="mt-4">
                  <div className="text-white/55 text-xs mb-2">Links</div>
                  {loading ? (
                    <div className="h-10 w-[220px] rounded-xl bg-white/[0.03] border border-white/10 animate-pulse" />
                  ) : hasLinks ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <SocialButton kind="youtube" href={youtubeUrl} />
                      <SocialButton kind="instagram" href={instagramUrl} />
                      <SocialButton kind="telegram" href={telegramUrl} />
                      <SocialButton kind="whatsapp" href={whatsappUrl} />
                    </div>
                  ) : (
                    <div className="text-white/45 text-sm">Nenhum link configurado.</div>
                  )}
                </div>

                {/* Descrição */}
                <div className="mt-5">
                  <div className="text-white/55 text-xs mb-2">Descrição</div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-white/80 text-sm whitespace-pre-wrap">
                    {loading ? 'Carregando...' : description || 'Sem descrição configurada.'}
                  </div>
                </div>

                <div className="mt-4 text-white/35 text-xs">
                  Para alterar sua foto/descrição/links, peça para o admin atualizar no painel.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ExpertShell>
  );
}
