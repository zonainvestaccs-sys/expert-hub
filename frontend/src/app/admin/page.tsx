// src/app/admin/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Sensitive } from '@/components/SensitiveMode';
import ExpertLineChart from '@/components/ExpertLineChart';

// ✅ Ícones
import { Users, UserCheck, Wallet, ShoppingCart, Megaphone, TrendingUp, ArrowDownCircle } from 'lucide-react';

type Overview = {
  users: { total: number; admins: number; experts: number; active: number };
  leads: { total: number; active: number };
  deposits: { totalCents: number; ftdCount: number };
  revenue: { revCents: number; revWithdrawalsCents?: number };
  sales: { salesCents: number; salesCount: number };
  traffic: { trafficCents: number };
};

type AdminSeriesPoint = {
  label: string;
  revBRL?: number;
  depositsBRL?: number;
  leadsTotal?: number;
  ftdCount?: number;
};

type AdminSeriesResponse = {
  period: { from: string; to: string; group: 'day' | 'week' | 'month'; expertId: string };
  points: AdminSeriesPoint[];
};

type AdminExpertsResponse = {
  items: Array<{
    id: string;
    email: string;
    isActive: boolean;
    createdAt: string;
    photoUrl?: string | null;
  }>;
};

type ExpertRow = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  photoUrl?: string | null;
};

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

function ptDate(iso: string) {
  // iso: YYYY-MM-DD
  const [y, m, d] = (iso || '').split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function today() {
  return new Date();
}

function startOfLast7Days() {
  const now = new Date();
  const d = new Date(now);
  d.setDate(d.getDate() - 6);
  return d;
}

function startOfPreviousMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function endOfPreviousMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0);
}

function resolvePhotoUrl(photoUrl?: string | null) {
  const raw = String(photoUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (!apiBase) return raw; // fallback: tenta relativo mesmo

  // garante sem // duplicado
  if (raw.startsWith('/')) return `${apiBase}${raw}`;
  return `${apiBase}/${raw}`;
}

function initialsFromEmail(email: string) {
  const s = String(email || '').trim();
  if (!s) return '?';
  const head = s.split('@')[0] || s;
  const parts = head.split(/[._-]+/).filter(Boolean);
  const a = (parts[0]?.[0] || head[0] || '?').toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || '').toUpperCase();
  return (a + b).slice(0, 2);
}

function Avatar({
  email,
  photoUrl,
  size = 28,
  className,
}: {
  email: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const src = resolvePhotoUrl(photoUrl);
  const initials = initialsFromEmail(email);

  return (
    <div
      className={cx(
        'rounded-full overflow-hidden border border-white/10 bg-white/[0.05] grid place-items-center',
        className,
      )}
      style={{ width: size, height: size }}
      title={email}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={email} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[11px] font-semibold text-white/80">{initials}</span>
      )}
    </div>
  );
}

function StackedAvatars({ experts, max = 6 }: { experts: ExpertRow[]; max?: number }) {
  const list = experts.slice(0, max);
  const extra = Math.max(0, experts.length - list.length);

  return (
    <div className="flex items-center">
      {list.map((e, idx) => (
        <Avatar
          key={e.id}
          email={e.email}
          photoUrl={e.photoUrl}
          size={24}
          className={cx('-ml-2 first:ml-0')}
        />
      ))}
      {extra > 0 ? (
        <div
          className={cx(
            'ml-1 h-6 min-w-6 px-2 rounded-full border border-white/10',
            'bg-white/[0.05] text-white/70 text-[11px] font-semibold grid place-items-center',
          )}
        >
          +{extra}
        </div>
      ) : null}
    </div>
  );
}

