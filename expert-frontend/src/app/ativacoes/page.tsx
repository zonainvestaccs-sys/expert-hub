// src/app/ativacoes/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ExpertShell from '@/components/ExpertShell';
import { getToken, clearToken, fetchMe } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { fetchExpertActivations } from '@/lib/expert';
import { Sparkles, CalendarDays, ArrowRight } from 'lucide-react';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function numLoose(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strLoose(v: any) {
  return String(v ?? '').trim();
}

function formatBRL(n: number) {
  const v = Number(n || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isoDateLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLoose(v?: string) {
  const s = String(v || '').trim();
  if (!s) return '-';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    return s;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
  return s;
}

const DEFAULT_FROM = '2000-01-01';
const DEFAULT_TO = '2099-12-31';

const MAX_FETCH_ITEMS = 5000;

type SortKey = 'date' | 'activation' | 'ftd' | 'deposit' | 'rev';
type SortDir = 'asc' | 'desc';

type ActivationView = {
  id: string;
  dateIso: string; // yyyy-mm-dd
  dateLabel: string; // original ou formatado
  activation: string;
  description: string;

  ftd: number;
  deposit: number;
  rev: number;

  _raw: any;
};

export default function ExpertActivationsPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);

  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [warning, setWarning] = useState<string>('');
  const [csvUrl, setCsvUrl] = useState<string>('');

  const [allItemsRaw, setAllItemsRaw] = useState<any[]>([]);
  const [totalAll, setTotalAll] = useState<number>(0);

  // paginação local
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // busca local
  const [search, setSearch] = useState('');

  // ordenação local
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const loadingRef = useRef(false);
  const lastLoadAtRef = useRef<number>(0);

  function toggleSort(k: SortKey) {
    setPage(1);
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(k);
    setSortDir(k === 'date' ? 'asc' : 'desc');
  }

  function sortArrow(k: SortKey) {
    if (sortKey !== k) return null;
    return <span className="ml-1 inline-flex align-middle text-white/70">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function pickActivationView(a: any, fallbackId: string): ActivationView {
    const dateIso = strLoose(a.date) || '';
    const dateLabel = strLoose(a.dateLabel) || dateIso || '-';
    const activation = strLoose(a.activation) || '-';
    const description = strLoose(a.description) || '';

    return {
      id: strLoose(a.id) || fallbackId,
      dateIso,
      dateLabel,
      activation,
      description,
      ftd: numLoose(a.ftd),
      deposit: numLoose(a.deposit),
      rev: numLoose(a.rev),
      _raw: a,
    };
  }

  async function loadAll(opts?: { silent?: boolean }) {
    if (!token) return;
    if (loadingRef.current) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      setErr('Selecione datas no formato correto (YYYY-MM-DD).');
      return;
    }

    loadingRef.current = true;

    if (!opts?.silent) {
      setErr('');
      setWarning('');
      setCsvUrl('');
      setLoading(true);
    }

    try {
      const pageSizeFetch = 100;
      let p = 1;

      let combined: any[] = [];
      let totalServer = 0;

      while (true) {
        const res = await fetchExpertActivations(token, {
          from,
          to,
          page: p,
          pageSize: pageSizeFetch,
          q: undefined,
          sortBy: 'date',
          sortDir: 'asc',
          fresh: true,
        });

        const items = (res as any)?.items ?? [];
        totalServer = Number((res as any)?.total ?? totalServer ?? 0);

        combined = combined.concat(items);

        if ((res as any)?.warning) setWarning(String((res as any).warning));
        if ((res as any)?.csvUrl) setCsvUrl(String((res as any).csvUrl));

        if (combined.length >= MAX_FETCH_ITEMS) {
          setWarning(`A lista é muito grande e foi carregada até ${MAX_FETCH_ITEMS} itens. Use filtros para reduzir.`);
          combined = combined.slice(0, MAX_FETCH_ITEMS);
          break;
        }

        if (combined.length >= totalServer) break;
        if (!items.length) break;

        p += 1;
      }

      setAllItemsRaw(combined);
      setTotalAll(combined.length);
      setPage(1);

      lastLoadAtRef.current = Date.now();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar ativações';
      setErr(msg);
    } finally {
      if (!opts?.silent) setLoading(false);
      loadingRef.current = false;
    }
  }

  // auth
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

  // ao entrar
  useEffect(() => {
    if (!token) return;
    loadAll({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const views = useMemo(() => allItemsRaw.map((a, idx) => pickActivationView(a, String(idx + 1))), [allItemsRaw]);

  const todayIso = useMemo(() => isoDateLocal(new Date()), []);
  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDateLocal(d);
  }, []);

  const todayItem = useMemo(() => views.find((x) => x.dateIso === todayIso) || null, [views, todayIso]);
  const tomorrowItem = useMemo(() => views.find((x) => x.dateIso === tomorrowIso) || null, [views, tomorrowIso]);

  const { pageItems, totalFiltered } = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = q
      ? views.filter((it) => {
          const hay = `${it.dateIso} ${it.dateLabel} ${it.activation} ${it.description}`.toLowerCase();
          return hay.includes(q);
        })
      : views;

    const dir = sortDir === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      if (sortKey === 'date') return String(a.dateIso || '').localeCompare(String(b.dateIso || '')) * dir;
      if (sortKey === 'activation') return String(a.activation || '').localeCompare(String(b.activation || '')) * dir;

      const av = Number((a as any)[sortKey] ?? 0);
      const bv = Number((b as any)[sortKey] ?? 0);
      return (av - bv) * dir;
    });

    const total = filtered.length;
    const p = Math.max(1, page);
    const start = (p - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return { pageItems: items, totalFiltered: total };
  }, [views, search, sortKey, sortDir, page, pageSize]);

  const totalPagesFiltered = useMemo(
    () => Math.max(1, Math.ceil((totalFiltered || 0) / pageSize)),
    [totalFiltered, pageSize],
  );

  useEffect(() => {
    if (page > totalPagesFiltered) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPagesFiltered]);

  const lastUpdatedLabel = useMemo(() => {
    const at = lastLoadAtRef.current;
    if (!at) return '';
    return new Date(at).toLocaleTimeString('pt-BR');
  }, [totalAll, totalFiltered]);

  const hasToday = !!todayItem;

  return (
    <ExpertShell me={me}>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <div className="px-6 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.02] grid place-items-center">
                <Sparkles className="h-5 w-5 text-white/85" />
              </div>
              <div className="min-w-0">
                <div className="text-white/92 font-semibold tracking-tight text-[18px]">Ativações</div>
                <div className="text-white/45 text-sm mt-1">
                  Destaque do dia + preview + lista completa
                  {lastUpdatedLabel ? <span className="ml-2 text-white/35">Atualizado: {lastUpdatedLabel}</span> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <div className="text-white/55 text-xs mb-2">De</div>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className={cx(
                  'h-10 rounded-xl border border-white/10 bg-black/30',
                  'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                )}
              />
            </div>

            <div>
              <div className="text-white/55 text-xs mb-2">Até</div>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className={cx(
                  'h-10 rounded-xl border border-white/10 bg-black/30',
                  'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                )}
              />
            </div>

            <button
              onClick={() => loadAll({ silent: false })}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                'text-sm font-medium',
              )}
            >
              Aplicar (carregar tudo)
            </button>
          </div>
        </div>

        <div className="p-6">
          {err ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
          ) : null}

          {!err && !loading && warning ? (
            <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-100">
              {warning}
              {csvUrl ? <div className="mt-2 text-amber-100/80 text-xs break-all">CSV: {csvUrl}</div> : null}
            </div>
          ) : null}

          {/* ✅ Destaque HOJE + Amanhã (premium, sem KPI) */}
          <div className="mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* HOJE (hero) */}
              <div className="lg:col-span-2">
                <div className="relative rounded-3xl overflow-hidden">
                  {/* glow/backdrop */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#6A5CFF]/18 via-white/[0.06] to-[#3E78FF]/16" />
                  <div className="absolute -top-10 -left-10 h-48 w-48 rounded-full bg-[#6A5CFF]/20 blur-3xl" />
                  <div className="absolute -bottom-12 -right-12 h-56 w-56 rounded-full bg-[#3E78FF]/18 blur-3xl" />

                  {/* border gradient */}
                  <div className="relative p-[1px] bg-gradient-to-r from-[#6A5CFF]/45 via-white/10 to-[#3E78FF]/40 rounded-3xl">
                    <div className="relative rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-200 text-xs font-semibold">
                            <CalendarDays className="h-4 w-4" />
                            HOJE
                          </div>

                          <div className="mt-3 text-white/95 font-semibold tracking-tight text-2xl sm:text-3xl">
                            {formatDateLoose(todayIso)}
                          </div>

                          <div className="mt-1 text-white/45 text-xs">{todayIso}</div>
                        </div>

                        {/* ✅ badge arrumado */}
                        <div className="hidden sm:block">
                          <div
                            className={cx(
                              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5',
                              'text-xs font-semibold whitespace-nowrap',
                              hasToday
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                                : 'border-white/10 bg-white/[0.03] text-white/70',
                            )}
                            title="Status"
                          >
                            <span className={cx('h-2 w-2 rounded-full', hasToday ? 'bg-emerald-400' : 'bg-white/35')} />
                            {hasToday ? 'Ativação cadastrada' : 'Sem ativação'}
                          </div>
                        </div>
                      </div>

                      {todayItem ? (
                        <div className="mt-5">
                          <div className="text-white/95 font-semibold text-xl sm:text-2xl leading-snug">
                            {todayItem.activation}
                          </div>

                          {todayItem.description ? (
                            <div className="mt-3 text-white/75 text-sm leading-relaxed whitespace-pre-wrap">
                              {todayItem.description}
                            </div>
                          ) : (
                            <div className="mt-3 text-white/50 text-sm">Sem descrição.</div>
                          )}

                        </div>
                      ) : (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                          <div className="text-white/80 font-medium">Sem ativação cadastrada para hoje</div>
                          <div className="mt-2 text-white/50 text-sm">
                            Assim que a planilha tiver uma linha com a data de hoje, ela aparece aqui automaticamente.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* AMANHÃ (preview premium) */}
              <div>
                <div className="relative rounded-3xl overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-white/[0.02]" />
                  <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/[0.06] blur-3xl" />

                  <div className="relative p-[1px] bg-gradient-to-b from-white/15 to-white/5 rounded-3xl h-full">
                    <div className="relative rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl p-5 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/80 text-xs font-semibold">
                            <CalendarDays className="h-4 w-4 text-white/70" />
                            AMANHÃ
                          </div>

                          <div className="mt-3 text-white/90 font-semibold text-lg">{formatDateLoose(tomorrowIso)}</div>
                          <div className="mt-1 text-white/40 text-xs">{tomorrowIso}</div>
                        </div>

                        <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/[0.03] grid place-items-center">
                          <ArrowRight className="h-4 w-4 text-white/65" />
                        </div>
                      </div>

                      {tomorrowItem ? (
                        <div className="mt-4 flex-1 flex flex-col">
                          <div className="text-white/92 font-semibold leading-snug">{tomorrowItem.activation}</div>

                          {tomorrowItem.description ? (
                            <div className="mt-2 text-white/60 text-sm line-clamp-6 whitespace-pre-wrap">
                              {tomorrowItem.description}
                            </div>
                          ) : (
                            <div className="mt-2 text-white/45 text-sm">Sem descrição.</div>
                          )}

                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-white/75 font-medium">Sem ativação cadastrada para amanhã</div>
                          <div className="mt-2 text-white/45 text-sm">Se existir uma linha com a data de amanhã, aparece aqui.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Busca + Resumo */}
          <div className="mb-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <div className="text-white/55 text-xs mb-2">Pesquisar (ativação, descrição, data)</div>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por ativação, descrição ou data..."
                className={cx(
                  'w-full h-11 rounded-xl border border-white/10 bg-black/30',
                  'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                )}
              />
              <div className="text-white/45 text-xs mt-2">
                Total (carregado): <span className="text-white/80">{totalAll}</span> · Filtrado:{' '}
                <span className="text-white/80">{totalFiltered}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className={cx(
                  'h-11 px-4 rounded-xl border border-white/10',
                  'bg-white/[0.02] hover:bg-white/[0.06] transition',
                  'text-white/80 text-sm font-medium',
                )}
              >
                Limpar
              </button>

              <button
                onClick={() => loadAll({ silent: false })}
                className={cx(
                  'h-11 px-4 rounded-xl border border-white/10',
                  'bg-white/[0.02] hover:bg-white/[0.06] transition',
                  'text-white/80 text-sm font-medium',
                )}
              >
                Atualizar agora
              </button>
            </div>
          </div>

          {loading ? (
            <div className="h-[220px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
          ) : (
            <>
              {/* Tabela */}
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-auto">
                  <table className="min-w-[1180px] w-full">
                    <thead className="bg-white/[0.04] border-b border-white/10">
                      <tr className="text-white/70 text-xs">
                        <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('date')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            Data {sortArrow('date')}
                          </button>
                        </th>

                        <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('activation')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            Ativação {sortArrow('activation')}
                          </button>
                        </th>

                        <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Descrição</th>

                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('ftd')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            FTD {sortArrow('ftd')}
                          </button>
                        </th>

                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('deposit')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            Depósito {sortArrow('deposit')}
                          </button>
                        </th>

                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('rev')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            REV {sortArrow('rev')}
                          </button>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="text-sm">
                      {pageItems.map((a) => {
                        const isToday = a.dateIso === todayIso;
                        const isTomorrow = a.dateIso === tomorrowIso;

                        return (
                          <tr
                            key={a.id}
                            className={cx(
                              'border-b border-white/10 last:border-b-0 transition',
                              isToday ? 'bg-emerald-500/10' : isTomorrow ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02]',
                            )}
                          >
                            <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                              {formatDateLoose(a.dateIso || a.dateLabel)}
                            </td>

                            <td className="px-4 py-3 text-white/90">
                              <div className="font-medium">{a.activation}</div>
                              {isToday ? <div className="text-emerald-200 text-xs mt-1">HOJE</div> : null}
                              {isTomorrow ? <div className="text-white/45 text-xs mt-1">Amanhã</div> : null}
                            </td>

                            <td className="px-4 py-3 text-white/70">
                              <div className="max-w-[520px] whitespace-pre-wrap">{a.description || '-'}</div>
                            </td>

                            <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">{a.ftd}</td>
                            <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">{formatBRL(a.deposit)}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span
                                className={cx(
                                  'font-medium',
                                  a.rev > 0 ? 'text-emerald-200' : a.rev < 0 ? 'text-red-200' : 'text-white/80',
                                )}
                              >
                                {formatBRL(a.rev)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {pageItems.length === 0 ? (
                    <div className="p-6 text-center text-white/55">Nenhuma ativação (ou filtro muito restrito).</div>
                  ) : null}
                </div>
              </div>

              {/* Paginação local */}
              <div className="mt-4 flex items-center justify-between">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={cx(
                    'h-10 px-4 rounded-xl border border-white/10',
                    'bg-white/[0.02] hover:bg-white/[0.06] transition',
                    'text-white/80 text-sm font-medium disabled:opacity-40',
                  )}
                >
                  Anterior
                </button>

                <div className="text-white/55 text-sm">
                  Página <span className="text-white/80">{page}</span> de{' '}
                  <span className="text-white/80">{totalPagesFiltered}</span>
                </div>

                <button
                  disabled={page >= totalPagesFiltered}
                  onClick={() => setPage((p) => Math.min(totalPagesFiltered, p + 1))}
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
    </ExpertShell>
  );
}
