'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, fetchMe, getToken } from '@/lib/auth';
import {
  fetchExpertOverview,
  fetchExpertSeries,
  ExpertOverview,
  ExpertSeriesResponse,
} from '@/lib/expert';
import ExpertShell from '@/components/ExpertShell';
import ExpertLineChart from '@/components/ExpertLineChart';

// ✅ Ícones
import {
  Users,
  UserCheck,
  Wallet,
  ShoppingCart,
  Megaphone,
  TrendingUp,
  ArrowDownCircle,
} from 'lucide-react';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function formatBRLFromCents(cents: number) {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatInt(n: number) {
  return (n ?? 0).toLocaleString('pt-BR');
}

function formatPct(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfLast7Days() {
  const now = new Date();
  const d = new Date(now);
  d.setDate(d.getDate() - 6);
  return d;
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfPreviousMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function endOfPreviousMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0);
}

function today() {
  return new Date();
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-white/10',
        'bg-gradient-to-b from-white/[0.055] to-white/[0.02]',
        'shadow-[0_18px_70px_rgba(0,0,0,0.42)]',
        'transition-all duration-200',
        'hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/[0.035]',
        'hover:shadow-[0_26px_90px_rgba(0,0,0,0.55)]',
      )}
    >
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  subLabel,
  subValue,
  sensitive,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subLabel?: string;
  subValue?: string;
  sensitive?: boolean;
}) {
  return (
    <CardShell>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white/60 text-[12px] font-medium tracking-[0.2px]">
              {title}
            </div>
            <div
              className={cx(
                'mt-2 text-[28px] leading-[1.1] tracking-tight font-semibold text-white/95',
                sensitive && 'zi-sensitive',
              )}
            >
              {value}
            </div>
          </div>

          <div className="shrink-0">
            <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] grid place-items-center">
              {icon}
            </div>
          </div>
        </div>

        {subLabel && subValue ? (
          <div className="mt-2 flex items-center gap-2 text-[12px] text-white/50">
            <span className="text-white/45">{subLabel}:</span>
            <span className={cx('text-white/80 font-medium', sensitive && 'zi-sensitive')}>
              {subValue}
            </span>
          </div>
        ) : (
          <div className="mt-2 h-[18px]" />
        )}
      </div>
    </CardShell>
  );
}

function ConversionCard({ leadsTotal, ftdCount }: { leadsTotal: number; ftdCount: number }) {
  const lt = Number(leadsTotal ?? 0);
  const fc = Number(ftdCount ?? 0);

  const pct = lt > 0 ? (fc / lt) * 100 : 0;

  return (
    <CardShell>
      <div className="px-5 py-4 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white/60 text-[12px] font-medium tracking-[0.2px]">
              Taxa de Conversão FTD’s
            </div>
            <div className="text-white/40 text-[12px] mt-1">FTD / Leads</div>

            <div
              className={cx(
                'mt-3 text-[30px] leading-[1.05] tracking-tight font-semibold zi-sensitive',
                'text-white/95',
              )}
            >
              {formatPct(pct)}
            </div>
          </div>

          <div className="shrink-0">
            <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] grid place-items-center">
              <TrendingUp className="h-5 w-5 text-white/75" />
            </div>
          </div>
        </div>

        <div className="mt-2 text-white/45 text-[12px]">
          {lt > 0 ? 'Percentual de leads que viraram FTD no período.' : 'Sem leads no período para calcular.'}
        </div>
      </div>
    </CardShell>
  );
}

