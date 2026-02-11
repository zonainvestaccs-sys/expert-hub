// expert-frontend/src/app/disparo-whatsapp/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import ExpertShell from '@/components/ExpertShell';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

type ExpertProfile = {
  id?: string;
  email?: string;

  // ✅ do Prisma/User (backend)
  whatsappBlastEnabled?: boolean;
  whatsappBlastIframeUrl?: string | null;

  // ✅ extras (para manter o ExpertShell com avatar etc, se vier do /expert/me)
  photoUrl?: string | null;
};

function normalizeUrl(u?: string | null) {
  const s = String(u ?? '').trim();
  if (!s) return '';
  // aceita https://..., http://..., about:blank etc.
  return s;
}

export default function DisparoWhatsAppPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [profile, setProfile] = useState<ExpertProfile | null>(null);

  const enabled = profile?.whatsappBlastEnabled !== false; // default true se vier undefined
  const iframeUrl = useMemo(() => normalizeUrl(profile?.whatsappBlastIframeUrl), [profile?.whatsappBlastIframeUrl]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // se o app já tem guard no layout, isso raramente dispara
      window.location.href = '/login';
      return;
    }

    let alive = true;

    (async () => {
      setLoading(true);
      setErr('');

      try {
        // ✅ agora /expert/me deve devolver o perfil (corrigido no backend)
        let me: any = null;

        try {
          me = await apiFetch<ExpertProfile>(`/expert/me?ts=${Date.now()}`, { token });
        } catch {
          // ✅ fallback caso algum ambiente ainda esteja com /me diferente
          try {
            me = await apiFetch<ExpertProfile>(`/expert/profile?ts=${Date.now()}`, { token });
          } catch {
            // ✅ fallback comum em alguns projetos
            me = await apiFetch<ExpertProfile>(`/expert/me?ts=${Date.now()}`, { token });
          }
        }

        if (!alive) return;
        setProfile(me ?? null);
      } catch (e: any) {
        if (!alive) return;
        setErr(typeof e?.message === 'string' ? e.message : 'Falha ao carregar configuração do disparo.');
        setProfile(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <ExpertShell me={profile as any}>
      <div className="min-h-[calc(100vh-120px)]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-white/92 font-semibold tracking-tight text-xl">Disparo WhatsApp</div>
            <div className="text-white/45 text-sm mt-1">Abra sua ferramenta de disparo configurada pelo admin.</div>
          </div>

          {/* ✅ removido: botão "Abrir em nova aba" */}
        </div>

        {err ? (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
        ) : null}

        {/* estado: carregando */}
        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-white/60">Carregando…</div>
        ) : null}

        {/* estado: desabilitado / não configurado */}
        {!loading && (!enabled || !iframeUrl) ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="text-white/85 font-semibold">Disparo não configurado</div>

            {!enabled ? (
              <div className="mt-2 text-white/55 text-sm">O admin desativou o disparo de WhatsApp para este expert.</div>
            ) : (
              <div className="mt-2 text-white/55 text-sm">Falta configurar a URL do iframe do disparo (no painel admin).</div>
            )}

            <div className="mt-4 text-white/45 text-sm">
              Se isso estiver errado, peça ao admin para preencher:
              <span className="text-white/75"> whatsappBlastEnabled </span>e<span className="text-white/75"> whatsappBlastIframeUrl</span>.
            </div>

            <div className="mt-4">
              <Link
                href="/leads"
                className={cx(
                  'inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-white/10',
                  'bg-white/[0.03] hover:bg-white/[0.06] transition',
                  'text-white/85 text-sm font-medium',
                )}
              >
                Ir para Leads
              </Link>
            </div>
          </div>
        ) : null}

        {/* estado: ok */}
        {!loading && enabled && iframeUrl ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {/* ✅ removido: header interno com texto "Ferramenta carregada..." e botão "Abrir em nova aba" */}

            {/* ✅ ajustado: altura maior pra evitar scroll desnecessário */}
            <div className="relative w-full" style={{ height: 'calc(100vh - 210px)' }}>
              <iframe
                src={iframeUrl}
                className="absolute inset-0 h-full w-full"
                // ✅ permissões mais “tranquilas” pra ferramentas web (ajuste se necessário)
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
                allow="clipboard-read; clipboard-write"
                referrerPolicy="no-referrer"
                title="Disparo WhatsApp"
              />
            </div>
          </div>
        ) : null}
      </div>
    </ExpertShell>
  );
}
