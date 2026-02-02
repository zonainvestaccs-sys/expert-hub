// src/app/admin/experts/[id]/leads/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { clearToken, fetchMe, getToken } from '@/lib/auth';
import { apiFetch, API_BASE } from '@/lib/api';
import { Sensitive } from '@/components/SensitiveMode';

type SortDir = 'asc' | 'desc';
type SortBy =
  | 'date'
  | 'email'
  | 'wpp'
  | 'firstDeposit'
  | 'deposits'
  | 'withdrawals'
  | 'gains'
  | 'losses'
  | 'balance';

type LeadItem = {
  id: string;
  date: string;
  dateLabel: string;
  email: string;
  wpp: string;
  firstDeposit: number;
  deposits: number;
  withdrawals: number;
  gains: number;
  losses: number;
  balance: number;
};

type LeadsResponse = {
  source: string;
  period: { from: string | null; to: string | null };
  page: number;
  pageSize: number;
  total: number;
  items: LeadItem[];
  csvUrl?: string;
  warning?: string;
};

type ExpertProfile = {
  id: string;
  email: string;
  photoUrl?: string | null;
  createdAt?: string;
  isActive?: boolean;
};

type ExpertOverview = {
  period: { from: string; to: string; expertId: string };
  expert: { id: string; email: string; isActive: boolean; createdAt: string; photoUrl?: string | null };
  kpis: any;
};

const DEFAULT_FROM = '2000-01-01';
const DEFAULT_TO = '2099-12-31';
const WHATSAPP_ICON_SRC = '/icons/whatsapp.png';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function resolvePhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('/')) return `${API_BASE}${photoUrl}`;
  return photoUrl;
}

