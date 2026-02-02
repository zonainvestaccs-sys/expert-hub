// src/app/expert/leads/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

type ExpertMe = {
  expert?: {
    id: string;
    email: string;
    photoUrl?: string | null;
    isActive?: boolean;
  };
};

type TagItem = {
  id: string;
  name: string;
  color: string; // "#RRGGBB"
};

type LeadItem = {
  id?: string;

  // backend novo
  leadKey?: string; // pode vir ou não
  date?: string | null;
  dateLabel?: string | null;
  email?: string | null;
  wpp?: string | null;

  firstDeposit?: number | null;
  deposits?: number | null;
  withdrawals?: number | null;
  gains?: number | null;
  losses?: number | null;
  balance?: number | null;

  tags?: TagItem[]; // ✅ vindo do backend

  [k: string]: any;
};

type LeadsResponse = {
  period?: { from?: string; to?: string };
  page?: number;
  pageSize?: number;
  total?: number;
  items?: LeadItem[];
  warning?: string;
  csvUrl?: string;
};

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
  const name = v.split('@')[0] || v;
  const parts = name.split(/[.\-_ ]+/).filter(Boolean);
  const a = (parts[0]?.[0] || name[0] || 'E').toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || 'X').toUpperCase();
  return `${a}${b}`;
}