function Icon({
  name,
  className,
}: {
  name:
    | 'calendar'
    | 'chevron'
    | 'refresh'
    | 'users'
    | 'leads'
    | 'deposit'
    | 'spark'
    | 'ftd'
    | 'rev'
    | 'sales'
    | 'traffic'
    | 'profit';
  className?: string;
}) {
  const common = cx('inline-block align-middle', className);

  if (name === 'calendar') {
    return (
      <svg className={common} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M8 3v3M16 3v3M4.5 9.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path
          d="M6.5 5.5h11A3 3 0 0 1 20.5 8.5v11A3 3 0 0 1 17.5 22.5h-11A3 3 0 0 1 3.5 19.5v-11A3 3 0 0 1 6.5 5.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === 'chevron') {
    return (
      <svg className={common} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M8.5 10l3.5 3.8L15.5 10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === 'refresh') {
    return (
      <svg className={common} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 12a8 8 0 0 1-14.7 4.3M4 12a8 8 0 0 1 14.7-4.3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M20 7v3h-3M4 17v-3h3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === 'users') {
    return (
      <svg className={common} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M16.5 21c0-3-2.5-5-5.5-5s-5.5 2-5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path
          d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path d="M19 21c0-2.1-1-3.6-2.5-4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  // spark
  return (
    <svg className={common} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l1.6 6.1L20 10l-6.4 1.9L12 18l-1.6-6.1L4 10l6.4-1.9L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Popover base */
function Popover({
  open,
  onClose,
  anchorRef,
  children,
  widthClass = 'w-[420px]',
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement;
      const anchor = anchorRef.current as HTMLElement | null;
      if (!anchor) return;
      const pop = document.querySelector('[data-popover-root="1"]') as HTMLElement | null;
      if (!pop) return;

      if (!anchor.contains(el) && !pop.contains(el)) onClose();
    }

    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      data-popover-root="1"
      className={cx(
        'absolute z-[60] mt-2',
        widthClass,
        'rounded-2xl border border-white/10',
        'bg-[#0B1022]/95 backdrop-blur-xl',
        'shadow-[0_30px_120px_rgba(0,0,0,0.65)] overflow-hidden',
      )}
      style={{ right: 0 }}
    >
      {children}
    </div>
  );
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
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  subLabel?: string;
  subValue?: React.ReactNode;
}) {
  return (
    <CardShell>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white/60 text-[12px] font-medium tracking-[0.2px]">{title}</div>
            <div className="mt-2 text-[28px] leading-[1.1] tracking-tight font-semibold text-white/95">{value}</div>
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
            <span className="text-white/80 font-medium">{subValue}</span>
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
            <div className="text-white/60 text-[12px] font-medium tracking-[0.2px]">Taxa de Conversão FTD’s</div>
            <div className="text-white/40 text-[12px] mt-1">FTD / Leads</div>

            <div className="mt-3 text-[30px] leading-[1.05] tracking-tight font-semibold text-white/95">
              <Sensitive placeholder="•••%">{formatPct(pct)}</Sensitive>
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

export default function AdminDashboardPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<AdminSeriesResponse | null>(null);
  const [experts, setExperts] = useState<ExpertRow[]>([]);
  const [err, setErr] = useState<string>('');

  // ✅ DEFAULT: mês atual ATÉ HOJE
  const [from, setFrom] = useState<string>(isoDate(startOfMonth()));
  const [to, setTo] = useState<string>(isoDate(today()));
  const [expertId, setExpertId] = useState<string>('ALL');
  const [group, setGroup] = useState<'day' | 'week' | 'month'>('day');

  const [fromDraft, setFromDraft] = useState<string>(isoDate(startOfMonth()));
  const [toDraft, setToDraft] = useState<string>(isoDate(today()));
  const [expertDraft, setExpertDraft] = useState<string>('ALL');
  const [groupDraft, setGroupDraft] = useState<'day' | 'week' | 'month'>('day');

  const [openPeriod, setOpenPeriod] = useState(false);
  const [openExpert, setOpenExpert] = useState(false);
  const periodBtnRef = useRef<HTMLButtonElement>(null);
  const expertBtnRef = useRef<HTMLButtonElement>(null);

  const [expertSearch, setExpertSearch] = useState('');

  useEffect(() => {
    const t = getToken();
    if (!t) {
      clearToken();
      router.replace('/login');
      return;
    }
    setToken(t);
    setReady(true);
  }, [router]);

  const expertLabel = useMemo(() => {
    if (expertId === 'ALL') return 'Todos os experts';
    return experts.find((e) => e.id === expertId)?.email ?? 'Expert';
  }, [expertId, experts]);

  const periodLabel = useMemo(() => `${ptDate(from)} — ${ptDate(to)}`, [from, to]);
  const headerSubtitle = useMemo(() => `${expertLabel} • ${from} → ${to}`, [expertLabel, from, to]);

  const filteredExperts = useMemo(() => {
    const q = expertSearch.trim().toLowerCase();
    const list = experts || [];
    if (!q) return list;
    return list.filter((e) => e.email.toLowerCase().includes(q));
  }, [experts, expertSearch]);

  const avgTicketCents = useMemo(() => {
    const deposits = Number(overview?.deposits?.totalCents ?? 0);
    const ftd = Number(overview?.deposits?.ftdCount ?? 0);
    if (!ftd || ftd <= 0) return 0;
    return Math.round(deposits / ftd);
  }, [overview]);

  const revWithdrawalsCents = useMemo(() => {
    const v = Number(overview?.revenue?.revWithdrawalsCents ?? 0);
    return Number.isFinite(v) ? v : 0;
  }, [overview]);

  const loadAll = useCallback(
    async (opts?: { from?: string; to?: string; expertId?: string; group?: 'day' | 'week' | 'month' }) => {
      setErr('');
      setLoading(true);

      try {
        if (!token) throw new Error('Sem token');

        // ✅ lista experts com foto (admin)
        const expRes = await apiFetch<AdminExpertsResponse>('/admin/experts', { token });
        const only = Array.isArray(expRes?.items) ? expRes.items : [];
        setExperts(
          only.map((x) => ({
            id: String(x.id),
            email: String(x.email || ''),
            isActive: !!x.isActive,
            createdAt: String(x.createdAt || ''),
            photoUrl: x.photoUrl ?? null,
          })),
        );

        const f = opts?.from ?? from;
        const t = opts?.to ?? to;
        const ex = opts?.expertId ?? expertId;
        const gr = opts?.group ?? group;

        const urlOverview = `/admin/overview?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&expertId=${encodeURIComponent(ex)}`;
        const urlSeries = `/admin/series?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&group=${encodeURIComponent(gr)}&expertId=${encodeURIComponent(ex)}`;

        const [ov, se] = await Promise.all([
          apiFetch<Overview>(urlOverview, { token }),
          apiFetch<AdminSeriesResponse>(urlSeries, { token }),
        ]);

        setOverview(ov);
        setSeries(se);
      } catch (e: any) {
        const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar dados do dashboard';
        setErr(msg);
      } finally {
        setLoading(false);
      }
    },
    [token, from, to, expertId, group],
  );

  useEffect(() => {
    if (!ready) return;
    loadAll();
  }, [ready, loadAll]);

  function openPeriodPopover() {
    setFromDraft(from);
    setToDraft(to);
    setGroupDraft(group);
    setOpenExpert(false);
    setOpenPeriod(true);
  }

  function openExpertPopover() {
    setExpertDraft(expertId);
    setExpertSearch('');
    setOpenPeriod(false);
    setOpenExpert(true);
  }

  function applyFilters() {
    setFrom(fromDraft);
    setTo(toDraft);
    setExpertId(expertDraft);
    setGroup(groupDraft);

    setOpenPeriod(false);
    setOpenExpert(false);

    loadAll({ from: fromDraft, to: toDraft, expertId: expertDraft, group: groupDraft });
  }

  function setPreset(preset: 'THIS_MONTH' | 'PREV_MONTH' | 'LAST_7') {
    if (preset === 'THIS_MONTH') {
      setFromDraft(isoDate(startOfMonth()));
      setToDraft(isoDate(today()));
      setGroupDraft('day');
      return;
    }

    if (preset === 'PREV_MONTH') {
      setFromDraft(isoDate(startOfPreviousMonth()));
      setToDraft(isoDate(endOfPreviousMonth()));
      setGroupDraft('day');
      return;
    }

    setFromDraft(isoDate(startOfLast7Days()));
    setToDraft(isoDate(today()));
    setGroupDraft('day');
  }

  if (!ready) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="h-5 w-40 rounded bg-white/[0.06] animate-pulse" />
          <div className="mt-2 h-4 w-72 rounded bg-white/[0.05] animate-pulse" />
        </div>
        <div className="p-6 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4 h-[128px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse reminding" />
          <div className="col-span-12 md:col-span-4 h-[128px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
          <div className="col-span-12 md:col-span-4 h-[128px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
          <div className="col-span-12 h-[240px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <>
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
        {/* Glow topo premium */}
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
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl border border-white/10 bg-white/[0.04] grid place-items-center text-[#7AA7FF]">
                <Icon name="spark" />
              </span>
              <div className="text-white/92 font-semibold tracking-tight text-[18px]">Dashboard</div>
            </div>

            <div className="text-white/45 text-sm mt-1">
              Série por período • <Sensitive placeholder="•••• • •••• → ••••">{headerSubtitle}</Sensitive>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 relative">
            {/* Período */}
            <div className="relative">
              <button
                ref={periodBtnRef}
                type="button"
                onClick={() => (openPeriod ? setOpenPeriod(false) : openPeriodPopover())}
                className={cx(
                  'h-10 px-3 rounded-xl border border-white/10',
                  'bg-white/[0.03] hover:bg-white/[0.05] transition',
                  'text-white/85 text-sm flex items-center gap-2',
                )}
              >
                <span className="text-white/60">
                  <Icon name="calendar" />
                </span>
                <span className="font-medium">{periodLabel}</span>
                <span className="text-white/55">
                  <Icon name="chevron" />
                </span>
              </button>

              <Popover open={openPeriod} onClose={() => setOpenPeriod(false)} anchorRef={periodBtnRef as any} widthClass="w-[520px]">
                <div className="p-4 border-b border-white/10">
                  <div className="text-white/85 font-semibold">Período</div>
                  <div className="text-white/50 text-sm mt-1">Escolha um intervalo, um preset e o agrupamento do gráfico.</div>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6">
                      <div className="text-white/55 text-xs mb-2">De</div>
                      <input
                        type="date"
                        value={fromDraft}
                        onChange={(e) => setFromDraft(e.target.value)}
                        className={cx('w-full h-10 rounded-xl border border-white/10 bg-black/30', 'px-3 text-white/85 text-sm outline-none focus:border-white/20')}
                      />
                    </div>
                    <div className="col-span-6">
                      <div className="text-white/55 text-xs mb-2">Até</div>
                      <input
                        type="date"
                        value={toDraft}
                        onChange={(e) => setToDraft(e.target.value)}
                        className={cx('w-full h-10 rounded-xl border border-white/10 bg-black/30', 'px-3 text-white/85 text-sm outline-none focus:border-white/20')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12">
                      <div className="text-white/55 text-xs mb-2">Agrupar gráfico por</div>
                      <select
                        value={groupDraft}
                        onChange={(e) => setGroupDraft(e.target.value as any)}
                        className={cx('w-full h-10 rounded-xl border border-white/10 bg-black/30', 'px-3 text-white/85 text-sm outline-none focus:border-white/20')}
                      >
                        <option value="day">Diário</option>
                        <option value="week">Semanal</option>
                        <option value="month">Mensal</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { k: 'LAST_7', label: 'Últimos 7 dias' },
                      { k: 'THIS_MONTH', label: 'Este mês' },
                      { k: 'PREV_MONTH', label: 'Mês anterior' },
                    ].map((p) => (
                      <button
                        key={p.k}
                        type="button"
                        onClick={() => setPreset(p.k as any)}
                        className={cx('h-9 px-3 rounded-xl border border-white/10', 'bg-white/[0.03] hover:bg-white/[0.06] transition', 'text-white/75 text-sm')}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3">
                  <div className="text-white/55 text-xs">
                    Selecionado:{' '}
                    <span className="text-white/75">
                      {ptDate(fromDraft)} — {ptDate(toDraft)} • {groupDraft === 'day' ? 'Diário' : groupDraft === 'week' ? 'Semanal' : 'Mensal'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenPeriod(false)}
                      className={cx('h-10 px-3 rounded-xl border border-white/10', 'bg-white/[0.02] hover:bg-white/[0.05] transition', 'text-white/75 text-sm')}
                    >
                      Fechar
                    </button>

                    <button
                      type="button"
                      onClick={applyFilters}
                      className={cx('h-10 px-4 rounded-xl border border-white/10', 'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white', 'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition', 'text-sm font-medium')}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </Popover>
            </div>

            {/* Expert */}
            <div className="relative">
              <button
                ref={expertBtnRef}
                type="button"
                onClick={() => (openExpert ? setOpenExpert(false) : openExpertPopover())}
                className={cx(
                  'h-10 px-3 rounded-xl border border-white/10',
                  'bg-white/[0.03] hover:bg-white/[0.05] transition',
                  'text-white/85 text-sm flex items-center gap-2',
                  'min-w-[260px] justify-between',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="text-white/60">
                    <Icon name="users" />
                  </span>
                  <span className="font-medium truncate max-w-[170px]">
                    <Sensitive placeholder="••••••@••••">{expertLabel}</Sensitive>
                  </span>
                </span>
                <span className="text-white/55">
                  <Icon name="chevron" />
                </span>
              </button>

              <Popover open={openExpert} onClose={() => setOpenExpert(false)} anchorRef={expertBtnRef as any} widthClass="w-[460px]">
                <div className="p-4 border-b border-white/10">
                  <div className="text-white/85 font-semibold">Filtrar por expert</div>
                  <div className="text-white/50 text-sm mt-1">Busque por e-mail e selecione.</div>
                </div>

                <div className="p-4 space-y-3">
                  <input
                    value={expertSearch}
                    onChange={(e) => setExpertSearch(e.target.value)}
                    placeholder="Buscar por e-mail..."
                    className={cx('w-full h-10 rounded-xl border border-white/10 bg-black/30', 'px-3 text-white/85 text-sm outline-none focus:border-white/20')}
                  />

                  <div className="max-h-[320px] overflow-auto pr-1">
                    <button
                      type="button"
                      onClick={() => setExpertDraft('ALL')}
                      className={cx(
                        'w-full text-left px-3 py-2 rounded-xl border border-white/10',
                        expertDraft === 'ALL' ? 'bg-white/[0.08]' : 'bg-white/[0.03] hover:bg-white/[0.06]',
                        'transition',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-white/90 text-sm font-medium">Todos os experts</div>
                          <div className="text-white/45 text-xs mt-0.5">Visão consolidada da operação</div>
                        </div>

                        <StackedAvatars experts={experts} max={6} />
                      </div>
                    </button>

                    <div className="mt-2 space-y-2">
                      {filteredExperts.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setExpertDraft(e.id)}
                          className={cx(
                            'w-full text-left px-3 py-2 rounded-xl border border-white/10',
                            expertDraft === e.id ? 'bg-white/[0.08]' : 'bg-white/[0.03] hover:bg-white/[0.06]',
                            'transition',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar email={e.email} photoUrl={e.photoUrl} size={30} />
                            <div className="min-w-0">
                              <div className="text-white/90 text-sm font-medium truncate">
                                <Sensitive placeholder="••••••@••••">{e.email}</Sensitive>
                              </div>
                              <div className="text-white/45 text-xs mt-0.5">
                                ID: <Sensitive placeholder="••••••">{e.id}</Sensitive>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}

                      {filteredExperts.length === 0 ? (
                        <div className="text-white/50 text-sm px-2 py-6 text-center">Nenhum expert encontrado.</div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenExpert(false)}
                    className={cx('h-10 px-3 rounded-xl border border-white/10', 'bg-white/[0.02] hover:bg-white/[0.05] transition', 'text-white/75 text-sm')}
                  >
                    Fechar
                  </button>

                  <button
                    type="button"
                    onClick={applyFilters}
                    className={cx('h-10 px-4 rounded-xl border border-white/10', 'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white', 'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition', 'text-sm font-medium')}
                  >
                    Aplicar
                  </button>
                </div>
              </Popover>
            </div>

            {/* Atualizar */}
            <button
              onClick={() => loadAll()}
              type="button"
              className={cx('h-10 px-4 rounded-xl border border-white/10', 'bg-white/[0.03] hover:bg-white/[0.06] transition', 'text-white/85 text-sm font-medium flex items-center gap-2')}
            >
              <span className="text-white/70">
                <Icon name="refresh" />
              </span>
              Atualizar
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative p-6">
          {err ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
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
                    value={<Sensitive placeholder="••••">{formatInt(overview?.leads?.total ?? 0)}</Sensitive>}
                    icon={<Users className="h-5 w-5 text-white/75" />}
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="Ticket Médio"
                    value={<Sensitive placeholder="R$ ••••">{formatBRLFromCents(avgTicketCents)}</Sensitive>}
                    subLabel="FTD"
                    subValue={<Sensitive placeholder="••••">{formatInt(overview?.deposits?.ftdCount ?? 0)}</Sensitive>}
                    icon={<UserCheck className="h-5 w-5 text-white/75" />}
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="Depósitos (R$)"
                    value={<Sensitive placeholder="R$ ••••">{formatBRLFromCents(overview?.deposits?.totalCents ?? 0)}</Sensitive>}
                    subLabel="FTD"
                    subValue={<Sensitive placeholder="••••">{formatInt(overview?.deposits?.ftdCount ?? 0)}</Sensitive>}
                    icon={<Wallet className="h-5 w-5 text-white/75" />}
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="REV SAQUES"
                    value={<Sensitive placeholder="R$ ••••">{formatBRLFromCents(revWithdrawalsCents)}</Sensitive>}
                    icon={<ArrowDownCircle className="h-5 w-5 text-white/75" />}
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="Vendas (R$)"
                    value={<Sensitive placeholder="R$ ••••">{formatBRLFromCents(overview?.sales?.salesCents ?? 0)}</Sensitive>}
                    subLabel="Qtd vendas"
                    subValue={<Sensitive placeholder="••••">{formatInt(overview?.sales?.salesCount ?? 0)}</Sensitive>}
                    icon={<ShoppingCart className="h-5 w-5 text-white/75" />}
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <StatCard
                    title="Tráfego (gasto)"
                    value={<Sensitive placeholder="R$ ••••">{formatBRLFromCents(overview?.traffic?.trafficCents ?? 0)}</Sensitive>}
                    icon={<Megaphone className="h-5 w-5 text-white/75" />}
                  />
                </div>

                <div className="col-span-12 md:col-span-6">
                  <ConversionCard
                    leadsTotal={Number(overview?.leads?.total ?? 0)}
                    ftdCount={Number(overview?.deposits?.ftdCount ?? 0)}
                  />
                </div>
              </div>

              {/* Gráfico: ✅ pré-seleciona REV + Depósitos + Leads + FTD */}
              <div className="mt-5 zi-sensitive-graph">
                <div className="zi-sensitive-graph__content">
                  <ExpertLineChart
                    points={(series?.points ?? []) as any}
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
    </>
  );
}
