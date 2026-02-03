// src/app/admin/experts/[id]/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import ExpertLineChart, { ExpertSeriesPoint as ChartPoint } from '@/components/ExpertLineChart';
import { Sensitive } from '@/components/SensitiveMode';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

/**
 * Base da API só pra:
 * - resolver fotoUrl relativo ("/uploads/...")
 * - upload via FormData (não usa apiFetch pq ele seta JSON)
 */
const API_BASE = (() => {
  const raw = (process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_API_URL ?? '').trim();
  const low = raw.toLowerCase();
  if (!raw || low === 'undefined' || low === 'null') return '';
  return raw.replace(/\/+$/, '');
})();

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

function moneyBRLFromCents(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pctBR(v: number) {
  const n = Number(v);
  const ok = Number.isFinite(n) ? n : 0;
  return `${ok.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function Icon(props: { name: 'back' | 'edit' | 'close' | 'upload' | 'list' | 'info' | 'calendar' }) {
  const { name } = props;

  if (name === 'back') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === 'edit') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === 'list') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M8 6h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 12h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 18h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'info') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 17v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 8h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === 'calendar') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M7 3v3M17 3v3M4.5 8.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M6.5 5.5h11A3 3 0 0 1 20.5 8.5v10A3 3 0 0 1 17.5 21.5h-11A3 3 0 0 1 3.5 18.5v-10A3 3 0 0 1 6.5 5.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === 'close') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // upload
  return (
    <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 14v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Ícones sociais (SVG inline) — sem depender de libs.
 * Renderiza um botão redondinho clicável.
 * ✅ Preenchido com cor por rede: IG roxo, YT vermelho, TG azul, WPP verde
 */
function SocialIcon({
  kind,
  href,
  title,
}: {
  kind: 'youtube' | 'instagram' | 'whatsapp' | 'telegram';
  href?: string | null;
  title: string;
}) {
  const url = String(href ?? '').trim();
  if (!url) return null;

  const base =
    'h-9 w-9 rounded-full border transition grid place-items-center text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] ' +
    'hover:scale-[1.04] active:scale-[0.98]';

  const themed = (() => {
    if (kind === 'youtube') return 'bg-red-500/90 hover:bg-red-500 border-red-500/40';
    if (kind === 'instagram') return 'bg-purple-500/90 hover:bg-purple-500 border-purple-500/40';
    if (kind === 'telegram') return 'bg-sky-500/90 hover:bg-sky-500 border-sky-500/40';
    return 'bg-emerald-500/90 hover:bg-emerald-500 border-emerald-500/40';
  })();

  const icon = (() => {
    if (kind === 'youtube') {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5A3 3 0 0 0 2.4 7.2 31 31 0 0 0 2 12s.1 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.3-1.8.4-4.8.4-4.8s0-3-.4-4.8Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M10.2 9.6 15.8 12l-5.6 2.4V9.6Z" fill="currentColor" />
        </svg>
      );
    }

    if (kind === 'instagram') {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path d="M17.6 6.4h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    }

    if (kind === 'whatsapp') {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M20.3 11.7A8.3 8.3 0 0 0 12 3.4a8.3 8.3 0 0 0-7.2 12.3L4 21l5.5-1.5A8.3 8.3 0 0 0 20.3 11.7Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M9.2 9.1c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .5.3l.8 1.9c.1.2.1.4 0 .6l-.4.5c-.1.2-.2.4 0 .7.5 1 1.4 1.8 2.4 2.4.2.1.4.1.6 0l.6-.4c.2-.1.4-.1.6 0l1.9.8c.2.1.3.3.3.5v.5c0 .2 0 .4-.4.6-.5.3-1.6.7-3 .3-1.4-.4-3.4-1.7-4.8-4.1-1.4-2.4-1.1-3.6-.8-4.2Z"
            fill="currentColor"
            opacity="0.92"
          />
        </svg>
      );
    }

    // telegram
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M21.8 4.8 2.9 12.3c-.8.3-.8 1.4.1 1.6l4.6 1.5 1.8 5.4c.2.7 1.1.8 1.5.3l2.6-3.2 5.1 3.8c.6.4 1.5.1 1.6-.7l2.7-15.4c.1-.8-.7-1.4-1.4-1.1Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M7.6 15.3 19.4 7.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  })();

  return (
    <a href={url} target="_blank" rel="noreferrer" className={cx(base, themed)} title={title} aria-label={title}>
      {icon}
    </a>
  );
}

type ExpertOverview = {
  period: { from: string; to: string; expertId: string };
  expert: {
    id: string;
    email: string;
    isActive: boolean;
    createdAt: string;
    photoUrl?: string | null;

    // ✅ DETALHES
    description?: string | null;
    youtubeUrl?: string | null;
    instagramUrl?: string | null;
    whatsappUrl?: string | null;
    telegramUrl?: string | null;

    // ✅ SHEETS (LEADS)
    leadsSheetCsvUrl?: string | null;
    leadsSheetId?: string | null;
    leadsSheetTab?: string | null;
    leadsSheetGid?: string | null;

    // ✅ SHEETS (ATIVAÇÕES)
    activationsSheetCsvUrl?: string | null;
    activationsSheetId?: string | null;
    activationsSheetTab?: string | null;
    activationsSheetGid?: string | null;

    // ✅ SHEETS (MÉTRICAS/RELATÓRIOS)
    metricsSheetCsvUrl?: string | null;
    metricsSheetId?: string | null;
    metricsSheetTab?: string | null;
    metricsSheetGid?: string | null;

    // ✅✅✅ SHEETS (REV SAQUES) — nomes iguais ao Prisma
    revSaquesSheetCsvUrl?: string | null;
    revSaquesSheetId?: string | null;
    revSaquesSheetTab?: string | null;
    revSaquesSheetGid?: string | null;
  };
  kpis: {
    leadsTotal: number;
    leadsActive: number;
    depositsCount: number;
    depositsTotalCents: number;
    ftdCount: number;
    revCents: number;
    salesCents: number;
    salesCount: number;
    trafficCents: number;

    // opcional (se backend implementar)
    revWithdrawalsCents?: number;
  };
};

type SeriesPoint = {
  day?: string;
  label?: string;
  leadsTotal?: number;
  depositsTotalCents?: number;
  revCents?: number;
  salesCents?: number;
  trafficCents?: number;
  ftdCount?: number;
  salesCount?: number;
};

type ExpertSeries = {
  period: { from: string; to: string; group: 'day' | 'week' | 'month' };
  points: SeriesPoint[];
};

type ExpertNotificationRule = {
  expertId: string;
  isActive: boolean;
  times: string[];
  timezone: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

async function uploadExpertPhoto(params: { token: string; expertId: string; file: File }) {
  const { token, expertId, file } = params;
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch(`${API_BASE}/admin/experts/${encodeURIComponent(expertId)}/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || text || 'Falha no upload';
    throw new Error(typeof msg === 'string' ? msg : 'Falha no upload');
  }

  return data;
}

function hasDetails(expert?: ExpertOverview['expert'] | null) {
  const d = String(expert?.description ?? '').trim();
  const y = String(expert?.youtubeUrl ?? '').trim();
  const i = String(expert?.instagramUrl ?? '').trim();
  const w = String(expert?.whatsappUrl ?? '').trim();
  const t = String(expert?.telegramUrl ?? '').trim();
  return !!(d || y || i || w || t);
}

