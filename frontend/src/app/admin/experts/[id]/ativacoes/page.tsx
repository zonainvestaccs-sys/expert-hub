'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

/**
 * Base da API só pra resolver fotoUrl relativo ("/uploads/...")
 */
const API_BASE = (() => {
  const raw = (process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_API_URL ?? '').trim();
  const low = raw.toLowerCase();
  if (!raw || low === 'undefined' || low === 'null') return '';
  return raw.replace(/\/+$/, '');
})();

function resolvePhotoUrl(photoUrl?: string | null) {
  const u = String(photoUrl ?? '').trim();
  if (!u) return '';
  if (u.startsWith('/')) return `${API_BASE}${u}`;
  return u;
}

// ✅ FIX: estava faltando no seu arquivo, por isso deu "formatBRL is not defined"
function formatBRL(n: number) {
  const v = Number(n || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDatePtBR(iso: string) {
  const s = String(iso || '').trim();
  if (!s) return '-';
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
}

function formatDateDMY(iso: string) {
  const s = String(iso || '').trim();
  if (!s) return '-';
  // se já vier YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}-${m}-${y}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  return s;
}

function isoDateLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isIsoInRange(iso: string, fromIso: string, toIso: string) {
  // yyyy-mm-dd lexicographic compare funciona
  const a = String(iso || '').trim();
  const f = String(fromIso || '').trim();
  const t = String(toIso || '').trim();
  if (!a || !f || !t) return false;
  return a >= f && a <= t;
}

type SortKey = 'date' | 'activation' | 'ftd' | 'deposit' | 'rev';
type SortDir = 'asc' | 'desc';

type ActivationItem = {
  id: string;
  date: string; // yyyy-mm-dd
  dateLabel?: string;
  activation: string;
  description: string;
  ftd: number;
  deposit: number;
  rev: number;
};

type ActivationsResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: ActivationItem[];
  warning?: string;
  csvUrl?: string;
  period?: { from: string | null; to: string | null };
  source?: string;
};

type ExpertProfile = {
  id: string;
  email: string;
  photoUrl?: string | null;
};

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'primary' | 'neutral' | 'ghost';
}) {
  const cls =
    tone === 'primary'
      ? 'border-[#6A5CFF]/30 bg-[#6A5CFF]/15 text-white/90'
      : tone === 'neutral'
      ? 'border-white/12 bg-white/[0.04] text-white/80'
      : 'border-white/10 bg-transparent text-white/70';

  return (
    <span className={cx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-tight', cls)}>
      {children}
    </span>
  );
}

function PremiumCard({
  label,
  iso,
  item,
  variant,
}: {
  label: 'HOJE' | 'AMANHÃ';
  iso: string;
  item: ActivationItem | null;
  variant: 'today' | 'tomorrow';
}) {
  const base =
    'relative overflow-hidden rounded-2xl border border-white/10 ' +
    'shadow-[0_30px_120px_rgba(0,0,0,0.55)]';

  const bg =
    variant === 'today'
      ? 'bg-gradient-to-br from-[#6A5CFF]/18 via-white/[0.05] to-[#3E78FF]/16'
      : 'bg-white/[0.02]';

  return (
    <div className={cx(base, bg)}>
      {/* brilho */}
      <div
        className={cx(
          'pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full blur-3xl',
          variant === 'today' ? 'bg-[#6A5CFF]/18' : 'bg-white/5',
        )}
      />
      <div
        className={cx(
          'pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full blur-3xl',
          variant === 'today' ? 'bg-[#3E78FF]/16' : 'bg-white/5',
        )}
      />

      <div className={cx('relative p-5', variant === 'today' ? 'md:p-6' : '')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white/55 text-xs">{label}</div>
            <div className={cx('mt-1 font-semibold', variant === 'today' ? 'text-2xl text-white/95' : 'text-lg text-white/90')}>
              {formatDateDMY(iso)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={variant === 'today' ? 'primary' : 'neutral'}>{iso}</Badge>
          </div>
        </div>

        {item ? (
          <div className="mt-4">
            <div className={cx('font-semibold', variant === 'today' ? 'text-xl text-white/95' : 'text-base text-white/90')}>
              {item.activation || 'Ativação'}
            </div>

            {item.description ? (
              <div
                className={cx(
                  'mt-2 whitespace-pre-wrap',
                  variant === 'today' ? 'text-white/75 text-sm leading-relaxed' : 'text-white/65 text-sm line-clamp-6 leading-relaxed',
                )}
              >
                {item.description}
              </div>
            ) : (
              <div className="mt-2 text-white/50 text-sm">Sem descrição.</div>
            )}

            <div className="mt-4">
              <Badge tone="ghost">Ativação definida</Badge>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-white/55 text-sm">
            {label === 'HOJE' ? 'Sem ativação cadastrada para hoje.' : 'Sem ativação cadastrada para amanhã.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminExpertActivationsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const expertId = params?.id;

  const tokenRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [warning, setWarning] = useState('');
  const [csvUrl, setCsvUrl] = useState('');

  // ✅ profile do expert (email + foto)
  const [expert, setExpert] = useState<ExpertProfile | null>(null);

  // filtros
  const [from, setFrom] = useState('2000-01-01');
  const [to, setTo] = useState('2099-12-31');
  const [q, setQ] = useState('');

  // server paging
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [data, setData] = useState<ActivationsResponse | null>(null);

  // ✅ highlights (hoje/amanhã)
  const todayIso = useMemo(() => isoDateLocal(new Date()), []);
  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDateLocal(d);
  }, []);

  const [todayItem, setTodayItem] = useState<ActivationItem | null>(null);
  const [tomorrowItem, setTomorrowItem] = useState<ActivationItem | null>(null);
  const [loadingHighlights, setLoadingHighlights] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace('/login');
      return;
    }
    tokenRef.current = t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadProfile() {
    if (!expertId) return;
    const token = tokenRef.current;
    if (!token) return;

    try {
      const prof = await apiFetch<any>(`/admin/experts/${encodeURIComponent(expertId)}/profile`, { token });
      setExpert({
        id: String(prof?.id ?? expertId),
        email: String(prof?.email ?? ''),
        photoUrl: prof?.photoUrl ?? null,
      });
    } catch {
      // não quebra a tela
      setExpert({ id: String(expertId), email: '', photoUrl: null });
    }
  }

  async function load() {
    if (!expertId) return;
    const token = tokenRef.current;
    if (!token) return;

    setLoading(true);
    setErr('');
    setWarning('');
    setCsvUrl('');

    try {
      const qs = new URLSearchParams();
      qs.set('from', from);
      qs.set('to', to);
      qs.set('page', String(page));
      qs.set('pageSize', String(pageSize));
      if (q.trim()) qs.set('q', q.trim());
      qs.set('sortBy', sortBy);
      qs.set('sortDir', sortDir);
      qs.set('fresh', '1');

      const res = await apiFetch<ActivationsResponse>(
        `/admin/experts/${encodeURIComponent(expertId)}/activations?${qs.toString()}`,
        { token },
      );

      setData(res);
      setWarning(String((res as any)?.warning ?? ''));
      setCsvUrl(String((res as any)?.csvUrl ?? ''));
    } catch (e: any) {
      setErr(typeof e?.message === 'string' ? e.message : 'Falha ao carregar ativações');
    } finally {
      setLoading(false);
    }
  }

  async function loadHighlights() {
    if (!expertId) return;
    const token = tokenRef.current;
    if (!token) return;

    const showToday = isIsoInRange(todayIso, from, to);
    const showTomorrow = isIsoInRange(tomorrowIso, from, to);

    setLoadingHighlights(true);
    try {
      const reqs: Array<Promise<ActivationsResponse>> = [];

      if (showToday) {
        const qsToday = new URLSearchParams();
        qsToday.set('from', todayIso);
        qsToday.set('to', todayIso);
        qsToday.set('page', '1');
        qsToday.set('pageSize', '10');
        qsToday.set('sortBy', 'date');
        qsToday.set('sortDir', 'asc');
        qsToday.set('fresh', '1');
        reqs.push(
          apiFetch<ActivationsResponse>(
            `/admin/experts/${encodeURIComponent(expertId)}/activations?${qsToday.toString()}`,
            { token },
          ),
        );
      } else {
        reqs.push(Promise.resolve({ page: 1, pageSize: 10, total: 0, items: [] } as any));
      }

      if (showTomorrow) {
        const qsTomorrow = new URLSearchParams();
        qsTomorrow.set('from', tomorrowIso);
        qsTomorrow.set('to', tomorrowIso);
        qsTomorrow.set('page', '1');
        qsTomorrow.set('pageSize', '10');
        qsTomorrow.set('sortBy', 'date');
        qsTomorrow.set('sortDir', 'asc');
        qsTomorrow.set('fresh', '1');
        reqs.push(
          apiFetch<ActivationsResponse>(
            `/admin/experts/${encodeURIComponent(expertId)}/activations?${qsTomorrow.toString()}`,
            { token },
          ),
        );
      } else {
        reqs.push(Promise.resolve({ page: 1, pageSize: 10, total: 0, items: [] } as any));
      }

      const [resToday, resTomorrow] = await Promise.all(reqs);

      setTodayItem(showToday ? (resToday?.items?.[0] ?? null) : null);
      setTomorrowItem(showTomorrow ? (resTomorrow?.items?.[0] ?? null) : null);
    } catch {
      setTodayItem(null);
      setTomorrowItem(null);
    } finally {
      setLoadingHighlights(false);
    }
  }

  useEffect(() => {
    if (!tokenRef.current) return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertId]);

  useEffect(() => {
    if (!tokenRef.current) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertId, page, sortBy, sortDir]);

  useEffect(() => {
    if (!tokenRef.current) return;
    loadHighlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertId, from, to]);

  function applyFilters() {
    setPage(1);
    load();
  }

  function toggleSort(k: SortKey) {
    setPage(1);
    if (sortBy === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(k);
    setSortDir(k === 'date' ? 'asc' : 'desc');
  }

  const totalPages = useMemo(() => {
    const total = Number(data?.total ?? 0);
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const photoSrc = resolvePhotoUrl(expert?.photoUrl);
  const expertEmail = String(expert?.email ?? '').trim();

  return (
    <div className="relative">
      <div className="flex flex-col gap-4">
        {/* Top header: voltar + identificação do expert */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (!expertId) return;
                router.push(`/admin/experts/${encodeURIComponent(expertId)}`);
              }}
              className={cx(
                'h-10 px-3 rounded-xl border border-white/10',
                'bg-white/[0.03] hover:bg-white/[0.06] transition',
                'text-white/85 text-sm font-medium inline-flex items-center gap-2',
              )}
              title="Voltar para o expert"
            >
              <span className="text-white/70">←</span> Voltar
            </button>

            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cx(
                  'h-11 w-11 rounded-2xl border border-white/10 overflow-hidden grid place-items-center',
                  'bg-gradient-to-br from-[#3E78FF]/18 via-white/[0.06] to-[#6A5CFF]/14',
                )}
                title={expertEmail || expertId}
              >
                {photoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoSrc} alt="Foto do expert" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-white/80 text-xs font-semibold">
                    {(expertEmail?.[0] || 'E').toUpperCase()}
                    {(expertEmail?.[1] || 'X').toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-white/92 font-semibold truncate">{expertEmail || 'Expert'}</div>
                <div className="text-white/45 text-xs truncate">
                  Expert ID: {expertId} • <span className="text-white/60">Ativações</span>
                  {loadingHighlights ? <span className="ml-2 text-white/35">• Atualizando destaques…</span> : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Destaques premium: HOJE + AMANHÃ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <PremiumCard label="HOJE" iso={todayIso} item={todayItem} variant="today" />
          </div>
          <div>
            <PremiumCard label="AMANHÃ" iso={tomorrowIso} item={tomorrowItem} variant="tomorrow" />
          </div>
        </div>

        {/* filtros */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div>
              <div className="text-white/55 text-xs mb-2">De</div>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                type="date"
                className="h-10 px-3 rounded-xl border border-white/10 bg-black/30 text-white/85 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-white/55 text-xs mb-2">Até</div>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                type="date"
                className="h-10 px-3 rounded-xl border border-white/10 bg-black/30 text-white/85 text-sm outline-none"
              />
            </div>

            <div className="flex-1">
              <div className="text-white/55 text-xs mb-2">Buscar</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ativação, descrição, data..."
                className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/30 text-white/85 text-sm outline-none"
              />
            </div>

            <button
              onClick={applyFilters}
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

          {warning ? (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100 text-sm">
              {warning}
              {csvUrl ? <div className="mt-1 text-amber-100/80 text-xs break-all">CSV: {csvUrl}</div> : null}
            </div>
          ) : null}
        </div>
      </div>

      {err ? (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
      ) : null}

      {/* tabela */}
      <div className="mt-5 rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[1180px] w-full">
            <thead className="bg-white/[0.04] border-b border-white/10">
              <tr className="text-white/70 text-xs">
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                  <button onClick={() => toggleSort('date')} className="hover:text-white transition">
                    Data {sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                  <button onClick={() => toggleSort('activation')} className="hover:text-white transition">
                    Ativação {sortBy === 'activation' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Descrição</th>
                <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                  <button onClick={() => toggleSort('ftd')} className="hover:text-white transition">
                    FTD {sortBy === 'ftd' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                  <button onClick={() => toggleSort('deposit')} className="hover:text-white transition">
                    Depósito {sortBy === 'deposit' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                  <button onClick={() => toggleSort('rev')} className="hover:text-white transition">
                    REV {sortBy === 'rev' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-white/55">
                    Carregando...
                  </td>
                </tr>
              ) : (data?.items || []).length ? (
                (data?.items || []).map((a) => (
                  <tr key={a.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-white/80 whitespace-nowrap">{formatDatePtBR(a.date)}</td>
                    <td className="px-4 py-3 text-white/90">
                      <div className="font-medium">{a.activation}</div>
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      <div className="max-w-[520px] whitespace-pre-wrap">{a.description || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">{Number(a.ftd || 0)}</td>

                    {/* ✅ FIX: removeu o "formatDatePtBR('2000-01-01') &&" que não faz sentido */}
                    <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">{formatBRL(Number(a.deposit || 0))}</td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatBRL(Number(a.rev || 0))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-white/55">
                    Nenhuma ativação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* paginação */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
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
            Página <span className="text-white/80">{page}</span> de <span className="text-white/80">{totalPages}</span>
          </div>

          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              'bg-white/[0.02] hover:bg-white/[0.06] transition',
              'text-white/80 text-sm font-medium disabled:opacity-40',
            )}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