function formatBRL(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatInt(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR');
}

function parseAnyDate(input?: string | null) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s);
    const ms = s.length === 10 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const mBR = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (mBR) {
    const dd = Number(mBR[1]);
    const mm = Number(mBR[2]);
    const yyyy = Number(mBR[3]);
    const HH = mBR[4] ? Number(mBR[4]) : 0;
    const MI = mBR[5] ? Number(mBR[5]) : 0;
    const SS = mBR[6] ? Number(mBR[6]) : 0;
    const d = new Date(yyyy, mm - 1, dd, HH, MI, SS);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateSmart(input?: string | null) {
  const d = parseAnyDate(input);
  if (!d) return '—';
  return d.toLocaleString('pt-BR');
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function firstDayOfMonthISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

type SortKey =
  | 'email'
  | 'wpp'
  | 'date'
  | 'firstDeposit'
  | 'deposits'
  | 'withdrawals'
  | 'gains'
  | 'losses'
  | 'balance';

type SortDir = 'asc' | 'desc';

function Icon({
  name,
  className,
}: {
  name: 'search' | 'chevron' | 'refresh' | 'tag' | 'plus' | 'close';
  className?: string;
}) {
  const cls = cx('inline-block', className);

  if (name === 'search') {
    return (
      <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M10.5 18.5a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M17 17l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'refresh') {
    return (
      <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M20 4v6h-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'tag') {
    return (
      <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20 13l-7 7-11-11V2h7L20 13Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M7.5 7.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'plus') {
    return (
      <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'close') {
    return (
      <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={cls} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9 10l3 4 3-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group inline-flex items-center gap-2 select-none',
        align === 'right' && 'justify-end w-full',
        align === 'center' && 'justify-center w-full',
      )}
      title="Ordenar"
    >
      <span className="font-medium">{label}</span>
      <span
        className={cx(
          'text-white/35 group-hover:text-white/60 transition',
          active ? 'text-white/70' : '',
          active && dir === 'asc' ? 'rotate-180' : '',
        )}
      >
        <Icon name="chevron" />
      </span>
    </button>
  );
}

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

export default function ExpertLeadsPage() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [me, setMe] = useState<ExpertMe | null>(null);

  // filtros
  const [from, setFrom] = useState(firstDayOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [q, setQ] = useState('');

  // ✅ filtro por tag
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagFilterId, setTagFilterId] = useState<string>(''); // '' = todas

  // paginação
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // dados
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<LeadItem[]>([]);

  // sorting
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ✅ modal tags por lead
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalLeadKey, setTagModalLeadKey] = useState<string>('');
  const [tagModalSelectedIds, setTagModalSelectedIds] = useState<string[]>([]);
  const [tagModalInitialIds, setTagModalInitialIds] = useState<string[]>([]); // ✅ p/ diff add/remove
  const [tagModalSaving, setTagModalSaving] = useState(false);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [tagCreateName, setTagCreateName] = useState('');
  const [tagCreateColor, setTagCreateColor] = useState('#6A5CFF');
  const [tagModalErr, setTagModalErr] = useState('');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('desc');
  }

  async function loadMe() {
    const token = tokenRef.current;
    if (!token) return;

    try {
      const data = await apiFetch<any>('/expert/me', { token });
      if (data?.expert) setMe(data);
      else if (data?.user) setMe({ expert: data.user });
      else setMe(null);
    } catch {
      setMe(null);
    }
  }

  async function loadTags() {
    const token = tokenRef.current;
    if (!token) return;

    try {
      const res = await apiFetch<{ items: TagItem[] }>('/expert/tags', { token });
      setTags(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setTags([]);
    }
  }

  async function loadLeads(opts?: { resetPage?: boolean }) {
    setErr('');
    setLoading(true);

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const nextPage = opts?.resetPage ? 1 : page;

      const qs = new URLSearchParams();
      qs.set('from', from);
      qs.set('to', to);
      qs.set('page', String(nextPage));
      qs.set('pageSize', String(pageSize));
      if (q.trim()) qs.set('q', q.trim());

      // ✅ backend usa tagIds=tag1,tag2 (não tagId)
      if (tagFilterId) qs.set('tagIds', tagFilterId);

      // ✅ já retorna tags em cada item
      const data = await apiFetch<LeadsResponse>(`/expert/leads?${qs.toString()}`, { token });

      if (data?.warning) {
        setErr(data.warning + (data.csvUrl ? `\n${data.csvUrl}` : ''));
      }

      const list = data?.items || [];
      setItems(list);
      setTotal(Number(data?.total ?? list.length));
      setPage(nextPage);
    } catch (e: any) {
      setErr(typeof e?.message === 'string' ? e.message : 'Falha ao carregar leads');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace('/login');
      return;
    }
    tokenRef.current = t;

    loadMe();
    loadTags();
    loadLeads({ resetPage: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const expertEmail = me?.expert?.email || '';
  const expertPhoto = resolvePhotoUrl(me?.expert?.photoUrl);

  const normalized = useMemo(() => {
    return (items || []).map((it) => {
      const email = it.email ?? it['EMAIL'] ?? it['Email'] ?? it['E-mail'] ?? '';
      const wpp = it.wpp ?? it['WPP'] ?? it['Telefone'] ?? it['telefone'] ?? '';
      const dateRaw = it.dateLabel ?? it.date ?? it.createdAt ?? it['DATA CRIAÇÃO'] ?? it['Data'] ?? '';

      const firstDeposit = it.firstDeposit ?? it['PRIMEIRO DEPOSITO'] ?? it['PRIMEIRO DEPÓSITO'] ?? it['FTD'];
      const deposits = it.deposits ?? it['DEPOSITOS'] ?? it['DEPÓSITOS'];
      const withdrawals = it.withdrawals ?? it['SAQUES'];
      const gains = it.gains ?? it['GANHOS'];
      const losses = it.losses ?? it['PERDAS'];
      const balance = it.balance ?? it['BALANCE'] ?? it['SALDO'];

      // ✅ leadKey pode vir em leadKey OU só em id (backend atual usa id como leadKey)
      const leadKey = String(it.leadKey || it['leadKey'] || it.id || '').trim();

      return {
        ...it,
        _leadKey: leadKey,
        _email: String(email || ''),
        _wpp: String(wpp || ''),
        _date: String(dateRaw || ''),
        _firstDeposit: firstDeposit,
        _deposits: deposits,
        _withdrawals: withdrawals,
        _gains: gains,
        _losses: losses,
        _balance: balance,
      };
    });
  }, [items]);

  const hasSheetCols = useMemo(() => {
    return normalized.some((x) => {
      const keys = [x._firstDeposit, x._deposits, x._withdrawals, x._gains, x._losses, x._balance];
      return keys.some((v) => v !== undefined && v !== null && String(v).trim() !== '');
    });
  }, [normalized]);

  const sorted = useMemo(() => {
    const arr = [...normalized];

    const getVal = (x: any) => {
      if (sortKey === 'email') return x._email;
      if (sortKey === 'wpp') return x._wpp;
      if (sortKey === 'date') {
        const d = parseAnyDate(x._date);
        return d ? d.getTime() : -Infinity;
      }
      const map: Record<string, any> = {
        firstDeposit: x._firstDeposit,
        deposits: x._deposits,
        withdrawals: x._withdrawals,
        gains: x._gains,
        losses: x._losses,
        balance: x._balance,
      };
      const n = Number(map[sortKey]);
      return Number.isFinite(n) ? n : -Infinity;
    };

    arr.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);

      if (typeof va === 'string' && typeof vb === 'string') {
        const r = va.localeCompare(vb);
        return sortDir === 'asc' ? r : -r;
      }

      const r = Number(va) - Number(vb);
      return sortDir === 'asc' ? r : -r;
    });

    return arr;
  }, [normalized, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const sum = (k: keyof any) =>
      sorted.reduce((acc, it: any) => {
        const n = Number(it[k]);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);

    return {
      total: total,
      deposits: sum('_deposits'),
      withdrawals: sum('_withdrawals'),
      gains: sum('_gains'),
      losses: sum('_losses'),
      balance: sum('_balance'),
    };
  }, [sorted, total]);

  function openTagModal(lead: any) {
    const leadKey = String(lead._leadKey || lead.id || '').trim();
    if (!leadKey) {
      setErr('Esse lead não tem leadKey/id. Confere o retorno do backend.');
      return;
    }

    setTagModalErr('');
    setTagCreateOpen(false);
    setTagCreateName('');
    setTagCreateColor('#6A5CFF');

    setTagModalLeadKey(leadKey);

    const existing = Array.isArray(lead.tags) ? lead.tags : [];
    const existingIds = existing.map((t: any) => String(t.id));

    setTagModalSelectedIds(existingIds);
    setTagModalInitialIds(existingIds); // ✅ guarda p/ diff

    setTagModalOpen(true);

    const prev = document.body.style.overflow;
    document.body.dataset.prevOverflow = prev;
    document.body.style.overflow = 'hidden';
  }

  function closeTagModal() {
    setTagModalOpen(false);
    setTagModalLeadKey('');
    setTagModalSelectedIds([]);
    setTagModalInitialIds([]);
    setTagModalSaving(false);
    setTagModalErr('');
    setTagCreateOpen(false);
    setTagCreateName('');
    setTagCreateColor('#6A5CFF');

    const prev = document.body.dataset.prevOverflow ?? '';
    document.body.style.overflow = prev;
    delete document.body.dataset.prevOverflow;
  }

  // ✅ AJUSTADO: seu backend NÃO tem PUT /expert/leads/:leadKey/tags (bulk)
  // ele tem:
  // POST   /expert/leads/:leadKey/tags/:tagId
  // DELETE /expert/leads/:leadKey/tags/:tagId
  async function saveLeadTags() {
    const token = tokenRef.current;
    if (!token) return;
    if (!tagModalLeadKey) return;

    setTagModalErr('');
    setTagModalSaving(true);

    try {
      const initial = new Set(tagModalInitialIds.map(String));
      const selected = new Set(tagModalSelectedIds.map(String));

      const toAdd = Array.from(selected).filter((id) => !initial.has(id));
      const toRemove = Array.from(initial).filter((id) => !selected.has(id));

      const addReqs = toAdd.map((tagId) =>
        apiFetch<any>(`/expert/leads/${encodeURIComponent(tagModalLeadKey)}/tags/${encodeURIComponent(tagId)}`, {
          token,
          method: 'POST',
        }),
      );

      const removeReqs = toRemove.map((tagId) =>
        apiFetch<any>(`/expert/leads/${encodeURIComponent(tagModalLeadKey)}/tags/${encodeURIComponent(tagId)}`, {
          token,
          method: 'DELETE',
        }),
      );

      await Promise.all([...addReqs, ...removeReqs]);

      await loadTags(); // mantém dropdown atualizado
      await loadLeads({ resetPage: false });
      closeTagModal();
    } catch (e: any) {
      setTagModalErr(typeof e?.message === 'string' ? e.message : 'Falha ao salvar tags');
    } finally {
      setTagModalSaving(false);
    }
  }

  async function createTagAndSelect() {
    const token = tokenRef.current;
    if (!token) return;

    const name = tagCreateName.trim();
    const color = String(tagCreateColor || '').trim();

    if (!name) return setTagModalErr('Nome da tag obrigatório.');
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return setTagModalErr('Cor inválida. Use HEX #RRGGBB.');

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

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={cx(
              'h-12 w-12 rounded-2xl border border-white/10 overflow-hidden grid place-items-center',
              'bg-gradient-to-br from-[#3E78FF]/20 via-white/[0.06] to-[#6A5CFF]/18',
            )}
            title={expertEmail || 'Expert'}
          >
            {expertPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={expertPhoto} alt="Foto do expert" className="h-full w-full object-cover" />
            ) : (
              <div className="text-white/85 text-xs font-semibold tracking-wide">
                {getInitials(expertEmail || 'expert')}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-white/92 font-semibold tracking-tight text-[18px]">Leads</div>
            <div className="text-white/45 text-sm truncate">
              {expertEmail ? expertEmail : 'Painel do expert'} • Lista do período selecionado
            </div>
          </div>
        </div>

        {/* Filtros topo */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div>
              <div className="text-white/45 text-xs mb-2">De</div>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                type="date"
                className="h-11 px-3 rounded-xl border border-white/10 bg-black/30 text-white/85 text-sm outline-none focus:border-white/20"
              />
            </div>
            <div>
              <div className="text-white/45 text-xs mb-2">Até</div>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                type="date"
                className="h-11 px-3 rounded-xl border border-white/10 bg-black/30 text-white/85 text-sm outline-none focus:border-white/20"
              />
            </div>

            {/* ✅ filtro por tag */}
            <div>
              <div className="text-white/45 text-xs mb-2">Tag</div>
              <div className="h-11 px-3 rounded-xl border border-white/10 bg-black/30 flex items-center">
                <Icon name="tag" className="text-white/55 mr-2" />
                <select
                  value={tagFilterId}
                  onChange={(e) => setTagFilterId(e.target.value)}
                  className="bg-transparent outline-none text-white/85 text-sm"
                >
                  <option value="">Todas</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadLeads({ resetPage: true })}
              className={cx(
                'h-11 px-5 rounded-xl border border-white/10',
                'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                'text-sm font-medium',
              )}
            >
              Aplicar
            </button>

            <button
              type="button"
              onClick={() => {
                loadTags();
                loadLeads({ resetPage: false });
              }}
              className="h-11 w-11 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center text-white/85"
              title="Atualizar"
            >
              <Icon name="refresh" />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 h-11 w-full sm:w-[360px]">
            <span className="text-white/55">
              <Icon name="search" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadLeads({ resetPage: true });
              }}
              placeholder="Buscar por e-mail ou WhatsApp..."
              className="w-full bg-transparent outline-none text-white/85 text-sm"
            />
          </div>
        </div>
      </div>

      {err ? (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 whitespace-pre-line">
          {err}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-white/55 text-xs">Total</div>
          <div className="text-white/92 font-semibold text-xl mt-1">{formatInt(kpis.total)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-white/55 text-xs">Depósitos</div>
          <div className="text-white/92 font-semibold text-xl mt-1">{formatBRL(kpis.deposits)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-white/55 text-xs">Saques</div>
          <div className="text-white/92 font-semibold text-xl mt-1">{formatBRL(kpis.withdrawals)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-white/55 text-xs">Ganhos</div>
          <div className="text-white/92 font-semibold text-xl mt-1">{formatBRL(kpis.gains)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-white/55 text-xs">Perdas</div>
          <div className="text-white/92 font-semibold text-xl mt-1">{formatBRL(kpis.losses)}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-white/55 text-xs">Balance</div>
          <div className="text-white/92 font-semibold text-xl mt-1">{formatBRL(kpis.balance)}</div>
        </div>
      </div>

      {/* Table */}
      <div
        className={cx(
          'mt-5 rounded-2xl border border-white/10 overflow-hidden',
          'bg-gradient-to-b from-white/[0.05] to-white/[0.02]',
          'shadow-[0_18px_70px_rgba(0,0,0,0.45)]',
        )}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="text-white/85 font-semibold tracking-tight">Lista</div>
          <div className="text-white/45 text-sm">{loading ? 'Carregando…' : `${formatInt(total)} lead(s)`}</div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1180px]">
            <thead className="text-left sticky top-0 bg-[#0B1022]/95 backdrop-blur border-b border-white/10">
              <tr className="text-white/55 text-xs">
                <th className="px-5 py-3">
                  <SortHeader label="E-mail" active={sortKey === 'email'} dir={sortDir} onClick={() => toggleSort('email')} />
                </th>

                <th className="px-5 py-3">
                  <SortHeader label="WhatsApp" active={sortKey === 'wpp'} dir={sortDir} onClick={() => toggleSort('wpp')} />
                </th>

                <th className="px-5 py-3">
                  <SortHeader label="Data" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
                </th>

                <th className="px-5 py-3">Tags</th>

                {hasSheetCols ? (
                  <>
                    <th className="px-5 py-3 text-right">
                      <SortHeader label="1º Depósito" active={sortKey === 'firstDeposit'} dir={sortDir} onClick={() => toggleSort('firstDeposit')} align="right" />
                    </th>
                    <th className="px-5 py-3 text-right">
                      <SortHeader label="Depósitos" active={sortKey === 'deposits'} dir={sortDir} onClick={() => toggleSort('deposits')} align="right" />
                    </th>
                    <th className="px-5 py-3 text-right">
                      <SortHeader label="Saques" active={sortKey === 'withdrawals'} dir={sortDir} onClick={() => toggleSort('withdrawals')} align="right" />
                    </th>
                    <th className="px-5 py-3 text-right">
                      <SortHeader label="Ganhos" active={sortKey === 'gains'} dir={sortDir} onClick={() => toggleSort('gains')} align="right" />
                    </th>
                    <th className="px-5 py-3 text-right">
                      <SortHeader label="Perdas" active={sortKey === 'losses'} dir={sortDir} onClick={() => toggleSort('losses')} align="right" />
                    </th>
                    <th className="px-5 py-3 text-right">
                      <SortHeader label="Balance" active={sortKey === 'balance'} dir={sortDir} onClick={() => toggleSort('balance')} align="right" />
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>

            <tbody className="text-white/85">
              {loading ? (
                <>
                  {[...Array(10)].map((_, i) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="px-5 py-4"><div className="h-4 w-64 bg-white/[0.06] rounded animate-pulse" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-36 bg-white/[0.05] rounded animate-pulse" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-28 bg-white/[0.05] rounded animate-pulse" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-40 bg-white/[0.05] rounded animate-pulse" /></td>
                      {hasSheetCols ? (
                        <>
                          <td className="px-5 py-4"><div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse ml-auto" /></td>
                          <td className="px-5 py-4"><div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse ml-auto" /></td>
                          <td className="px-5 py-4"><div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse ml-auto" /></td>
                          <td className="px-5 py-4"><div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse ml-auto" /></td>
                          <td className="px-5 py-4"><div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse ml-auto" /></td>
                          <td className="px-5 py-4"><div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse ml-auto" /></td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </>
              ) : sorted.length === 0 ? (
                <tr className="border-t border-white/10">
                  <td colSpan={hasSheetCols ? 10 : 4} className="px-5 py-10 text-center text-white/55">
                    Nenhum lead encontrado nesse período.
                  </td>
                </tr>
              ) : (
                sorted.map((it: any, idx: number) => (
                  <tr
                    key={it._leadKey || it.id || `${it._email}-${idx}`}
                    className="border-t border-white/10 hover:bg-white/[0.03] transition"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-white/92 truncate">{it._email || '—'}</div>
                    </td>

                    <td className="px-5 py-4 text-white/80">{it._wpp || '—'}</td>

                    <td className="px-5 py-4 text-white/70 text-sm">{formatDateSmart(it._date)}</td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(it.tags || []).slice(0, 3).map((t: any) => (
                          <TagChip key={t.id} tag={t} />
                        ))}

                        {(it.tags || []).length > 3 ? (
                          <span className="text-white/55 text-xs">+{(it.tags || []).length - 3}</span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => openTagModal(it)}
                          className={cx(
                            'ml-1 h-8 w-8 rounded-xl border border-white/10',
                            'bg-white/[0.03] hover:bg-white/[0.06] transition',
                            'grid place-items-center text-white/85',
                          )}
                          title="Editar tags"
                        >
                          <Icon name="plus" />
                        </button>
                      </div>
                    </td>

                    {hasSheetCols ? (
                      <>
                        <td className="px-5 py-4 text-right text-white/85">{formatBRL(it._firstDeposit)}</td>
                        <td className="px-5 py-4 text-right text-white/85">{formatBRL(it._deposits)}</td>
                        <td className="px-5 py-4 text-right text-white/85">{formatBRL(it._withdrawals)}</td>
                        <td className="px-5 py-4 text-right text-white/85">{formatBRL(it._gains)}</td>
                        <td className="px-5 py-4 text-right text-white/85">{formatBRL(it._losses)}</td>
                        <td className="px-5 py-4 text-right">
                          <span
                            className={cx(
                              'inline-flex items-center px-3 py-1 rounded-full border text-xs',
                              Number(it._balance) >= 0
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                                : 'border-red-500/25 bg-red-500/10 text-red-200',
                            )}
                          >
                            {formatBRL(it._balance)}
                          </span>
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer table: paginação */}
        <div className="px-5 py-4 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-white/45 text-sm">
            Página <span className="text-white/80">{page}</span> • {formatInt(total)} registros
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setTimeout(() => loadLeads({ resetPage: true }), 0);
              }}
              className="h-10 px-3 rounded-xl border border-white/10 bg-black/30 text-white/85 text-sm outline-none"
              title="Itens por página"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/pág
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                if (page <= 1) return;
                setPage((p) => p - 1);
                setTimeout(() => loadLeads({ resetPage: false }), 0);
              }}
              className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm"
              disabled={page <= 1}
            >
              Anterior
            </button>

            <button
              type="button"
              onClick={() => {
                const maxPage = Math.max(1, Math.ceil(total / pageSize));
                if (page >= maxPage) return;
                setPage((p) => p + 1);
                setTimeout(() => loadLeads({ resetPage: false }), 0);
              }}
              className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm"
              disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* MODAL TAGS */}
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
                  <div className="text-white/45 text-sm mt-1 truncate">Selecione ou crie tags</div>
                </div>

                <button
                  type="button"
                  onClick={closeTagModal}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center text-white/80"
                  aria-label="Fechar"
                >
                  <Icon name="close" />
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
                          <div className="text-white/55 text-xs mb-2">Cor (HEX)</div>
                          <input
                            value={tagCreateColor}
                            onChange={(e) => setTagCreateColor(e.target.value)}
                            className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                            placeholder="#6A5CFF"
                          />
                        </div>

                        <div className="h-11 w-14 rounded-xl border border-white/10" style={{ backgroundColor: tagCreateColor }} />
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
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTagModalSelectedIds((prev) => {
                              if (prev.includes(t.id)) return prev.filter((x) => x !== t.id);
                              return [...prev, t.id];
                            });
                          }}
                          className={cx(
                            'w-full rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 text-left transition',
                            checked ? 'border-white/25 bg-white/[0.06]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                            <div className="text-white/90 font-medium">{t.name}</div>
                          </div>
                          <div className={cx('text-xs', checked ? 'text-emerald-200' : 'text-white/40')}>
                            {checked ? 'Selecionada' : 'Selecionar'}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 text-white/45 text-xs">
                  As tags são salvas por leadKey (o "id" que vem da planilha). Para alterar tags, use esse painel.
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

      {!hasSheetCols ? (
        <div className="mt-4 text-white/45 text-sm">Obs: mesmo sem colunas da planilha, tags devem aparecer se o backend estiver retornando "tags" em cada item.</div>
      ) : null}
    </div>
  );
}
