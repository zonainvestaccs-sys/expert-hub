// src/app/cronograma/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import ExpertShell from '@/components/ExpertShell';
import CronogramaCalendar from '@/components/CronogramaCalendar';
import { getToken, clearToken, fetchMe } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

export default function CronogramaPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);

  const [loadingMe, setLoadingMe] = useState(true);

  // auth (mesmo padrão do /ativacoes)
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
      } finally {
        setLoadingMe(false);
      }
    })();
  }, [router]);

  if (loadingMe) {
    // Skeleton simples (mantém padrão visual)
    return (
      <div className="min-h-[280px] rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse" />
    );
  }

  return (
    <ExpertShell me={me}>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        {/* Header padrão igual outras abas */}
        <div className="px-6 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.02] grid place-items-center">
                <CalendarDays className="h-5 w-5 text-white/85" />
              </div>

              <div className="min-w-0">
                <div className="text-white/92 font-semibold tracking-tight text-[18px]">Cronograma</div>
                <div className="text-white/45 text-sm mt-1">
                  Agenda premium • crie, edite e organize compromissos no calendário
                </div>
              </div>
            </div>
          </div>

          {/* espaço para ações futuras no header (ex: export, filtros globais) */}
          <div className="text-white/35 text-xs">
            {token ? 'Conectado' : ''}
          </div>
        </div>

        <div className="p-6">
          <CronogramaCalendar />
        </div>
      </div>
    </ExpertShell>
  );
}