function LinkLine({ label, url }: { label: string; url?: string | null }) {
  const u = String(url ?? '').trim();
  if (!u) return null;
  return (
    <a
      href={u}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white/95 underline decoration-white/20 hover:decoration-white/40 break-all"
    >
      <span className="text-white/50">{label}:</span>
      <span className="text-white/90">
        <Sensitive placeholder="••••••••••">{u}</Sensitive>
      </span>
    </a>
  );
}

function defaultMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const end = new Date(Date.UTC(y, m + 1, 0)); // last day

  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;

  return { from, to };
}

/* ✅✅✅ Helper novo: calcula o range do mês anterior com base no "from" atual (YYYY-MM-DD) */
function previousMonthRangeFrom(fromIso: string) {
  const raw = String(fromIso || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-\d{2}$/);
  const now = new Date();

  const y0 = m ? Number(m[1]) : now.getUTCFullYear();
  const m0 = m ? Number(m[2]) : now.getUTCMonth() + 1; // 1..12

  let y = y0;
  let mm = m0 - 1;
  if (mm <= 0) {
    mm = 12;
    y = y0 - 1;
  }

  const end = new Date(Date.UTC(y, mm, 0)); // último dia do mês anterior (mm é 1..12 aqui, Date.UTC aceita month 0..11, mas usamos truque com dia 0)
  const from = `${y}-${String(mm).padStart(2, '0')}-01`;
  const to = `${y}-${String(mm).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;

  return { from, to };
}

/* -------------------- Notificações helpers (admin) -------------------- */

function normalizeTimeHHMM(v: string) {
  const s = String(v || '').trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return '';
  const [hh, mm] = s.split(':').map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function sortUniqueTimes(times: string[]) {
  const ok = (times || []).map(normalizeTimeHHMM).filter(Boolean);
  const uniq = Array.from(new Set(ok));
  uniq.sort((a, b) => a.localeCompare(b));
  return uniq;
}

/* -------------------- Série helpers (gráfico sem “espaço em branco”) -------------------- */

function hasAnyMetricValue(p?: SeriesPoint | null) {
  if (!p) return false;
  const keys: Array<keyof SeriesPoint> = [
    'leadsTotal',
    'depositsTotalCents',
    'revCents',
    'salesCents',
    'trafficCents',
    'ftdCount',
    'salesCount',
  ];

  for (const k of keys) {
    const v = (p as any)[k];
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (n !== 0) return true;
  }

  return false;
}

function trimSeriesToLastDataPoint(points: SeriesPoint[]) {
  const pts = Array.isArray(points) ? points : [];
  let last = -1;
  for (let i = 0; i < pts.length; i++) {
    if (hasAnyMetricValue(pts[i])) last = i;
  }
  if (last === -1) return pts;
  return pts.slice(0, last + 1);
}

/* -------------------- ✅✅✅ REV SAQUES (CSV direto do Sheets) -------------------- */

function stripAccents(s: string) {
  try {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    return s;
  }
}

function normalizeHeaderKey(s: string) {
  return stripAccents(String(s ?? '').trim())
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 _/.-]/g, '')
    .trim();
}

function parseBRNumber(raw: any) {
  const s0 = String(raw ?? '').trim();
  if (!s0) return NaN;

  // remove moedas e espaços
  let s = s0.replace(/[R$\s]/g, '');

  // se tem vírgula e ponto, assume formato BR: 4.635,00
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // se só tem vírgula, pode ser decimal BR: 4635,5
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // caso padrão
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function looksLikeCentsColumn(headerKey: string) {
  const k = normalizeHeaderKey(headerKey);
  return k.includes('CENT') || k.includes('CENTS') || k.includes('CENTAVO');
}

function toIsoYMD(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function inIsoRange(iso: string, from: string, to: string) {
  // iso no formato YYYY-MM-DD
  return iso >= from && iso <= to;
}

function monthTokenToYM(token: string): { y: number; m: number } | null {
  // aceita: Jan/2026, JAN/2026, 01/2026, 1/2026, 2026-01
  const v = String(token ?? '').trim();
  if (!v) return null;

  const m1 = v.match(/^(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const mm = Number(m1[1]);
    const yy = Number(m1[2]);
    if (mm >= 1 && mm <= 12) return { y: yy, m: mm };
  }

  const m2 = v.match(/^(\d{4})-(\d{2})$/);
  if (m2) {
    const yy = Number(m2[1]);
    const mm = Number(m2[2]);
    if (mm >= 1 && mm <= 12) return { y: yy, m: mm };
  }

  const m3 = v.match(/^([A-Za-z]{3})\/(\d{4})$/);
  if (m3) {
    const mon = m3[1].toLowerCase();
    const yy = Number(m3[2]);
    const map: Record<string, number> = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };
    const mm = map[mon];
    if (mm) return { y: yy, m: mm };
  }

  // pt-BR abreviações comuns
  const m4 = v.match(/^([A-Za-zç]{3,4})\/(\d{4})$/i);
  if (m4) {
    const mon = stripAccents(m4[1].toLowerCase());
    const yy = Number(m4[2]);
    const map: Record<string, number> = {
      jan: 1,
      fev: 2,
      feb: 2,
      mar: 3,
      abr: 4,
      apr: 4,
      mai: 5,
      may: 5,
      jun: 6,
      jul: 7,
      ago: 8,
      aug: 8,
      set: 9,
      sep: 9,
      out: 10,
      oct: 10,
      nov: 11,
      dez: 12,
      dec: 12,
    };
    const mm = map[mon];
    if (mm) return { y: yy, m: mm };
  }

  return null;
}

function monthRangeToIso(y: number, m: number) {
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { from: toIsoYMD(start), to: toIsoYMD(end) };
}

// CSV parser simples (suporta aspas)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (ch === ',' || ch === ';' || ch === '\t')) {
      row.push(cur);
      cur = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      // evita linha totalmente vazia
      if (row.some((c) => String(c).trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  if (row.some((c) => String(c).trim() !== '')) rows.push(row);

  return rows;
}

function buildRevSaquesCsvUrl(expert?: ExpertOverview['expert'] | null) {
  const u = String(expert?.revSaquesSheetCsvUrl ?? '').trim();
  if (u) return u;

  const id = String(expert?.revSaquesSheetId ?? '').trim();
  const gid = String(expert?.revSaquesSheetGid ?? '').trim();
  if (!id) return '';

  // gid pode ser vazio — Google aceita default primeira aba sem gid, mas aqui preferimos usar se existir
  if (gid) {
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=${encodeURIComponent(gid)}&single=true&output=csv`;
  }

  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&single=true&output=csv`;
}

function pickValueColumn(headersNorm: string[]) {
  // prioridade: revWithdrawalsCents
  const idx1 = headersNorm.findIndex((h) => h === 'REVWITHDRAWALSCENTS' || h.includes('REVWITHDRAWALS') || h.includes('WITHDRAWALSCENTS'));
  if (idx1 >= 0) return idx1;

  // depois: colunas com SAQUE / WITHDRAW
  const idx2 = headersNorm.findIndex((h) => h.includes('SAQUE') || h.includes('WITHDRAW'));
  if (idx2 >= 0) return idx2;

  // fallback: segunda coluna
  if (headersNorm.length >= 2) return 1;
  return -1;
}

function pickDayColumn(headersNorm: string[]) {
  const idx = headersNorm.findIndex((h) => h === 'DAY' || h === 'DATA' || h === 'DATE' || h === 'DIA');
  return idx;
}

function pickMonthColumn(headersNorm: string[]) {
  const idx = headersNorm.findIndex((h) => h === 'MES' || h === 'MÊS' || h.includes('MES') || h.includes('MONTH'));
  return idx;
}

async function computeRevSaquesCentsFromCsv(params: { csvUrl: string; from: string; to: string; signal: AbortSignal }) {
  const { csvUrl, from, to, signal } = params;
  const url = `${csvUrl}${csvUrl.includes('?') ? '&' : '?'}ts=${Date.now()}`;

  const res = await fetch(url, { method: 'GET', cache: 'no-store', signal });
  if (!res.ok) return 0;

  const text = await res.text();
  if (!text) return 0;

  const rows = parseCsv(text);
  if (!rows.length) return 0;

  // headers
  const headers = rows[0] || [];
  const headersNorm = headers.map(normalizeHeaderKey);

  const dayCol = pickDayColumn(headersNorm);
  const monthCol = pickMonthColumn(headersNorm);
  const valCol = pickValueColumn(headersNorm);
  if (valCol < 0) return 0;

  const isCents = looksLikeCentsColumn(headersNorm[valCol] || '');

  let sumCents = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const rawVal = row[valCol];
    const n = parseBRNumber(rawVal);
    if (!Number.isFinite(n)) continue;

    // decide se entra no range
    let ok = false;

    // 1) se tiver day, tenta YYYY-MM-DD ou DD/MM/YYYY
    if (dayCol >= 0) {
      const rawDay = String(row[dayCol] ?? '').trim();
      if (rawDay) {
        let iso = '';

        // YYYY-MM-DD
        const m1 = rawDay.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m1) {
          iso = `${m1[1]}-${m1[2]}-${m1[3]}`;
        } else {
          // DD/MM/YYYY
          const m2 = rawDay.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (m2) {
            iso = `${m2[3]}-${m2[2]}-${m2[1]}`;
          }
        }

        if (iso && inIsoRange(iso, from, to)) ok = true;
      }
    }

    // 2) se não entrou por day e tiver mês, aceita token tipo Jan/2026 ou 01/2026
    if (!ok && monthCol >= 0) {
      const rawMonth = String(row[monthCol] ?? '').trim();
      const ym = monthTokenToYM(rawMonth);
      if (ym) {
        const mr = monthRangeToIso(ym.y, ym.m);

        // overlap simples: se o range do mês intercepta o filtro
        const overlap = !(mr.to < from || mr.from > to);
        if (overlap) ok = true;
      }
    }

    // se não tem nenhuma coluna de data/mês, soma tudo
    if (dayCol < 0 && monthCol < 0) ok = true;

    if (!ok) continue;

    // converte valor para cents
    const cents = isCents ? Math.round(n) : Math.round(n * 100);
    if (Number.isFinite(cents)) sumCents += cents;
  }

  return Number.isFinite(sumCents) ? sumCents : 0;
}

export default function AdminExpertDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const expertId = params?.id;

  const tokenRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // período (default mês atual)
  const initialRange = useMemo(() => defaultMonthRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [group, setGroup] = useState<'day' | 'week' | 'month'>('day');

  const [overview, setOverview] = useState<ExpertOverview | null>(null);
  const [series, setSeries] = useState<ExpertSeries | null>(null);

  // detalhes
  const [detailsOpen, setDetailsOpen] = useState(false);

  // drawer editar
  const [editOpen, setEditOpen] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [newPassword, setNewPassword] = useState('');

  // ✅ novos campos editáveis
  const [editDescription, setEditDescription] = useState('');
  const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
  const [editInstagramUrl, setEditInstagramUrl] = useState('');
  const [editWhatsappUrl, setEditWhatsappUrl] = useState('');
  const [editTelegramUrl, setEditTelegramUrl] = useState('');

  // ✅ LEADS sheets
  const [editLeadsSheetCsvUrl, setEditLeadsSheetCsvUrl] = useState('');
  const [editLeadsSheetId, setEditLeadsSheetId] = useState('');
  const [editLeadsSheetTab, setEditLeadsSheetTab] = useState('');
  const [editLeadsSheetGid, setEditLeadsSheetGid] = useState('');

  // ✅ ATIVAÇÕES sheets
  const [editActivationsSheetCsvUrl, setEditActivationsSheetCsvUrl] = useState('');
  const [editActivationsSheetId, setEditActivationsSheetId] = useState('');
  const [editActivationsSheetTab, setEditActivationsSheetTab] = useState('');
  const [editActivationsSheetGid, setEditActivationsSheetGid] = useState('');

  // ✅ MÉTRICAS/RELATÓRIOS sheets
  const [editMetricsSheetCsvUrl, setEditMetricsSheetCsvUrl] = useState('');
  const [editMetricsSheetId, setEditMetricsSheetId] = useState('');
  const [editMetricsSheetTab, setEditMetricsSheetTab] = useState('');
  const [editMetricsSheetGid, setEditMetricsSheetGid] = useState('');

  // ✅✅✅ REV SAQUES sheets (padronizado com Prisma): revSaques*
  const [editRevSaquesSheetCsvUrl, setEditRevSaquesSheetCsvUrl] = useState('');
  const [editRevSaquesSheetId, setEditRevSaquesSheetId] = useState('');
  const [editRevSaquesSheetTab, setEditRevSaquesSheetTab] = useState('');
  const [editRevSaquesSheetGid, setEditRevSaquesSheetGid] = useState('');

  // ✅ NOTIFICAÇÕES (regra)
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifLoadErr, setNotifLoadErr] = useState('');
  const [notifSaveErr, setNotifSaveErr] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);

  const [notifIsActive, setNotifIsActive] = useState(true);
  const [notifTimezone, setNotifTimezone] = useState('America/Sao_Paulo');
  const [notifTimes, setNotifTimes] = useState<string[]>([]);
  const [notifNewTime, setNotifNewTime] = useState('09:00');

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ✅✅✅ Ref novo: quando clicar em "MÊS ANTERIOR" ele aplica automaticamente após atualizar o state */
  const applyAfterRangeChangeRef = useRef(false);

  /* ✅✅✅ estado local: REV SAQUES somado direto do CSV */
  const [revSaquesCents, setRevSaquesCents] = useState(0);
  const revSaquesAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace('/login');
      return;
    }
    tokenRef.current = t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadAll(opts?: { silent?: boolean }) {
    if (!expertId) return;
    const silent = !!opts?.silent;

    if (!silent) {
      setErr('');
      setLoading(true);
    }

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const ts = Date.now();

      const [ov, se] = await Promise.all([
        apiFetch<ExpertOverview>(`/admin/experts/${encodeURIComponent(expertId)}/overview?from=${from}&to=${to}&ts=${ts}`, { token }),
        apiFetch<ExpertSeries>(`/admin/experts/${encodeURIComponent(expertId)}/series?from=${from}&to=${to}&group=${group}&ts=${ts}`, {
          token,
        }),
      ]);

      setOverview(ov);
      setSeries(se);

      setEditEmail(ov?.expert?.email || '');
      setEditIsActive(!!ov?.expert?.isActive);

      // ✅ hydrate novos campos
      setEditDescription(String(ov?.expert?.description ?? ''));
      setEditYoutubeUrl(String(ov?.expert?.youtubeUrl ?? ''));
      setEditInstagramUrl(String(ov?.expert?.instagramUrl ?? ''));
      setEditWhatsappUrl(String(ov?.expert?.whatsappUrl ?? ''));
      setEditTelegramUrl(String(ov?.expert?.telegramUrl ?? ''));

      // ✅ hydrate leads sheets
      setEditLeadsSheetCsvUrl(String(ov?.expert?.leadsSheetCsvUrl ?? ''));
      setEditLeadsSheetId(String(ov?.expert?.leadsSheetId ?? ''));
      setEditLeadsSheetTab(String(ov?.expert?.leadsSheetTab ?? ''));
      setEditLeadsSheetGid(String(ov?.expert?.leadsSheetGid ?? ''));

      // ✅ hydrate ativações sheets
      setEditActivationsSheetCsvUrl(String(ov?.expert?.activationsSheetCsvUrl ?? ''));
      setEditActivationsSheetId(String(ov?.expert?.activationsSheetId ?? ''));
      setEditActivationsSheetTab(String(ov?.expert?.activationsSheetTab ?? ''));
      setEditActivationsSheetGid(String(ov?.expert?.activationsSheetGid ?? ''));

      // ✅ hydrate métricas sheets
      setEditMetricsSheetCsvUrl(String(ov?.expert?.metricsSheetCsvUrl ?? ''));
      setEditMetricsSheetId(String(ov?.expert?.metricsSheetId ?? ''));
      setEditMetricsSheetTab(String(ov?.expert?.metricsSheetTab ?? ''));
      setEditMetricsSheetGid(String(ov?.expert?.metricsSheetGid ?? ''));

      // ✅✅✅ hydrate REV SAQUES sheets (Prisma: revSaques*)
      setEditRevSaquesSheetCsvUrl(String(ov?.expert?.revSaquesSheetCsvUrl ?? ''));
      setEditRevSaquesSheetId(String(ov?.expert?.revSaquesSheetId ?? ''));
      setEditRevSaquesSheetTab(String(ov?.expert?.revSaquesSheetTab ?? ''));
      setEditRevSaquesSheetGid(String(ov?.expert?.revSaquesSheetGid ?? ''));

      // ✅ carregar regra de notificações (se existir no backend)
      if (!notifLoaded) {
        setNotifLoadErr('');
        try {
          const rule = await apiFetch<ExpertNotificationRule>(`/admin/experts/${encodeURIComponent(expertId)}/notification-rule?ts=${ts}`, {
            token,
          });

          setNotifIsActive(rule?.isActive !== false);
          setNotifTimezone(String(rule?.timezone ?? 'America/Sao_Paulo') || 'America/Sao_Paulo');
          setNotifTimes(sortUniqueTimes(Array.isArray(rule?.times) ? rule.times : []));
          setNotifLoaded(true);
        } catch (e: any) {
          setNotifLoaded(true);
          setNotifLoadErr(typeof e?.message === 'string' ? e.message : 'Falha ao carregar notificações');
          setNotifIsActive(true);
          setNotifTimezone('America/Sao_Paulo');
          setNotifTimes([]);
        }
      }
    } catch (e: any) {
      if (!silent) {
        setErr(typeof e?.message === 'string' ? e.message : 'Falha ao carregar dados do expert');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!tokenRef.current) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertId]);

  /* ✅✅✅ Auto-aplicar quando clicar em “MÊS ANTERIOR” (state muda e a gente chama loadAll logo em seguida) */
  useEffect(() => {
    if (!tokenRef.current || !expertId) return;
    if (!applyAfterRangeChangeRef.current) return;

    applyAfterRangeChangeRef.current = false;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, expertId]);

  // ✅ Auto-refresh (tempo real)
  useEffect(() => {
    if (!tokenRef.current || !expertId) return;

    const REFRESH_MS = 15000;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      if (document.hidden) return;
      if (editOpen) return;
      if (uploading) return;
      loadAll({ silent: true });
    };

    tick();

    const id = window.setInterval(tick, REFRESH_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);

    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expertId, from, to, group, editOpen, uploading]);

  function applyFilters() {
    loadAll();
  }

  /* ✅✅✅ Botão novo: MÊS ANTERIOR (ajusta range e aplica) */
  function goPreviousMonth() {
    const r = previousMonthRangeFrom(from);
    setFrom(r.from);
    setTo(r.to);
    applyAfterRangeChangeRef.current = true;
  }

  function openEdit() {
    setUploadErr('');
    setNotifSaveErr('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');

    setEditOpen(true);
    const prev = document.body.style.overflow;
    document.body.dataset.prevOverflow = prev;
    document.body.style.overflow = 'hidden';
  }

  function closeEdit() {
    setEditOpen(false);
    setUploadErr('');
    setNotifSaveErr('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');

    const prev = document.body.dataset.prevOverflow ?? '';
    document.body.style.overflow = prev;
    delete document.body.dataset.prevOverflow;
  }

  function pickFile() {
    setUploadErr('');
    fileInputRef.current?.click();
  }

  async function onFileSelected(file?: File) {
    setUploadErr('');
    if (!file || !expertId) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) return setUploadErr('Arquivo inválido. Envie png/jpg/jpeg/webp.');
    if (file.size > 5 * 1024 * 1024) return setUploadErr('Arquivo muito grande. Limite: 5MB.');

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const local = URL.createObjectURL(file);
    setPreviewUrl(local);

    setUploading(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      await uploadExpertPhoto({ token, expertId, file });
      await loadAll();

      URL.revokeObjectURL(local);
      setPreviewUrl('');
    } catch (e: any) {
      setUploadErr(typeof e?.message === 'string' ? e.message : 'Falha ao enviar foto');
    } finally {
      setUploading(false);
    }
  }

  function addNotifTime() {
    const t = normalizeTimeHHMM(notifNewTime);
    if (!t) return;
    const next = sortUniqueTimes([...(notifTimes || []), t]).slice(0, 10);
    setNotifTimes(next);
  }

  function removeNotifTime(t: string) {
    setNotifTimes((prev) => (prev || []).filter((x) => x !== t));
  }

  async function saveNotificationRule() {
    if (!expertId) return;
    const token = tokenRef.current;
    if (!token) return;

    setNotifSaving(true);
    setNotifSaveErr('');
    try {
      await apiFetch<any>(`/admin/experts/${encodeURIComponent(expertId)}/notification-rule`, {
        token,
        method: 'PATCH',
        body: {
          isActive: !!notifIsActive,
          timezone: String(notifTimezone || '').trim() || 'America/Sao_Paulo',
          times: sortUniqueTimes(notifTimes || []).slice(0, 10),
        },
      });
    } catch (e: any) {
      setNotifSaveErr(typeof e?.message === 'string' ? e.message : 'Falha ao salvar notificações');
      throw e;
    } finally {
      setNotifSaving(false);
    }
  }

  async function saveProfile() {
    if (!expertId) return;

    const token = tokenRef.current;
    if (!token) return;

    // 1) salva perfil
    await apiFetch<any>(`/admin/experts/${encodeURIComponent(expertId)}`, {
      token,
      method: 'PATCH',
      body: {
        email: editEmail.trim(),
        isActive: editIsActive,

        // ✅ novos campos
        description: editDescription,
        youtubeUrl: editYoutubeUrl,
        instagramUrl: editInstagramUrl,
        whatsappUrl: editWhatsappUrl,
        telegramUrl: editTelegramUrl,

        // ✅ leads sheets
        leadsSheetCsvUrl: editLeadsSheetCsvUrl,
        leadsSheetId: editLeadsSheetId,
        leadsSheetTab: editLeadsSheetTab,
        leadsSheetGid: editLeadsSheetGid,

        // ✅ ativações sheets
        activationsSheetCsvUrl: editActivationsSheetCsvUrl,
        activationsSheetId: editActivationsSheetId,
        activationsSheetTab: editActivationsSheetTab,
        activationsSheetGid: editActivationsSheetGid,

        // ✅ métricas sheets
        metricsSheetCsvUrl: editMetricsSheetCsvUrl,
        metricsSheetId: editMetricsSheetId,
        metricsSheetTab: editMetricsSheetTab,
        metricsSheetGid: editMetricsSheetGid,

        // ✅✅✅ rev saques sheet (Prisma: revSaques*)
        revSaquesSheetCsvUrl: editRevSaquesSheetCsvUrl,
        revSaquesSheetId: editRevSaquesSheetId,
        revSaquesSheetTab: editRevSaquesSheetTab,
        revSaquesSheetGid: editRevSaquesSheetGid,
      },
    });

    // 2) senha (se tiver)
    if (newPassword.trim()) {
      await apiFetch<any>(`/admin/experts/${encodeURIComponent(expertId)}/password`, {
        token,
        method: 'PATCH',
        body: { password: newPassword },
      });
    }

    // 3) regra de notificações
    try {
      await saveNotificationRule();
    } catch {
      // mantém notifSaveErr visível
    }

    await loadAll();
    closeEdit();
  }

  function goLeads() {
    if (!expertId) return;
    const qs = new URLSearchParams({ from, to }).toString();
    router.push(`/admin/experts/${encodeURIComponent(expertId)}/leads?${qs}`);
  }

  function goActivations() {
    if (!expertId) return;
    const qs = new URLSearchParams({ from, to }).toString();
    router.push(`/admin/experts/${encodeURIComponent(expertId)}/ativacoes?${qs}`);
  }

  const expertEmail = overview?.expert?.email || '';
  const photo = resolvePhotoUrl(overview?.expert?.photoUrl);
  const avatar = previewUrl ? previewUrl : photo;

  // ✅ LUCRO = (VENDAS + REV) - TRÁFEGO (mantido e usado como tooltip em "Tráfego" pra não virar variável inutilizada)
  const lucroCents = useMemo(() => {
    if (!overview) return 0;
    const sales = Number(overview.kpis.salesCents || 0);
    const rev = Number(overview.kpis.revCents || 0);
    const traffic = Number(overview.kpis.trafficCents || 0);
    return sales + rev - traffic;
  }, [overview]);

  const lucroLabel = lucroCents >= 0 ? 'Resultado positivo no período.' : 'Resultado negativo no período.';

  // ✅ Ticket médio = Depósitos / FTD
  const ticketMedioCents = useMemo(() => {
    const deposits = Number(overview?.kpis?.depositsTotalCents || 0);
    const ftd = Number(overview?.kpis?.ftdCount || 0);
    if (!ftd || ftd <= 0) return 0;
    return Math.round(deposits / ftd);
  }, [overview]);

  // ✅ Conversão FTD = FTD / Leads
  const convFtdPct = useMemo(() => {
    const leads = Number(overview?.kpis?.leadsTotal || 0);
    const ftd = Number(overview?.kpis?.ftdCount || 0);
    if (!leads || leads <= 0) return 0;
    return (ftd / leads) * 100;
  }, [overview]);

  // ✅ pontos pro gráfico
  const chartPoints = useMemo<ChartPoint[]>(() => {
    const pts = trimSeriesToLastDataPoint(series?.points ?? []);
    return pts.map((p) => ({
      label: String(p.label ?? p.day ?? ''),

      // contagens
      leadsTotal: Number(p.leadsTotal ?? 0),
      leadsActive: 0,
      ftdCount: Number(p.ftdCount ?? 0),
      salesCount: Number(p.salesCount ?? 0),

      // money (cents -> BRL)
      depositsBRL: Number(p.depositsTotalCents ?? 0) / 100,
      revBRL: Number(p.revCents ?? 0) / 100,
      salesBRL: Number(p.salesCents ?? 0) / 100,
      trafficBRL: Number(p.trafficCents ?? 0) / 100,
    }));
  }, [series]);

  const detailsAvailable = hasDetails(overview?.expert);

  const topYoutube = overview?.expert?.youtubeUrl ?? '';
  const topInstagram = overview?.expert?.instagramUrl ?? '';
  const topWhatsapp = overview?.expert?.whatsappUrl ?? '';
  const topTelegram = overview?.expert?.telegramUrl ?? '';

  const hasAnyTopIcon =
    String(topYoutube).trim() || String(topInstagram).trim() || String(topWhatsapp).trim() || String(topTelegram).trim();

  const notifCount = (notifTimes || []).length;

  /* ✅✅✅ Efeito: soma REV SAQUES direto do CSV (sem mostrar "Fonte" nem alertas) */
  useEffect(() => {
    const exp = overview?.expert;
    const csvUrl = buildRevSaquesCsvUrl(exp);

    // cancela request anterior
    if (revSaquesAbortRef.current) {
      try {
        revSaquesAbortRef.current.abort();
      } catch {}
    }

    if (!csvUrl || !from || !to) {
      setRevSaquesCents(0);
      return;
    }

    const ac = new AbortController();
    revSaquesAbortRef.current = ac;

    (async () => {
      try {
        const sum = await computeRevSaquesCentsFromCsv({ csvUrl, from, to, signal: ac.signal });
        setRevSaquesCents(Number.isFinite(sum) ? sum : 0);
      } catch {
        // sem avisos na UI (pedido do usuário)
        setRevSaquesCents(0);
      }
    })();

    return () => {
      try {
        ac.abort();
      } catch {}
    };
  }, [overview?.expert?.revSaquesSheetCsvUrl, overview?.expert?.revSaquesSheetId, overview?.expert?.revSaquesSheetGid, from, to]);

  return (
    <div className="relative">
      {/* topo */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/admin/experts')}
              className={cx(
                'h-10 px-3 rounded-xl border border-white/10',
                'bg-white/[0.03] hover:bg-white/[0.06] transition',
                'text-white/85 text-sm font-medium inline-flex items-center gap-2',
              )}
              title="Voltar"
            >
              <Icon name="back" />
              Voltar
            </button>

            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cx(
                  'h-12 w-12 rounded-2xl border border-white/10 overflow-hidden grid place-items-center',
                  'bg-gradient-to-br from-[#3E78FF]/20 via-white/[0.06] to-[#6A5CFF]/18',
                )}
                title={expertEmail}
              >
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Foto do expert" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-white/85 text-xs font-semibold tracking-wide">{getInitials(expertEmail)}</div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-white/92 font-semibold truncate">
                    <Sensitive placeholder="••••••@••••">{expertEmail || 'Expert'}</Sensitive>
                  </div>

                  {hasAnyTopIcon ? (
                    <Sensitive placeholder="">
                      <div className="flex items-center gap-2">
                        <SocialIcon kind="youtube" href={topYoutube} title="Abrir YouTube" />
                        <SocialIcon kind="instagram" href={topInstagram} title="Abrir Instagram" />
                        <SocialIcon kind="whatsapp" href={topWhatsapp} title="Abrir WhatsApp" />
                        <SocialIcon kind="telegram" href={topTelegram} title="Abrir Telegram" />
                      </div>
                    </Sensitive>
                  ) : null}
                </div>

                <div className="text-white/45 text-xs truncate">
                  ID: <Sensitive placeholder="••••••">{expertId}</Sensitive>
                  <span className="text-white/25"> • </span>
                  Notificações:{' '}
                  <span className="text-white/70">
                    <Sensitive placeholder="•• horário(s)">{notifIsActive ? `${notifCount} horário(s)` : 'desativadas'}</Sensitive>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ações */}
          <div className="flex items-center gap-2">
            {detailsAvailable ? (
              <button
                onClick={() => setDetailsOpen((v) => !v)}
                className={cx(
                  'h-10 px-4 rounded-xl border border-white/10',
                  detailsOpen ? 'bg-white/[0.08] text-white/90' : 'bg-white/[0.03] hover:bg-white/[0.06] text-white/85',
                  'transition text-sm font-medium inline-flex items-center gap-2',
                )}
                title="Detalhes"
              >
                <Icon name="info" />
                Detalhes
              </button>
            ) : null}

            <button
              onClick={goLeads}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-white/[0.03] hover:bg-white/[0.06] transition',
                'text-white/85 text-sm font-medium inline-flex items-center gap-2',
              )}
              title="Ver leads"
            >
              <Icon name="list" />
              Ver leads
            </button>

            <button
              onClick={goActivations}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-white/[0.03] hover:bg-white/[0.06] transition',
                'text-white/85 text-sm font-medium inline-flex items-center gap-2',
              )}
              title="Ver ativações"
            >
              <Icon name="calendar" />
              Ver ativações
            </button>

            <button
              onClick={openEdit}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-white/[0.03] hover:bg-white/[0.06] transition',
                'text-white/85 text-sm font-medium inline-flex items-center gap-2',
              )}
              title="Editar perfil"
            >
              <Icon name="edit" />
              Editar perfil
            </button>
          </div>
        </div>

        {/* painel detalhes */}
        {detailsAvailable && detailsOpen ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="text-white/85 font-semibold tracking-tight">Detalhes do expert</div>

            {String(overview?.expert?.description ?? '').trim() ? (
              <div className="mt-3 text-white/80 text-sm whitespace-pre-wrap">
                <Sensitive placeholder="••••••••••">{String(overview?.expert?.description ?? '').trim()}</Sensitive>
              </div>
            ) : (
              <div className="mt-3 text-white/45 text-sm">Sem descrição.</div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <LinkLine label="YouTube" url={overview?.expert?.youtubeUrl ?? ''} />
              <LinkLine label="Instagram" url={overview?.expert?.instagramUrl ?? ''} />
              <LinkLine label="WhatsApp" url={overview?.expert?.whatsappUrl ?? ''} />
              <LinkLine label="Telegram" url={overview?.expert?.telegramUrl ?? ''} />
            </div>
          </div>
        ) : null}

        {/* filtros */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as any)}
              className="h-10 px-3 rounded-xl border border-white/10 bg-black/30 text-white/85 text-sm outline-none"
            >
              <option value="day">Diário</option>
              <option value="week">Semanal</option>
              <option value="month">Mensal</option>
            </select>

            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              className="h-10 px-3 rounded-xl border border-white/10 bg-black/30 text-white/85 text-sm outline-none"
            />

            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              type="date"
              className="h-10 px-3 rounded-xl border border-white/10 bg-black/30 text-white/85 text-sm outline-none"
            />

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

            {/* ✅✅✅ Botão novo: MÊS ANTERIOR */}
            <button
              onClick={goPreviousMonth}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-white/[0.03] hover:bg-white/[0.06] transition',
                'text-white/85 text-sm font-medium',
              )}
              title="Seleciona automaticamente o mês anterior"
            >
              Mês anterior
            </button>
          </div>

          <div className="text-white/40 text-sm md:ml-auto">
            Série por período • {from} → {to}
          </div>
        </div>
      </div>

      {err ? (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
      ) : null}

      {/* cards */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.03] transition">
          <div className="text-white/55 text-xs">Leads</div>
          <div className="mt-2 text-white/92 font-semibold text-3xl">
            <Sensitive placeholder="—">{loading ? '—' : Number(overview?.kpis.leadsTotal || 0)}</Sensitive>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.03] transition">
          <div className="text-white/55 text-xs">Ticket Médio</div>
          <div className="mt-2 text-white/92 font-semibold text-3xl">
            <Sensitive placeholder="—">{loading ? '—' : moneyBRLFromCents(ticketMedioCents)}</Sensitive>
          </div>
          <div className="mt-2 text-white/45 text-xs">
            FTD: <Sensitive placeholder="—">{loading ? '—' : Number(overview?.kpis.ftdCount || 0)}</Sensitive>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.03] transition">
          <div className="text-white/55 text-xs">Depósitos</div>
          <div className="mt-2 text-white/92 font-semibold text-3xl">
            <Sensitive placeholder="—">
              {loading ? '—' : moneyBRLFromCents(Number(overview?.kpis.depositsTotalCents || 0))}
            </Sensitive>
          </div>
          <div className="mt-2 text-white/45 text-xs">
            FTD: <Sensitive placeholder="—">{loading ? '—' : Number(overview?.kpis.ftdCount || 0)}</Sensitive>
          </div>
        </div>

        {/* ✅✅✅ REV removido do dashboard (mantém no gráfico) */}

        {/* ✅✅✅ REV SAQUES (somado do CSV no admin, sem "Fonte" e sem avisos) */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.03] transition">
          <div className="text-white/55 text-xs">REV SAQUES</div>
          <div className="mt-2 text-white/92 font-semibold text-3xl">
            <Sensitive placeholder="—">{loading ? '—' : moneyBRLFromCents(Number(revSaquesCents || 0))}</Sensitive>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.03] transition">
          <div className="text-white/55 text-xs">Vendas</div>
          <div className="mt-2 text-white/92 font-semibold text-3xl">
            <Sensitive placeholder="—">{loading ? '—' : moneyBRLFromCents(Number(overview?.kpis.salesCents || 0))}</Sensitive>
          </div>
          <div className="mt-2 text-white/45 text-xs">
            Qtd vendas: <Sensitive placeholder="—">{loading ? '—' : Number(overview?.kpis.salesCount || 0)}</Sensitive>
          </div>
        </div>

        <div
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.03] transition"
          title={lucroLabel}
        >
          <div className="text-white/55 text-xs">Tráfego (gasto)</div>
          <div className="mt-2 text-white/92 font-semibold text-3xl">
            <Sensitive placeholder="—">{loading ? '—' : moneyBRLFromCents(Number(overview?.kpis.trafficCents || 0))}</Sensitive>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.03] transition">
          <div className="text-white/55 text-xs">Taxa de Conversão FTD’s (FTD / Leads)</div>
          <div className={cx('mt-2 font-semibold text-3xl', convFtdPct >= 30 ? 'text-emerald-200' : 'text-red-200')}>
            <Sensitive placeholder="—">{loading ? '—' : pctBR(convFtdPct)}</Sensitive>
          </div>
          <div className="mt-2 text-white/45 text-xs">
            Leads: <Sensitive placeholder="—">{loading ? '—' : Number(overview?.kpis.leadsTotal || 0)}</Sensitive>
            <span className="text-white/25"> • </span>
            FTD: <Sensitive placeholder="—">{loading ? '—' : Number(overview?.kpis.ftdCount || 0)}</Sensitive>
          </div>
        </div>
      </div>

      {/* gráfico */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-white/85 font-semibold tracking-tight">Métricas</div>
            <div className="text-white/40 text-sm mt-1">
              Série por período • {from} → {to}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Sensitive
            placeholder={
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-white/60 text-sm text-center">
                Dados ocultos
              </div>
            }
          >
            <ExpertLineChart
              points={chartPoints}
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
          </Sensitive>
        </div>
      </div>

      {/* Drawer editar perfil */}
      {editOpen ? (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/60" onMouseDown={closeEdit} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 w-full max-w-[620px] p-3">
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
                  <div className="text-white/90 font-semibold tracking-tight">Editar expert</div>
                  <div className="text-white/45 text-sm mt-1 truncate">
                    <Sensitive placeholder="••••••@••••">{expertEmail}</Sensitive>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeEdit}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center text-white/80"
                  aria-label="Fechar"
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="p-5 overflow-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                {/* avatar + upload */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div
                      className={cx(
                        'h-[88px] w-[88px] rounded-2xl border border-white/10 overflow-hidden',
                        'bg-gradient-to-br from-[#3E78FF]/22 via-white/[0.06] to-[#6A5CFF]/20',
                      )}
                    >
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="Foto do expert" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center">
                          <div className="text-white/85 font-semibold text-lg tracking-wide">{getInitials(expertEmail)}</div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={pickFile}
                      disabled={uploading}
                      className={cx(
                        'absolute -bottom-2 -right-2 h-10 w-10 rounded-xl border border-white/10',
                        'bg-[#0B1022]/90 backdrop-blur hover:bg-white/[0.06] transition grid place-items-center',
                        uploading && 'opacity-60 cursor-not-allowed',
                      )}
                      title="Alterar foto"
                    >
                      <Icon name="upload" />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = '';
                        onFileSelected(f);
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-white/92 font-semibold truncate">
                      <Sensitive placeholder="••••••@••••">{expertEmail}</Sensitive>
                    </div>
                    <div className="text-white/45 text-xs mt-1">
                      ID: <Sensitive placeholder="••••••">{expertId}</Sensitive>
                    </div>

                    {uploadErr ? (
                      <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
                        {uploadErr}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* campos */}
                <div className="mt-6 grid grid-cols-1 gap-4">
                  {/* básicos */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-white/80 text-sm font-semibold">Básico</div>

                    <div>
                      <div className="text-white/55 text-xs mb-2">E-mail</div>
                      <input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div>
                        <div className="text-white/80 text-sm font-medium">Status</div>
                        <div className="text-white/45 text-xs mt-1">Ativar/Inativar expert</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditIsActive((v) => !v)}
                        className={cx(
                          'h-9 px-4 rounded-xl border border-white/10 text-sm font-medium transition',
                          editIsActive
                            ? 'bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/16'
                            : 'bg-white/[0.02] text-white/70 hover:bg-white/[0.05]',
                        )}
                      >
                        {editIsActive ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>

                    <div>
                      <div className="text-white/55 text-xs mb-2">Nova senha (opcional)</div>
                      <input
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        type="password"
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                        placeholder="Se deixar vazio, não muda"
                      />
                      <div className="text-white/45 text-xs mt-2">Se deixar vazio, a senha não muda.</div>
                    </div>
                  </div>

                  {/* ✅ NOTIFICAÇÕES */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-white/80 text-sm font-semibold">Notificações de ativação</div>
                        <div className="text-white/45 text-xs mt-1">
                          Defina quantas notificações por dia (horários) e o timezone do expert.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setNotifIsActive((v) => !v)}
                        className={cx(
                          'h-9 px-4 rounded-xl border border-white/10 text-sm font-medium transition shrink-0',
                          notifIsActive
                            ? 'bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/16'
                            : 'bg-white/[0.02] text-white/70 hover:bg-white/[0.05]',
                        )}
                        title="Ativar/Inativar notificações"
                      >
                        {notifIsActive ? 'Ativas' : 'Inativas'}
                      </button>
                    </div>

                    {notifLoadErr ? (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100 text-sm">
                        {notifLoadErr}
                        <div className="text-amber-100/80 text-xs mt-1">
                          (Se o backend ainda não tem esse endpoint, é normal. Assim que tiver, isso some.)
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-white/55 text-xs mb-2">Timezone (IANA)</div>
                        <input
                          value={notifTimezone}
                          onChange={(e) => setNotifTimezone(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="America/Sao_Paulo"
                          list="tzlist"
                        />
                        <datalist id="tzlist">
                          <option value="America/Sao_Paulo" />
                          <option value="America/Fortaleza" />
                          <option value="America/Manaus" />
                          <option value="America/Belem" />
                          <option value="America/Recife" />
                          <option value="Europe/Lisbon" />
                          <option value="Europe/Madrid" />
                          <option value="UTC" />
                        </datalist>
                        <div className="text-white/45 text-xs mt-2">Ex: America/Sao_Paulo</div>
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">Adicionar horário</div>
                        <div className="flex items-center gap-2">
                          <input
                            value={notifNewTime}
                            onChange={(e) => setNotifNewTime(e.target.value)}
                            type="time"
                            className="flex-1 h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          />
                          <button
                            type="button"
                            onClick={addNotifTime}
                            disabled={(notifTimes || []).length >= 10}
                            className={cx(
                              'h-11 px-4 rounded-xl border border-white/10 text-sm font-medium transition',
                              (notifTimes || []).length >= 10
                                ? 'bg-white/[0.02] text-white/40 cursor-not-allowed'
                                : 'bg-white/[0.03] hover:bg-white/[0.06] text-white/85',
                            )}
                            title="Adicionar"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="text-white/45 text-xs mt-2">
                          Máximo: 10 horários. Total atual: <span className="text-white/70">{notifCount}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-white/55 text-xs mb-2">Horários (HH:mm)</div>

                      {(notifTimes || []).length ? (
                        <div className="flex flex-wrap gap-2">
                          {notifTimes.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-sm text-white/80"
                            >
                              <span className="font-medium text-white/90">{t}</span>
                              <button
                                type="button"
                                onClick={() => removeNotifTime(t)}
                                className="text-white/55 hover:text-white/90 transition"
                                aria-label={`Remover ${t}`}
                                title="Remover"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-white/55 text-sm">
                          Nenhum horário definido. (Sem horários, não envia notificação)
                        </div>
                      )}
                    </div>

                    {notifSaveErr ? (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
                        {notifSaveErr}
                      </div>
                    ) : null}

                    <div className="text-white/45 text-xs">
                      Dica: se quiser “2 notificações”, adicione 2 horários. Ex: 09:00 e 18:00.
                    </div>
                  </div>

                  {/* detalhes */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-white/80 text-sm font-semibold">Detalhes do expert (opcional)</div>

                    <div>
                      <div className="text-white/55 text-xs mb-2">Descrição</div>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full min-h-[110px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white/85 text-sm outline-none focus:border-white/20"
                        placeholder="Ex: perfil, estratégia, como ele trabalha..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-white/55 text-xs mb-2">YouTube (URL)</div>
                        <input
                          value={editYoutubeUrl}
                          onChange={(e) => setEditYoutubeUrl(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="https://youtube.com/@..."
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">Instagram (URL)</div>
                        <input
                          value={editInstagramUrl}
                          onChange={(e) => setEditInstagramUrl(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="https://instagram.com/..."
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">WhatsApp (URL)</div>
                        <input
                          value={editWhatsappUrl}
                          onChange={(e) => setEditWhatsappUrl(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="https://wa.me/55..."
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">Telegram (URL)</div>
                        <input
                          value={editTelegramUrl}
                          onChange={(e) => setEditTelegramUrl(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="https://t.me/..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* sheets - leads */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-white/80 text-sm font-semibold">Google Sheets / CSV (Leads) (opcional)</div>

                    <div>
                      <div className="text-white/55 text-xs mb-2">CSV URL</div>
                      <input
                        value={editLeadsSheetCsvUrl}
                        onChange={(e) => setEditLeadsSheetCsvUrl(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                        placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-white/55 text-xs mb-2">Sheet ID</div>
                        <input
                          value={editLeadsSheetId}
                          onChange={(e) => setEditLeadsSheetId(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="1AbC..."
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">Aba (Tab)</div>
                        <input
                          value={editLeadsSheetTab}
                          onChange={(e) => setEditLeadsSheetTab(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="Leads"
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">GID</div>
                        <input
                          value={editLeadsSheetGid}
                          onChange={(e) => setEditLeadsSheetGid(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="0"
                        />
                      </div>

                      <div className="text-white/45 text-xs md:self-end">Pode deixar tudo em branco.</div>
                    </div>
                  </div>

                  {/* sheets - ativações */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-white/80 text-sm font-semibold">Google Sheets / CSV — Ativações (opcional)</div>

                    <div>
                      <div className="text-white/55 text-xs mb-2">CSV URL (Ativações)</div>
                      <input
                        value={editActivationsSheetCsvUrl}
                        onChange={(e) => setEditActivationsSheetCsvUrl(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                        placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-white/55 text-xs mb-2">Sheet ID (Ativações)</div>
                        <input
                          value={editActivationsSheetId}
                          onChange={(e) => setEditActivationsSheetId(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="1AbC..."
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">Aba (Tab) (Ativações)</div>
                        <input
                          value={editActivationsSheetTab}
                          onChange={(e) => setEditActivationsSheetTab(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="Ativacoes"
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">GID (Ativações)</div>
                        <input
                          value={editActivationsSheetGid}
                          onChange={(e) => setEditActivationsSheetGid(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="0"
                        />
                      </div>

                      <div className="text-white/45 text-xs md:self-end">Pode deixar tudo em branco.</div>
                    </div>
                  </div>

                  {/* sheets - métricas/relatórios */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-white/80 text-sm font-semibold">
                      Google Sheets / CSV — Relatórios (Métricas diárias) (opcional)
                    </div>
                    <div className="text-white/45 text-xs -mt-1">
                      Colunas esperadas:{' '}
                      <span className="text-white/70">
                        day, leadsTotal, leadsActive, depositsTotalCents, ftdCount, revCents, salesCents, salesCount, trafficCents
                      </span>
                    </div>

                    <div>
                      <div className="text-white/55 text-xs mb-2">CSV URL (Relatórios)</div>
                      <input
                        value={editMetricsSheetCsvUrl}
                        onChange={(e) => setEditMetricsSheetCsvUrl(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                        placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-white/55 text-xs mb-2">Sheet ID (Relatórios)</div>
                        <input
                          value={editMetricsSheetId}
                          onChange={(e) => setEditMetricsSheetId(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="1AbC..."
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">Aba (Tab) (Relatórios)</div>
                        <input
                          value={editMetricsSheetTab}
                          onChange={(e) => setEditMetricsSheetTab(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="Relatorios"
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">GID (Relatórios)</div>
                        <input
                          value={editMetricsSheetGid}
                          onChange={(e) => setEditMetricsSheetGid(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="0"
                        />
                      </div>

                      <div className="text-white/45 text-xs md:self-end">Pode deixar tudo em branco.</div>
                    </div>
                  </div>

                  {/* ✅✅✅ sheets - REV SAQUES */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-white/80 text-sm font-semibold">Google Sheets / CSV — REV SAQUES (opcional)</div>
                    <div className="text-white/45 text-xs -mt-1">
                      Colunas esperadas:{' '}
                      <span className="text-white/70">day, revWithdrawalsCents</span>
                    </div>

                    <div>
                      <div className="text-white/55 text-xs mb-2">CSV URL (REV SAQUES)</div>
                      <input
                        value={editRevSaquesSheetCsvUrl}
                        onChange={(e) => setEditRevSaquesSheetCsvUrl(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                        placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-white/55 text-xs mb-2">Sheet ID (REV SAQUES)</div>
                        <input
                          value={editRevSaquesSheetId}
                          onChange={(e) => setEditRevSaquesSheetId(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="1AbC..."
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">Aba (Tab) (REV SAQUES)</div>
                        <input
                          value={editRevSaquesSheetTab}
                          onChange={(e) => setEditRevSaquesSheetTab(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="RevSaques"
                        />
                      </div>

                      <div>
                        <div className="text-white/55 text-xs mb-2">GID (REV SAQUES)</div>
                        <input
                          value={editRevSaquesSheetGid}
                          onChange={(e) => setEditRevSaquesSheetGid(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          placeholder="0"
                        />
                      </div>

                      <div className="text-white/45 text-xs md:self-end">Pode deixar tudo em branco.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition text-white/80 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={notifSaving}
                  className={cx(
                    'h-10 px-4 rounded-xl border border-white/10',
                    'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                    'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                    'text-sm font-medium',
                    notifSaving && 'opacity-70 cursor-wait',
                  )}
                  title={notifSaving ? 'Salvando...' : 'Salvar'}
                >
                  {notifSaving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
