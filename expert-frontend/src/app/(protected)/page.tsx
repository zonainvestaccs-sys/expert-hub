'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

type ExpertDashboardResponse = {
  expert: {
    id: string;
    email: string;
    role: 'EXPERT' | 'ADMIN';
    isActive: boolean;
    createdAt: string;
  };
  metrics: {
    leadsTotal: number;
    ftdTotal: number;
    depositsTotalBRL: number;
    lastDepositAt: string | null;
    conversionRate: number;
  };
  period: {
    from: string | null;
    to: string | null;
  };
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function formatBRL(value: number) {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatInt(n: number) {
  return (n ?? 0).toLocaleString('pt-BR');
}

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ptDate(iso: string) {
  const [y, m, d] = (iso || '').split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function startOfYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}
function endOfYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 11, 31);
}

function StatCard({
  title,
  value,
  sub,
  tint,
}: {
  title: string;
  value: string;
  sub?: string;
  tint: 'blue' | 'violet' | 'cyan' | 'yellow' | 'emerald' | 'red';
}) {
  const border =
    tint === 'red'
      ? 'border-red-500/20'
      : tint === 'emerald'
      ? 'border-emerald-500/15'
      : 'border-white/10';

  return (
    <div
      className={cx(
        'rounded-2xl border',
        border,
        'bg-gradient-to-b from-white/[0.06] to-white/[0.02]',
        'p-5 shadow-[0_18px_70px_rgba(0,0,0,0.45)]',
      )}
    >
      <div className="text-white/65 text-sm">{title}</div>
      <div className="mt-3 text-[34px] leading-[1.05] tracking-tight font-semibold text-white/95">
        {value}
      </div>
      {sub ? <div className="mt-2 text-white/45 text-sm">{sub}</div> : null}
    </div>
  );
}

export default function ExpertDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExpertDashboardResponse | null>(null);
  const [err, setErr] = useState<string>('');

  const [from, setFrom] = useState<string>(isoDate(startOfYear()));
  const [to, setTo] = useState<string>(isoDate(endOfYear()));

  async function load() {
    setErr('');
    setLoading(true);

    try {
      const token = getToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      // ✅ ROTA CERTA DO BACKEND:
      // GET /experts/me?from=YYYY-MM-DD&to=YYYY-MM-DD
      const url = `/experts/me?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await apiFetch<ExpertDashboardResponse>(url, { token });

      setData(res);
    } catch (e: any) {
      // NÃO apaga token aqui, porque pode ser só erro de rota/dados
      const msg =
        typeof e?.message === 'string'
          ? e.message
          : e?.error || 'Falha ao carregar métricas do expert';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revBRL = useMemo(() => 0, []);
  const trafficBRL = useMemo(() => 0, []);

  const profit = useMemo(() => {
    // teu ExpertsService atual não retorna rev/traffic.
    // Por enquanto: deixa 0. Quando vc migrar pro MetricsDaily, a gente liga isso.
    return revBRL - trafficBRL;
  }, [revBRL, trafficBRL]);

  const profitIsPositive = profit >= 0;

  return (
    <div className="min-h-screen bg-[#070B18] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden relative">
          <div
            className="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-70"
            style={{
              background:
                'radial-gradient(700px 200px at 60% 30%, rgba(90,120,255,0.22), transparent 60%), radial-gradient(600px 220px at 25% 20%, rgba(90,200,255,0.16), transparent 60%)',
            }}
          />

          <div className="relative px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4">
            <div>
              <div className="text-white/92 font-semibold tracking-tight text-[18px]">
                Dashboard do Expert
              </div>
              <div className="text-white/45 text-sm mt-1">
                {data?.expert?.email ? data.expert.email : 'Expert'} • {ptDate(from)} —{' '}
                {ptDate(to)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
              />
              <button
                onClick={load}
                className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm font-medium"
              >
                Atualizar
              </button>
            </div>
          </div>

          <div className="relative p-6">
            {err ? (
              <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
                {err}
              </div>
            ) : null}

            {loading ? (
              <div className="grid grid-cols-12 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="col-span-12 md:col-span-4 h-[140px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-4">
                  <StatCard
                    title="Leads no período"
                    value={formatInt(data?.metrics.leadsTotal ?? 0)}
                    tint="violet"
                    sub="Leads capturados no intervalo"
                  />
                </div>

                <div className="col-span-12 md:col-span-4">
                  <StatCard
                    title="FTD"
                    value={formatInt(data?.metrics.ftdTotal ?? 0)}
                    tint="yellow"
                    sub="Contagem atual (temporária)"
                  />
                </div>

                <div className="col-span-12 md:col-span-4">
                  <StatCard
                    title="Depósitos (R$)"
                    value={formatBRL(data?.metrics.depositsTotalBRL ?? 0)}
                    tint="cyan"
                    sub="Somatório no período"
                  />
                </div>

                <div className="col-span-12 md:col-span-4">
                  <StatCard
                    title="Conversão"
                    value={`${(data?.metrics.conversionRate ?? 0).toFixed(2)}%`}
                    tint="blue"
                    sub="FTD / Leads"
                  />
                </div>

                <div className="col-span-12 md:col-span-8">
                  <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
                    <div className="text-white/65 text-sm">Lucro / Prejuízo (placeholder)</div>
                    <div
                      className={cx(
                        'mt-3 text-[40px] leading-[1.05] tracking-tight font-semibold',
                        profitIsPositive ? 'text-emerald-200' : 'text-red-200',
                      )}
                    >
                      {formatBRL(profit)}
                    </div>
                    <div className="mt-2 text-white/45 text-sm">
                      Ainda não ligado ao MetricsDaily (REV/Tráfego). A gente liga já já.
                    </div>
                    <div className="mt-3 text-white/45 text-sm">
                      Último depósito: <span className="text-white/70">{data?.metrics.lastDepositAt ?? '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