export default function ExpertDashboardPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [overview, setOverview] = useState<ExpertOverview | null>(null);
  const [series, setSeries] = useState<ExpertSeriesResponse | null>(null);

  // ✅ DEFAULT: mês atual ATÉ HOJE + diário
  const [from, setFrom] = useState(isoDate(startOfMonth()));
  const [to, setTo] = useState(isoDate(today()));
  const [group, setGroup] = useState<'day' | 'week' | 'month'>('day');

  const avgTicketCents = useMemo(() => {
    const deposits = Number(overview?.kpis?.depositsTotalCents ?? 0);
    const ftd = Number(overview?.kpis?.ftdCount ?? 0);
    if (!ftd || ftd <= 0) return 0;
    return Math.round(deposits / ftd);
  }, [overview]);

  // ✅ REV SAQUES: agora tipado no lib/expert
  const revWithdrawalsCents = useMemo(() => {
    const v = Number(overview?.kpis?.revWithdrawalsCents ?? 0);
    return Number.isFinite(v) ? v : 0;
  }, [overview]);

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

  async function loadAll() {
    if (!token) return;
    setErr('');
    setLoading(true);

    try {
      const [ov, se] = await Promise.all([
        fetchExpertOverview(token, from, to),
        fetchExpertSeries(token, from, to, group),
      ]);
      setOverview(ov);
      setSeries(se);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar dados';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function preset(p: '7D' | 'MONTH' | 'PREV_MONTH') {
    if (p === '7D') {
      setFrom(isoDate(startOfLast7Days()));
      setTo(isoDate(today()));
      setGroup('day');
      return;
    }

    if (p === 'PREV_MONTH') {
      setFrom(isoDate(startOfPreviousMonth()));
      setTo(isoDate(endOfPreviousMonth()));
      setGroup('day');
      return;
    }

    // ✅ Este mês: do dia 01 até hoje, diário
    setFrom(isoDate(startOfMonth()));
    setTo(isoDate(today()));
    setGroup('day');
  }

  return (
    <ExpertShell me={me}>
      <style jsx global>{`
        .zi-sensitive-graph {
          position: relative;
          border-radius: 16px;
        }
        .zi-sensitive-graph__mask {
          position: absolute;
          inset: 0;
          display: none;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(10px);
        }
        .zi-sensitive-graph__mask span {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 2px;
          color: rgba(255, 255, 255, 0.9);
        }
        html[data-zi-sensitive-hidden='1'] .zi-sensitive-graph__content {
          opacity: 0;
          pointer-events: none;
          user-select: none;
        }
        html[data-zi-sensitive-hidden='1'] .zi-sensitive-graph__mask {
          display: flex;
        }
        html:not([data-zi-sensitive-hidden='1']) .zi-sensitive-graph__mask {
          display: none;
        }
      `}</style>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden relative shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-70"
          style={{
            background:
              'radial-gradient(700px 200px at 60% 30%, rgba(90,120,255,0.22), transparent 60%), radial-gradient(600px 220px at 25% 20%, rgba(90,200,255,0.16), transparent 60%)',
          }}
        />

        {/* Header */}
        <div className="relative px-6 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-white/92 font-semibold tracking-tight text-[18px]">Dashboard</div>
            <div className="text-white/45 text-sm mt-1">
              Série por período • <span className="text-white/70">{from}</span> →{' '}
              <span className="text-white/70">{to}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <button
              onClick={() => preset('7D')}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-white/[0.02] hover:bg-white/[0.06] transition',
                'text-white/80 text-sm font-medium',
              )}
            >
              Últimos 7 dias
            </button>

            <button
              onClick={() => preset('MONTH')}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-white/[0.02] hover:bg-white/[0.06] transition',
                'text-white/80 text-sm font-medium',
              )}
            >
              Este mês
            </button>

            <button
              onClick={() => preset('PREV_MONTH')}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-white/[0.02] hover:bg-white/[0.06] transition',
                'text-white/80 text-sm font-medium',
              )}
            >
              Mês anterior
            </button>

            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as any)}
              className={cx(
                'h-10 rounded-xl border border-white/10 bg-black/30',
                'px-3 text-white/85 text-sm outline-none focus:border-white/20',
              )}
            >
              <option value="day">Diário</option>
              <option value="week">Semanal</option>
              <option value="month">Mensal</option>
            </select>

            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={cx(
                'h-10 rounded-xl border border-white/10 bg-black/30',
                'px-3 text-white/85 text-sm outline-none focus:border-white/20',
              )}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={cx(
                'h-10 rounded-xl border border-white/10 bg-black/30',
                'px-3 text-white/85 text-sm outline-none focus:border-white/20',
              )}
            />

            <button
              onClick={loadAll}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                'text-sm font-medium',
              )}
            >
              Aplicar
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
            <div className="h-[320px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
          ) : (
            <>
              {/* KPIs + Conversão */}
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="Leads"
                    value={formatInt(overview?.kpis.leadsTotal ?? 0)}
                    icon={<Users className="h-5 w-5 text-white/75" />}
                    sensitive
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="Ticket Médio"
                    value={formatBRLFromCents(avgTicketCents)}
                    subLabel="FTD"
                    subValue={formatInt(overview?.kpis.ftdCount ?? 0)}
                    icon={<UserCheck className="h-5 w-5 text-white/75" />}
                    sensitive
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="Depósitos (R$)"
                    value={formatBRLFromCents(overview?.kpis.depositsTotalCents ?? 0)}
                    subLabel="FTD"
                    subValue={formatInt(overview?.kpis.ftdCount ?? 0)}
                    icon={<Wallet className="h-5 w-5 text-white/75" />}
                    sensitive
                  />
                </div>

                {/* ✅ AQUI: no topo agora é REV SAQUES (em vez de REV) */}
                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="REV SAQUES"
                    value={formatBRLFromCents(revWithdrawalsCents)}
                    icon={<ArrowDownCircle className="h-5 w-5 text-white/75" />}
                    sensitive
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="Vendas (R$)"
                    value={formatBRLFromCents(overview?.kpis.salesCents ?? 0)}
                    subLabel="Qtd vendas"
                    subValue={formatInt(overview?.kpis.salesCount ?? 0)}
                    icon={<ShoppingCart className="h-5 w-5 text-white/75" />}
                    sensitive
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="Tráfego (gasto)"
                    value={formatBRLFromCents(overview?.kpis.trafficCents ?? 0)}
                    icon={<Megaphone className="h-5 w-5 text-white/75" />}
                    sensitive
                  />
                </div>

                {/* ✅ conversão ao lado do Tráfego (gasto) */}
                <div className="col-span-12 md:col-span-6">
                  <ConversionCard
                    leadsTotal={Number(overview?.kpis?.leadsTotal ?? 0)}
                    ftdCount={Number(overview?.kpis?.ftdCount ?? 0)}
                  />
                </div>
              </div>

              {/* Gráfico (continua igual) */}
              <div className="mt-5 zi-sensitive-graph">
                <div className="zi-sensitive-graph__content">
                  <ExpertLineChart
                    points={series?.points ?? []}
                    defaultEnabled={{
                      revBRL: true,
                      depositsBRL: true,
                      leadsTotal: true,
                      ftdCount: true,

                      salesBRL: false,
                      trafficBRL: false,
                      salesCount: false,
                    }}
                  />
                </div>
                <div className="zi-sensitive-graph__mask" aria-hidden="true">
                  <span>*****</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ExpertShell>
  );
}
