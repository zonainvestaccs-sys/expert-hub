'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ExpertShell from '@/components/ExpertShell';
import { getToken, clearToken, fetchMe } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { fetchExpertLeads } from '@/lib/expert';
import { apiFetch } from '@/lib/api';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function formatBRL(n: number) {
  const v = Number(n || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateLoose(v?: string) {
  const s = String(v || '').trim();
  if (!s) return '-';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
  return s;
}

function numLoose(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strLoose(v: any) {
  return String(v ?? '').trim();
}

function onlyDigits(v: string) {
  return String(v || '').replace(/\D+/g, '');
}

function isoDateLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekLocal(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}
function endOfWeekLocal(now = new Date()) {
  const s = startOfWeekLocal(now);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return e;
}
function startOfMonthLocal(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
function endOfMonthLocal(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}
function startOfYearLocal(now = new Date()) {
  return new Date(now.getFullYear(), 0, 1);
}
function endOfYearLocal(now = new Date()) {
  return new Date(now.getFullYear(), 11, 31);
}

// ✅ ícone fixo (coloque o arquivo em /public/icons/whatsapp.png)
const WHATSAPP_ICON_SRC = '/icons/whatsapp.png';

// “Todo período”
const DEFAULT_FROM = '2000-01-01';
const DEFAULT_TO = '2099-12-31';

const MAX_FETCH_ITEMS = 5000;

const AUTO_REFRESH_MS = 20_000;
const MIN_REFRESH_MS = 5_000;

type SortKey = 'firstDeposit' | 'deposits' | 'withdrawals' | 'gains' | 'losses' | 'rev' | 'balance';
type SortDir = 'asc' | 'desc';

type TagItem = { id: string; name: string; color: string };

type LeadView = {
  id: string;
  leadKey: string;

  dateView: string;
  email: string;
  wpp: string;
  wppDigits: string;

  firstDeposit: number;
  deposits: number;
  withdrawals: number;
  gains: number;
  losses: number;

  // ✅ NOVO: REV (vem do backend)
  rev: number;

  balance: number;

  tags: TagItem[];

  _raw: any;
};

function TagChip({ tag }: { tag: TagItem }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium"
      style={{
        backgroundColor: `${tag.color}22`,
        borderColor: `${tag.color}55`,
        color: '#fff',
      }}
      title={tag.name}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  );
}

function TagFilterDropdown({
  value,
  onChange,
  tags,
}: {
  value: string;
  onChange: (id: string) => void;
  tags: TagItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const current = value ? tags.find((t) => t.id === value) : null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="text-white/55 text-xs mb-2">Tag</div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'h-10 min-w-[240px] px-3 rounded-xl border border-white/10',
          'bg-black/30 hover:bg-white/[0.04] transition',
          'flex items-center justify-between gap-3',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full border border-white/15"
            style={{ backgroundColor: current?.color ?? '#64748b' }}
          />
          <span className="text-white/85 text-sm truncate">{current ? current.name : 'Todas'}</span>
        </div>

        <span className={cx('text-white/50 text-sm transition', open ? 'rotate-180' : '')}>▾</span>
      </button>

      {open ? (
        <div
          className={cx(
            'absolute z-50 mt-2 w-full rounded-2xl border border-white/10 overflow-hidden',
            'bg-[#0B1022]/95 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.70)]',
          )}
        >
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/[0.05] transition"
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-white/15" style={{ backgroundColor: '#64748b' }} />
              Todas
            </div>
          </button>

          <div className="max-h-[280px] overflow-auto">
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
                className={cx(
                  'w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/[0.05] transition',
                  value === t.id && 'bg-white/[0.06]',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full border border-white/15" style={{ backgroundColor: t.color }} />
                  <span className="truncate">{t.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SensitiveText({ children }: { children: React.ReactNode }) {
  return (
    <span className="zi-sensitive-wrap">
      <span className="zi-sensitive-real">{children}</span>
      <span className="zi-sensitive-mask" aria-hidden="true">
        *****
      </span>
    </span>
  );
}

export default function ExpertLeadsPage() {
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

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [search, setSearch] = useState('');

  // ✅ mantém pré-selecionado balance
  const [sortKey, setSortKey] = useState<SortKey>('balance');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ✅ TAGS
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagFilterId, setTagFilterId] = useState<string>(''); // '' = todas

  // ✅ modal tags por lead
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalLeadKey, setTagModalLeadKey] = useState<string>('');
  const [tagModalSelectedIds, setTagModalSelectedIds] = useState<string[]>([]);
  const [tagModalSaving, setTagModalSaving] = useState(false);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [tagCreateName, setTagCreateName] = useState('');
  const [tagCreateColor, setTagCreateColor] = useState('#6A5CFF');
  const [tagModalErr, setTagModalErr] = useState('');

  // auto refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshMs = Math.max(MIN_REFRESH_MS, AUTO_REFRESH_MS);
  const loadingRef = useRef(false);
  const lastLoadAtRef = useRef<number>(0);

  function toggleSort(k: SortKey) {
    setPage(1);
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(k);
    setSortDir('desc');
  }

  function sortArrow(k: SortKey) {
    if (sortKey !== k) return null;
    return <span className="ml-1 inline-flex align-middle text-white/70">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function pickLeadView(l: any, fallbackId: string): LeadView {
    const dateView = strLoose(l.dateLabel) || strLoose(l.date) || strLoose(l.createdAt) || '-';
    const email = strLoose(l.email) || '-';

    const wpp = strLoose(l.wpp) || strLoose(l.phone) || '';
    const wppDigits = onlyDigits(wpp);

    const leadKey = strLoose(l.leadKey) || strLoose(l.id) || fallbackId;

    const tagsArr = Array.isArray(l.tags) ? l.tags : [];

    return {
      id: strLoose(l.id) || leadKey || fallbackId,
      leadKey,

      dateView,
      email,
      wpp,
      wppDigits,

      firstDeposit: numLoose(l.firstDeposit),
      deposits: numLoose(l.deposits),
      withdrawals: numLoose(l.withdrawals),
      gains: numLoose(l.gains),
      losses: numLoose(l.losses),

      // ✅ NOVO: REV (se não vier do backend, fica 0)
      rev: numLoose((l as any).rev),

      balance: numLoose(l.balance),

      tags: tagsArr.map((t: any) => ({ id: String(t.id), name: String(t.name), color: String(t.color) })),

      _raw: l,
    };
  }

  function applyQuickRange(kind: 'week' | 'month' | 'year' | 'all') {
    const now = new Date();

    if (kind === 'all') {
      setFrom(DEFAULT_FROM);
      setTo(DEFAULT_TO);
      setPage(1);
      return;
    }

    if (kind === 'week') {
      setFrom(isoDateLocal(startOfWeekLocal(now)));
      setTo(isoDateLocal(endOfWeekLocal(now)));
      setPage(1);
      return;
    }

    if (kind === 'month') {
      setFrom(isoDateLocal(startOfMonthLocal(now)));
      setTo(isoDateLocal(endOfMonthLocal(now)));
      setPage(1);
      return;
    }

    setFrom(isoDateLocal(startOfYearLocal(now)));
    setTo(isoDateLocal(endOfYearLocal(now)));
    setPage(1);
  }

  async function loadTags() {
    if (!token) return;
    try {
      const res = await apiFetch<{ items: TagItem[] }>('/expert/tags', { token });
      setTags(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setTags([]);
    }
  }

  // ✅ carrega TODAS as páginas do backend e monta lista completa
  async function loadAll(qOverride?: string, opts?: { silent?: boolean }) {
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
      const q = (qOverride ?? search).trim() || undefined;

      const pageSizeFetch = 100;
      let p = 1;

      let combined: any[] = [];
      let totalServer = 0;

      // bypass cache
      const cacheBust = Date.now();

      while (true) {
        const res = await fetchExpertLeads(token, {
          from,
          to,
          page: p,
          pageSize: pageSizeFetch,
          q,
          fresh: true,
          _t: cacheBust,
        } as any);

        const items = (res as any)?.items ?? [];
        totalServer = Number((res as any)?.total ?? totalServer ?? 0);

        combined = combined.concat(items);

        if ((res as any)?.warning) setWarning(String((res as any).warning));
        if ((res as any)?.csvUrl) setCsvUrl(String((res as any).csvUrl));

        if (combined.length >= MAX_FETCH_ITEMS) {
          setWarning(`A lista é muito grande e foi carregada até ${MAX_FETCH_ITEMS} itens. Use a busca pra reduzir.`);
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
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar leads';
      setErr(msg);
    } finally {
      if (!opts?.silent) setLoading(false);
      loadingRef.current = false;
    }
  }

  function openTagModal(lead: LeadView) {
    const leadKey = String(lead.leadKey || '').trim();
    if (!leadKey) {
      setErr('Esse lead não tem leadKey.');
      return;
    }

    setTagModalErr('');
    setTagCreateOpen(false);
    setTagCreateName('');
    setTagCreateColor('#6A5CFF');

    setTagModalLeadKey(leadKey);
    setTagModalSelectedIds((lead.tags || []).map((t) => t.id));

    setTagModalOpen(true);

    const prev = document.body.style.overflow;
    document.body.dataset.prevOverflow = prev;
    document.body.style.overflow = 'hidden';
  }

  function closeTagModal() {
    setTagModalOpen(false);
    setTagModalLeadKey('');
    setTagModalSelectedIds([]);
    setTagModalSaving(false);
    setTagModalErr('');
    setTagCreateOpen(false);
    setTagCreateName('');
    setTagCreateColor('#6A5CFF');

    const prev = document.body.dataset.prevOverflow ?? '';
    document.body.style.overflow = prev;
    delete document.body.dataset.prevOverflow;
  }

  async function saveLeadTags() {
    if (!token) return;
    if (!tagModalLeadKey) return;

    setTagModalErr('');
    setTagModalSaving(true);

    const path = `/expert/leads/${encodeURIComponent(tagModalLeadKey)}/tags`;
    const body = { tagIds: tagModalSelectedIds };

    try {
      const methods: Array<'PUT' | 'PATCH' | 'POST'> = ['PUT', 'PATCH', 'POST'];
      let lastErr: any = null;

      for (const method of methods) {
        try {
          await apiFetch(path, { token, method, body });
          lastErr = null;
          break;
        } catch (e: any) {
          lastErr = e;
          const msg = String(e?.message || e?.error || '').toLowerCase();
          if (msg.includes('cannot') || msg.includes('not found') || msg.includes('404')) continue;
          throw e;
        }
      }

      if (lastErr) throw lastErr;

      await loadAll(undefined, { silent: true });
      closeTagModal();
    } catch (e: any) {
      setTagModalErr(typeof e?.message === 'string' ? e.message : 'Falha ao salvar tags');
    } finally {
      setTagModalSaving(false);
    }
  }

  async function createTagAndSelect() {
    if (!token) return;

    const name = tagCreateName.trim();
    const color = String(tagCreateColor || '').trim();

    if (!name) return setTagModalErr('Nome da tag obrigatório.');
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return setTagModalErr('Cor inválida.');

    setTagModalErr('');
    try {
      const res = await apiFetch<any>('/expert/tags', {
        token,
        method: 'POST',
        body: { name, color },
      });

      const newId = String(res?.tag?.id || '');
      await loadTags();

      if (newId) {
        setTagModalSelectedIds((prev) => Array.from(new Set([...prev, newId])));
      }

      setTagCreateOpen(false);
      setTagCreateName('');
      setTagCreateColor('#6A5CFF');
    } catch (e: any) {
      setTagModalErr(typeof e?.message === 'string' ? e.message : 'Falha ao criar tag');
    }
  }

  async function deleteTag(tagId: string, tagName: string) {
    if (!token) return;
    const ok = window.confirm(`Excluir a tag "${tagName}"?\nEla será removida de todos os leads.`);
    if (!ok) return;

    try {
      await apiFetch(`/expert/tags/${encodeURIComponent(tagId)}`, { token, method: 'DELETE' });

      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setTagModalSelectedIds((prev) => prev.filter((x) => x !== tagId));

      if (tagFilterId === tagId) setTagFilterId('');

      await loadAll(undefined, { silent: true });
    } catch (e: any) {
      setTagModalErr(typeof e?.message === 'string' ? e.message : 'Falha ao excluir tag');
    }
  }

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

  useEffect(() => {
    if (!token) return;
    loadTags();
    loadAll('', { silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (!autoRefresh) return;

    const id = window.setInterval(() => {
      if (loadingRef.current) return;
      const since = Date.now() - (lastLoadAtRef.current || 0);
      if (since < refreshMs - 500) return;
      loadAll(undefined, { silent: true });
    }, refreshMs);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, autoRefresh, refreshMs, from, to, search]);

  const { pageItems, totalFiltered } = useMemo(() => {
    const views: LeadView[] = allItemsRaw.map((l, idx) => pickLeadView(l, String(idx + 1)));

    const q = search.trim().toLowerCase();
    let filtered = q
      ? views.filter((it) => {
          const hay = `${it.email} ${it.wpp} ${it.wppDigits}`.toLowerCase();
          return hay.includes(q);
        })
      : views;

    if (tagFilterId) {
      filtered = filtered.filter((it) => (it.tags || []).some((t) => t.id === tagFilterId));
    }

    filtered.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const diff = av - bv;
      return sortDir === 'asc' ? diff : -diff;
    });

    const total = filtered.length;
    const p = Math.max(1, page);
    const start = (p - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return { pageItems: items, totalFiltered: total };
  }, [allItemsRaw, search, sortKey, sortDir, page, pageSize, tagFilterId]);

  const totalPagesFiltered = useMemo(() => Math.max(1, Math.ceil((totalFiltered || 0) / pageSize)), [totalFiltered, pageSize]);

  useEffect(() => {
    if (page > totalPagesFiltered) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPagesFiltered]);

  const lastUpdatedLabel = useMemo(() => {
    const at = lastLoadAtRef.current;
    if (!at) return '';
    return new Date(at).toLocaleTimeString('pt-BR');
  }, [totalAll, totalFiltered]);

  return (
    <ExpertShell me={me}>
      <style jsx global>{`
        /* ✅ CENSURA (*****), controlada pelo atributo no <html> que o ExpertShell já seta */
        .zi-sensitive-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .zi-sensitive-mask {
          display: none;
          font-weight: 700;
          letter-spacing: 2px;
          color: rgba(255, 255, 255, 0.92);
        }
        html[data-zi-sensitive-hidden='1'] .zi-sensitive-real {
          opacity: 0;
          pointer-events: none;
          user-select: none;
          position: absolute;
          left: 0;
          top: 0;
        }
        html[data-zi-sensitive-hidden='1'] .zi-sensitive-mask {
          display: inline;
        }
        html[data-zi-sensitive-hidden='1'] .zi-sensitive-click {
          pointer-events: none !important;
        }
      `}</style>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <div className="px-6 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-white/92 font-semibold tracking-tight text-[18px]">Leads</div>
            <div className="text-white/45 text-sm mt-1">
              Lista completa (ordenação e busca em cima de todos os leads)
              {lastUpdatedLabel ? <span className="ml-2 text-white/35">Atualizado: {lastUpdatedLabel}</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-wrap items-center gap-2 mr-2">
              <button
                type="button"
                onClick={() => applyQuickRange('week')}
                className={cx(
                  'h-10 px-3 rounded-xl border border-white/10 text-sm font-medium',
                  'bg-white/[0.02] hover:bg-white/[0.06] transition text-white/80',
                )}
              >
                Essa semana
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange('month')}
                className={cx(
                  'h-10 px-3 rounded-xl border border-white/10 text-sm font-medium',
                  'bg-white/[0.02] hover:bg-white/[0.06] transition text-white/80',
                )}
              >
                Esse mês
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange('year')}
                className={cx(
                  'h-10 px-3 rounded-xl border border-white/10 text-sm font-medium',
                  'bg-white/[0.02] hover:bg-white/[0.06] transition text-white/80',
                )}
              >
                Esse ano
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange('all')}
                className={cx(
                  'h-10 px-3 rounded-xl border border-white/10 text-sm font-medium',
                  'bg-white/[0.02] hover:bg-white/[0.06] transition text-white/80',
                )}
              >
                Tudo
              </button>
            </div>

            <div>
              <div className="text-white/55 text-xs mb-2">De</div>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
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
                onChange={(e) => setTo(e.target.value)}
                className={cx(
                  'h-10 rounded-xl border border-white/10 bg-black/30',
                  'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                )}
              />
            </div>

            <button
              onClick={() => loadAll(undefined, { silent: false })}
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

          <div className="mb-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <div className="text-white/55 text-xs mb-2">Pesquisar (email ou WPP)</div>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por e-mail ou WPP..."
                className={cx(
                  'w-full h-11 rounded-xl border border-white/10 bg-black/30',
                  'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                )}
              />
              <div className="text-white/45 text-xs mt-2">
                Auto refresh: {autoRefresh ? `ON (${Math.round(refreshMs / 1000)}s)` : 'OFF'}
              </div>
            </div>

            <TagFilterDropdown
              value={tagFilterId}
              tags={tags}
              onChange={(id) => {
                setTagFilterId(id);
                setPage(1);
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setSearch('');
                  setTagFilterId('');
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
                onClick={() => setAutoRefresh((v) => !v)}
                className={cx(
                  'h-11 px-4 rounded-xl border border-white/10 text-sm font-medium transition',
                  autoRefresh
                    ? 'bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/16'
                    : 'bg-white/[0.02] text-white/70 hover:bg-white/[0.05]',
                )}
              >
                {autoRefresh ? 'Auto refresh ON' : 'Auto refresh OFF'}
              </button>

              <button
                onClick={() => {
                  loadTags();
                  loadAll(undefined, { silent: false });
                }}
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
              <div className="text-white/55 text-sm mb-3">
                Total (carregado):{' '}
                <span className="text-white/80">
                  <SensitiveText>{totalAll}</SensitiveText>
                </span>{' '}
                · Filtrado:{' '}
                <span className="text-white/80">
                  <SensitiveText>{totalFiltered}</SensitiveText>
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-auto">
                  <table className="min-w-[1320px] w-full">
                    <thead className="bg-white/[0.04] border-b border-white/10">
                      <tr className="text-white/70 text-xs">
                        <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Data criação</th>
                        <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Email</th>
                        <th className="text-left font-medium px-4 py-3 whitespace-nowrap">WPP</th>
                        <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Tags</th>

                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('firstDeposit')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            1º depósito {sortArrow('firstDeposit')}
                          </button>
                        </th>

                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('deposits')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            Depósitos {sortArrow('deposits')}
                          </button>
                        </th>

                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('withdrawals')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            Saques {sortArrow('withdrawals')}
                          </button>
                        </th>

                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('gains')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            Ganhos {sortArrow('gains')}
                          </button>
                        </th>

                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('losses')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            Perdas {sortArrow('losses')}
                          </button>
                        </th>

                        {/* ✅ REV IMEDIATAMENTE À ESQUERDA DO BALANCE */}
                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('rev')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            Rev {sortArrow('rev')}
                          </button>
                        </th>

                        <th className="text-right font-medium px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort('balance')}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            Balance {sortArrow('balance')}
                          </button>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="text-sm">
                      {pageItems.map((l) => {
                        const waUrl = l.wppDigits
                          ? `https://api.whatsapp.com/send/?phone=${encodeURIComponent(l.wppDigits)}`
                          : '';

                        const revCls =
                          l.rev > 0 ? 'text-emerald-200' : l.rev < 0 ? 'text-red-200' : 'text-white/85';

                        return (
                          <tr
                            key={l.id}
                            className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.02] transition"
                          >
                            <td className="px-4 py-3 text-white/80 whitespace-nowrap">{formatDateLoose(l.dateView)}</td>

                            <td className="px-4 py-3 text-white/90 truncate max-w-[320px]">
                              <SensitiveText>{l.email}</SensitiveText>
                            </td>

                            <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                              <div className="inline-flex items-center gap-2 zi-sensitive-click">
                                <SensitiveText>
                                  <span className="inline-flex items-center gap-2">
                                    <span>{l.wpp || '-'}</span>

                                    {l.wppDigits ? (
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cx(
                                          'h-8 w-8 rounded-lg border border-white/10',
                                          'bg-white/[0.03] hover:bg-white/[0.08] transition',
                                          'grid place-items-center text-white/80 hover:text-white',
                                        )}
                                        title="Chamar no WhatsApp"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={WHATSAPP_ICON_SRC}
                                          alt="WhatsApp"
                                          className="h-4 w-4 object-contain"
                                          loading="lazy"
                                        />
                                      </a>
                                    ) : null}
                                  </span>
                                </SensitiveText>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {(l.tags || []).slice(0, 3).map((t) => (
                                  <TagChip key={t.id} tag={t} />
                                ))}
                                {(l.tags || []).length > 3 ? (
                                  <span className="text-white/55 text-xs">+{(l.tags || []).length - 3}</span>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => openTagModal(l)}
                                  className={cx(
                                    'ml-1 h-8 w-8 rounded-xl border border-white/10',
                                    'bg-white/[0.03] hover:bg-white/[0.06] transition',
                                    'grid place-items-center text-white/85',
                                  )}
                                  title="Editar tags"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">
                              <SensitiveText>{formatBRL(l.firstDeposit)}</SensitiveText>
                            </td>

                            <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">
                              <SensitiveText>{formatBRL(l.deposits)}</SensitiveText>
                            </td>

                            <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">
                              <SensitiveText>{formatBRL(l.withdrawals)}</SensitiveText>
                            </td>

                            <td className="px-4 py-3 text-right text-white/85 whitespace-nowrap">
                              <SensitiveText>{formatBRL(l.gains)}</SensitiveText>
                            </td>

                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className={l.losses > 0 ? 'text-red-200' : 'text-white/85'}>
                                <SensitiveText>{formatBRL(l.losses)}</SensitiveText>
                              </span>
                            </td>

                            {/* ✅ REV COLORIDO (VERDE/VERMELHO) */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className={cx('font-medium', revCls)}>
                                <SensitiveText>{formatBRL(l.rev)}</SensitiveText>
                              </span>
                            </td>

                            {/* ✅ BALANCE (como já era) */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span
                                className={cx(
                                  'font-medium',
                                  l.balance > 0
                                    ? 'text-emerald-200'
                                    : l.balance < 0
                                      ? 'text-red-200'
                                      : 'text-white/80',
                                )}
                              >
                                <SensitiveText>{formatBRL(l.balance)}</SensitiveText>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {pageItems.length === 0 ? (
                    <div className="p-6 text-center text-white/55">Nenhum lead (ou filtro muito restrito).</div>
                  ) : null}
                </div>
              </div>

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
                  Página{' '}
                  <span className="text-white/80">
                    <SensitiveText>{page}</SensitiveText>
                  </span>{' '}
                  de{' '}
                  <span className="text-white/80">
                    <SensitiveText>{totalPagesFiltered}</SensitiveText>
                  </span>
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

      {/* ✅ MODAL TAGS */}
      {tagModalOpen ? (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/60" onMouseDown={closeTagModal} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 w-full max-w-[520px] p-3">
            <div
              className={cx(
                'h-full rounded-2xl border border-white/10 overflow-hidden',
                'bg-[#0B1022]/95 backdrop-blur-xl',
                'shadow-[0_30px_120px_rgba(0,0,0,0.70)]',
              )}
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
                <div>
                  <div className="text-white/90 font-semibold tracking-tight">Tags do lead</div>
                  <div className="text-white/45 text-sm mt-1 truncate">Selecione, crie ou exclua tags</div>
                </div>

                <button
                  type="button"
                  onClick={closeTagModal}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center text-white/80"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 overflow-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                {tagModalErr ? (
                  <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-200 text-sm whitespace-pre-line">
                    {tagModalErr}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2">
                  <div className="text-white/70 text-sm font-medium">Tags disponíveis</div>
                  <button
                    type="button"
                    onClick={() => setTagCreateOpen((v) => !v)}
                    className="h-9 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm"
                  >
                    + Nova tag
                  </button>
                </div>

                {tagCreateOpen ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <div className="text-white/55 text-xs mb-2">Nome</div>
                        <input
                          value={tagCreateName}
                          onChange={(e) => setTagCreateName(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="Ex: VIP, Quente, Suporte..."
                        />
                      </div>

                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <div className="text-white/55 text-xs mb-2">Cor</div>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={tagCreateColor}
                              onChange={(e) => setTagCreateColor(e.target.value)}
                              className="h-11 w-14 rounded-xl border border-white/10 bg-black/30 p-1"
                              title="Escolher cor"
                            />
                            <div className="text-white/70 text-sm">{tagCreateColor}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setTagCreateOpen(false)}
                          className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition text-white/80 text-sm"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={createTagAndSelect}
                          className={cx(
                            'h-10 px-4 rounded-xl border border-white/10',
                            'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                            'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                            'text-sm font-medium',
                          )}
                        >
                          Criar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-2">
                  {tags.length === 0 ? (
                    <div className="text-white/45 text-sm">Nenhuma tag criada ainda.</div>
                  ) : (
                    tags.map((t) => {
                      const checked = tagModalSelectedIds.includes(t.id);

                      return (
                        <div
                          key={t.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setTagModalSelectedIds((prev) => {
                              if (prev.includes(t.id)) return prev.filter((x) => x !== t.id);
                              return [...prev, t.id];
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setTagModalSelectedIds((prev) => {
                                if (prev.includes(t.id)) return prev.filter((x) => x !== t.id);
                                return [...prev, t.id];
                              });
                            }
                          }}
                          className={cx(
                            'w-full rounded-2xl border px-4 py-3 text-left transition cursor-pointer outline-none',
                            checked
                              ? 'border-white/25 bg-white/[0.06]'
                              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                              <div className="text-white/90 font-medium truncate">{t.name}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className={cx('text-xs', checked ? 'text-emerald-200' : 'text-white/40')}>
                                {checked ? 'Selecionada' : 'Selecionar'}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTag(t.id, t.name);
                                }}
                                className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-red-500/15 transition grid place-items-center text-white/70 hover:text-red-200"
                                title="Excluir tag"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 text-white/45 text-xs">
                  As tags são salvas por <span className="text-white/70">leadKey estável</span> (não quebra ao
                  adicionar/remover linhas na planilha).
                </div>
              </div>

              <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeTagModal}
                  className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition text-white/80 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveLeadTags}
                  disabled={tagModalSaving}
                  className={cx(
                    'h-10 px-4 rounded-xl border border-white/10',
                    'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                    'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                    'text-sm font-medium',
                    tagModalSaving && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {tagModalSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ExpertShell>
  );
}