function formatBRL(n: number) {
  const v = Number(n || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateLoose(v?: string) {
  const s = String(v || '').trim();
  if (!s) return '-';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
  return s;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function startOfWeekISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function startOfMonthISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}
function startOfYearISO() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function normalizeISO(v: string) {
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function onlyDigits(v: string) {
  return String(v || '').replace(/\D+/g, '');
}

/** ✅ setas melhores (chevron) + animação/realce */
function SortChevron({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center',
        active ? 'text-white/85' : 'text-white/35',
      )}
      aria-hidden="true"
    >
      <svg
        className={cx(
          'h-4 w-4 transition-transform duration-200',
          active ? 'opacity-100' : 'opacity-70',
          dir === 'asc' ? 'rotate-180' : 'rotate-0',
        )}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M6.5 9.5L12 15l5.5-5.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** ✅ seta esquerda pro botão voltar */
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'h-4 w-4'} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.5 6.5L9 12l5.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminExpertLeadsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const expertId = params?.id;

  const tokenRef = useRef<string | null>(null);

  const [checking, setChecking] = useState(true);
  const [expert, setExpert] = useState<ExpertProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [data, setData] = useState<LeadsResponse | null>(null);

  const [from, setFrom] = useState<string>(DEFAULT_FROM);
  const [to, setTo] = useState<string>(DEFAULT_TO);

  const [q, setQ] = useState('');
  const qTimer = useRef<any>(null);

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [sortBy, setSortBy] = useState<SortBy>('balance');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const pageRef = useRef(1);
  const fromRef = useRef(from);
  const toRef = useRef(to);
  const qRef = useRef(q);
  const sortByRef = useRef<SortBy>('balance');
  const sortDirRef = useRef<SortDir>('desc');
  const loadingRef = useRef(false);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    fromRef.current = from;
  }, [from]);
  useEffect(() => {
    toRef.current = to;
  }, [to]);
  useEffect(() => {
    qRef.current = q;
  }, [q]);
  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);
  useEffect(() => {
    sortDirRef.current = sortDir;
  }, [sortDir]);

  const totalPages = useMemo(() => {
    const total = Number(data?.total ?? 0);
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const t = getToken();
        if (!t) {
          clearToken();
          router.replace('/login');
          return;
        }

        const me = await fetchMe(t);
        if (!alive) return;

        if (me.role !== 'ADMIN') {
          clearToken();
          router.replace('/login');
          return;
        }

        tokenRef.current = t;
      } catch {
        clearToken();
        router.replace('/login');
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  function getRange(fOverride?: string, tOverride?: string) {
    const f = normalizeISO(fOverride ?? fromRef.current) || DEFAULT_FROM;
    const t = normalizeISO(tOverride ?? toRef.current) || DEFAULT_TO;
    return { f, t };
  }

  async function loadExpertProfile(opts?: { from?: string; to?: string }) {
    if (!expertId) return;
    const token = tokenRef.current;
    if (!token) return;

    const { f, t } = getRange(opts?.from, opts?.to);

    const ov = await apiFetch<ExpertOverview>(
      `/admin/experts/${encodeURIComponent(String(expertId))}/overview?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`,
      { token },
    );

    setExpert({
      id: ov.expert.id,
      email: ov.expert.email,
      photoUrl: ov.expert.photoUrl,
      createdAt: ov.expert.createdAt,
      isActive: ov.expert.isActive,
    });
  }

  async function load(
    pArg?: number,
    opts?: {
      fresh?: boolean;
      silent?: boolean;
      from?: string;
      to?: string;
      q?: string;
      sortBy?: SortBy;
      sortDir?: SortDir;
    },
  ) {
    if (!expertId) return;
    const token = tokenRef.current;
    if (!token) return;

    if (loadingRef.current && opts?.silent) return;
    loadingRef.current = true;

    const p = typeof pArg === 'number' ? pArg : pageRef.current;
    const { f, t } = getRange(opts?.from, opts?.to);

    const qNow = typeof opts?.q === 'string' ? opts.q : qRef.current;
    const sBy = opts?.sortBy ?? sortByRef.current;
    const sDir = opts?.sortDir ?? sortDirRef.current;

    if (!opts?.silent) {
      setErr('');
      setLoading(true);
    }

    try {
      const usp = new URLSearchParams();
      usp.set('from', f);
      usp.set('to', t);
      usp.set('page', String(p));
      usp.set('pageSize', String(pageSize));

      if (qNow.trim()) usp.set('q', qNow.trim());

      usp.set('sortBy', sBy);
      usp.set('sortDir', sDir);

      if (opts?.fresh) usp.set('fresh', '1');

      const res = await apiFetch<LeadsResponse>(
        `/admin/experts/${encodeURIComponent(String(expertId))}/leads?${usp.toString()}`,
        { token },
      );

      setData(res);
      setPage(Number(res.page ?? p));
    } catch (e: any) {
      if (!opts?.silent) {
        const msg = typeof e?.message === 'string' ? e.message : 'Falha ao carregar leads';
        setErr(msg);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
      loadingRef.current = false;
    }
  }

  useEffect(() => {
    if (checking) return;
    if (!tokenRef.current) return;

    loadExpertProfile().catch((e) => setErr(String(e?.message || e)));
    load(1, { silent: false, sortBy: 'balance', sortDir: 'desc' }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  useEffect(() => {
    if (!tokenRef.current) return;

    const id = window.setInterval(() => {
      load(pageRef.current, { fresh: true, silent: true });
    }, 8000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  function toggleSort(next: SortBy) {
    const nextDir: SortDir =
      sortByRef.current === next ? (sortDirRef.current === 'asc' ? 'desc' : 'asc') : 'desc';

    setSortBy(next);
    setSortDir(nextDir);
    setPage(1);

    load(1, { fresh: true, silent: false, sortBy: next, sortDir: nextDir }).catch(() => {});
  }

  function setPreset(kind: 'all' | 'week' | 'month' | 'year') {
    let f = DEFAULT_FROM;
    let t = DEFAULT_TO;

    if (kind === 'week') {
      f = startOfWeekISO();
      t = todayISO();
    }
    if (kind === 'month') {
      f = startOfMonthISO();
      t = todayISO();
    }
    if (kind === 'year') {
      f = startOfYearISO();
      t = todayISO();
    }

    setFrom(f);
    setTo(t);
    setPage(1);

    setTimeout(() => {
      loadExpertProfile({ from: f, to: t }).catch(() => {});
      load(1, { fresh: true, silent: false, from: f, to: t }).catch(() => {});
    }, 0);
  }

  function onSearchChange(v: string) {
    setQ(v);
    setPage(1);

    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => {
      load(1, { fresh: true, silent: false, q: v }).catch(() => {});
    }, 350);
  }

  if (checking) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4">
        <div className="text-sm text-white/80">Carregando…</div>
      </div>
    );
  }

  const avatarSrc = resolvePhotoUrl(expert?.photoUrl);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
      <div className="px-6 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
        {/* ✅ ESQUERDA: botão voltar + expert */}
        <div className="min-w-0 flex items-center gap-3">
          <button
            onClick={() => { 
              if (!expertId) return;
              router.push(`/admin/experts/${encodeURIComponent(expertId)}`);
            }}
            className={cx(
              'h-10 px-3 rounded-xl border border-white/10',
              'bg-white/[0.02] hover:bg-white/[0.06] transition',
              'text-white/80 text-sm inline-flex items-center gap-2',
            )}
            title="Voltar"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <div className="h-10 w-10 rounded-2xl border border-white/10 overflow-hidden bg-white/[0.04] flex items-center justify-center shrink-0">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="Expert" className="h-full w-full object-cover" />
            ) : (
              <span className="text-white/55 text-sm">{(expert?.email || 'E').slice(0, 1).toUpperCase()}</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-white/92 font-semibold tracking-tight text-[18px]">Leads do Expert</div>
            <div className="text-white/55 text-sm mt-1 truncate">
              <Sensitive placeholder="••••••@••••">{expert?.email ? expert.email : 'Carregando expert…'}</Sensitive>
            </div>
          </div>

          <span className="ml-1 hidden md:inline-flex px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/75 text-sm">
            EXPERT
          </span>
        </div>

        {/* direita */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreset('all')}
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80 text-sm"
            >
              Tudo
            </button>
            <button
              onClick={() => setPreset('week')}
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80 text-sm"
            >
              Essa semana
            </button>
            <button
              onClick={() => setPreset('month')}
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80 text-sm"
            >
              Esse mês
            </button>
            <button
              onClick={() => setPreset('year')}
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80 text-sm"
            >
              Esse ano
            </button>
          </div>

          <input
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por e-mail ou WPP…"
            className="h-10 w-[260px] rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
          />

          <div className="flex items-end gap-2">
            <div>
              <div className="text-white/55 text-xs mb-2">De</div>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
              />
            </div>
            <div>
              <div className="text-white/55 text-xs mb-2">Até</div>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
              />
            </div>

            <button
              onClick={() => {
                loadExpertProfile().catch(() => {});
                load(1, { fresh: true, silent: false }).catch(() => {});
              }}
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
      </div>

      <div className="p-6">
        {err ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
        ) : null}

        {loading && !data ? (
          <div className="h-[220px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
        ) : (
          <>
            {!err && !loading && data?.warning ? (
              <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-100">
                {data.warning}
                {data.csvUrl ? (
                  <div className="mt-2 text-amber-100/80 text-xs break-all">
                    CSV:{' '}
                    <Sensitive placeholder="••••••••••">
                      {data.csvUrl}
                    </Sensitive>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="text-white/55 text-sm mb-3">
              Total: <span className="text-white/80"><Sensitive placeholder="••">{data?.total ?? 0}</Sensitive></span>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-[1200px] w-full">
                  <thead className="bg-white/[0.04] border-b border-white/10">
                    <tr className="text-white/70 text-xs">
                      <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort('date')}
                          className={cx('inline-flex items-center gap-2', sortBy === 'date' ? 'text-white' : 'hover:text-white')}
                        >
                          Data criação <SortChevron active={sortBy === 'date'} dir={sortBy === 'date' ? sortDir : 'desc'} />
                        </button>
                      </th>

                      <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort('email')}
                          className={cx('inline-flex items-center gap-2', sortBy === 'email' ? 'text-white' : 'hover:text-white')}
                        >
                          Email <SortChevron active={sortBy === 'email'} dir={sortBy === 'email' ? sortDir : 'desc'} />
                        </button>
                      </th>

                      <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort('wpp')}
                          className={cx('inline-flex items-center gap-2', sortBy === 'wpp' ? 'text-white' : 'hover:text-white')}
                        >
                          WPP <SortChevron active={sortBy === 'wpp'} dir={sortBy === 'wpp' ? sortDir : 'desc'} />
                        </button>
                      </th>

                      <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort('firstDeposit')}
                          className={cx('inline-flex items-center gap-2', sortBy === 'firstDeposit' ? 'text-white' : 'hover:text-white')}
                        >
                          1º depósito{' '}
                          <SortChevron active={sortBy === 'firstDeposit'} dir={sortBy === 'firstDeposit' ? sortDir : 'desc'} />
                        </button>
                      </th>

                      <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort('deposits')}
                          className={cx('inline-flex items-center gap-2', sortBy === 'deposits' ? 'text-white' : 'hover:text-white')}
                        >
                          Depósitos <SortChevron active={sortBy === 'deposits'} dir={sortBy === 'deposits' ? sortDir : 'desc'} />
                        </button>
                      </th>

                      <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort('withdrawals')}
                          className={cx('inline-flex items-center gap-2', sortBy === 'withdrawals' ? 'text-white' : 'hover:text-white')}
                        >
                          Saques{' '}
                          <SortChevron active={sortBy === 'withdrawals'} dir={sortBy === 'withdrawals' ? sortDir : 'desc'} />
                        </button>
                      </th>

                      <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort('gains')}
                          className={cx('inline-flex items-center gap-2', sortBy === 'gains' ? 'text-white' : 'hover:text-white')}
                        >
                          Ganhos <SortChevron active={sortBy === 'gains'} dir={sortBy === 'gains' ? sortDir : 'desc'} />
                        </button>
                      </th>

                      <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort('losses')}
                          className={cx('inline-flex items-center gap-2', sortBy === 'losses' ? 'text-white' : 'hover:text-white')}
                        >
                          Perdas <SortChevron active={sortBy === 'losses'} dir={sortBy === 'losses' ? sortDir : 'desc'} />
                        </button>
                      </th>

                      <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort('balance')}
                          className={cx('inline-flex items-center gap-2', sortBy === 'balance' ? 'text-white' : 'hover:text-white')}
                        >
                          Balance <SortChevron active={sortBy === 'balance'} dir={sortBy === 'balance' ? sortDir : 'desc'} />
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="text-sm">
                    {(data?.items ?? []).map((l) => {
                      const wppRaw = String(l.wpp || '').trim();
                      const wppDigits = onlyDigits(wppRaw);
                      const wppLink = wppDigits ? `https://api.whatsapp.com/send/?phone=${encodeURIComponent(wppDigits)}` : '';

                      return (
                        <tr key={l.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.02] transition">
                          <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                            <Sensitive placeholder="••/••/••••">{formatDateLoose(l.dateLabel || l.date)}</Sensitive>
                          </td>

                          <td className="px-4 py-3 text-white/90 truncate max-w-[320px]">
                            <Sensitive placeholder="••••••@••••">{l.email || '-'}</Sensitive>
                          </td>

                          <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>
                                <Sensitive placeholder="••••••••••">{wppRaw || '-'}</Sensitive>
                              </span>

                              {wppDigits ? (
                                <Sensitive placeholder={null}>
                                  <a
                                    href={wppLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition"
                                    title="Abrir WhatsApp"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={WHATSAPP_ICON_SRC}
                                      alt="WhatsApp"
                                      className="h-4 w-4 object-contain opacity-90"
                                      loading="lazy"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = '/icons/whatsapp.svg';
                                      }}
                                    />
                                  </a>
                                </Sensitive>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">
                            <Sensitive placeholder="R$ ••••">{formatBRL(Number(l.firstDeposit ?? 0))}</Sensitive>
                          </td>
                          <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">
                            <Sensitive placeholder="R$ ••••">{formatBRL(Number(l.deposits ?? 0))}</Sensitive>
                          </td>
                          <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">
                            <Sensitive placeholder="R$ ••••">{formatBRL(Number(l.withdrawals ?? 0))}</Sensitive>
                          </td>
                          <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">
                            <Sensitive placeholder="R$ ••••">{formatBRL(Number(l.gains ?? 0))}</Sensitive>
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={Number(l.losses ?? 0) > 0 ? 'text-red-200' : 'text-white/85'}>
                              <Sensitive placeholder="R$ ••••">{formatBRL(Number(l.losses ?? 0))}</Sensitive>
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span
                              className={cx(
                                'font-medium',
                                Number(l.balance ?? 0) > 0
                                  ? 'text-emerald-200'
                                  : Number(l.balance ?? 0) < 0
                                    ? 'text-red-200'
                                    : 'text-white/80',
                              )}
                            >
                              <Sensitive placeholder="R$ ••••">{formatBRL(Number(l.balance ?? 0))}</Sensitive>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {(data?.items?.length ?? 0) === 0 ? (
                  <div className="p-6 text-center text-white/55">Nenhum lead no período.</div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1, { silent: false })}
                className={cx(
                  'h-10 px-4 rounded-xl border border-white/10',
                  'bg-white/[0.02] hover:bg-white/[0.06] transition',
                  'text-white/80 text-sm font-medium disabled:opacity-40',
                )}
              >
                Anterior
              </button>

              <div className="text-white/55 text-sm">
                Página <span className="text-white/80"><Sensitive placeholder="•">{page}</Sensitive></span> de{' '}
                <span className="text-white/80"><Sensitive placeholder="•">{totalPages}</Sensitive></span>
              </div>

              <button
                disabled={page >= totalPages}
                onClick={() => load(page + 1, { silent: false })}
                className={cx(
                  'h-10 px-4 rounded-xl border border-white/10',
                  'bg-white/[0.02] hover:bg-white/[0.06] transition',
                  'text-white/80 text-sm font-medium disabled:opacity-40',
                )}
              >
                Próxima
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
