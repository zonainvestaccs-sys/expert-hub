// src/admin/admin.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UserRole } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import * as argon2 from 'argon2';

// =========================
// Consts
// =========================
const DEFAULT_FROM = '2000-01-01';
const DEFAULT_TO = '2099-12-31';

// =========================
// Date helpers
// =========================
function parseDateRange(from?: string, to?: string) {
  if (!from || !to) throw new Error('from/to required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error('from invalid (YYYY-MM-DD)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error('to invalid (YYYY-MM-DD)');

  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  return { start, end };
}

function defaultYearRange() {
  const now = new Date();
  const y = now.getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

function isoDayLabel(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + days);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function startOfWeekUTC(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0 dom ... 6 sab
  const diff = dow === 0 ? -6 : 1 - dow; // segunda
  x.setUTCDate(x.getUTCDate() + diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function monthKeyUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// =========================
// CSV helpers (Sheets)
// =========================
function normKey(v: any) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseNumLoose(v: any) {
  const s = String(v ?? '').trim();
  if (!s) return 0;

  const cleaned = s
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDateLooseISO(v: any) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  // dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return s;
}

function toBRDateLabel(isoOrAny: string) {
  const d = new Date(isoOrAny);
  if (Number.isNaN(d.getTime())) return String(isoOrAny || '');
  return d.toLocaleDateString('pt-BR');
}

/**
 * CSV simples (Google Sheets CSV)
 * - suporta , e ;
 * - suporta aspas e "" escapado
 */
function parseCsv(text: string) {
  const raw = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!raw) return { headers: [] as string[], rows: [] as string[][] };

  const lines = raw.split(/\r?\n/).filter(Boolean);

  const detectDelim = (line: string) => {
    const comma = (line.match(/,/g) || []).length;
    const semi = (line.match(/;/g) || []).length;
    return semi > comma ? ';' : ',';
  };

  const delim = detectDelim(lines[0]);

  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === delim) {
        out.push(cur);
        cur = '';
        continue;
      }

      cur += ch;
    }
    out.push(cur);
    return out.map((x) => String(x ?? '').trim());
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);

  return { headers, rows };
}

async function fetchText(url: string) {
  // Node 18+ tem fetch global
  const res = await (global as any).fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
  });

  if (!res?.ok) {
    const txt = await res?.text?.().catch(() => '');
    throw new Error(txt || `HTTP ${res?.status || 0} ao buscar CSV`);
  }

  return await res.text();
}

// =========================
// String helpers
// =========================
function cleanNullableString(v: any) {
  if (typeof v !== 'string') return undefined; // não mexe se não veio string
  const s = v.trim();
  return s.length ? s : null; // string vazia => null (limpa)
}

function cleanEmail(v: any) {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  return s;
}

// =========================
// ✅ REV SAQUES helpers (Admin)
// =========================

function buildSheetsCsvUrl(params: { sheetId: string; tab?: string | null; gid?: string | null }) {
  const { sheetId, tab, gid } = params;

  if (tab && tab.trim()) {
    const sheet = encodeURIComponent(tab.trim());
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${sheet}`;
  }

  if (gid && gid.trim()) {
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(
      gid.trim(),
    )}`;
  }

  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv`;
}

/**
 * Converte:
 * - "Jan/2026" "Janeiro/2026" "JAN/2026"
 * - "Feb/2026" "February/2026" (✅ inglês)
 * - "01/2026"
 * - "2026-01"
 * - "2026/01"
 * em "YYYY-MM"
 */
function parsePtMonthToKey(input: any): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';

  // 2026-01 / 2026/01
  let m = raw.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) {
    const yyyy = m[1];
    const mm = String(Number(m[2])).padStart(2, '0');
    if (Number(mm) < 1 || Number(mm) > 12) return '';
    return `${yyyy}-${mm}`;
  }

  // 01/2026
  m = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = String(Number(m[1])).padStart(2, '0');
    const yyyy = m[2];
    if (Number(mm) < 1 || Number(mm) > 12) return '';
    return `${yyyy}-${mm}`;
  }

  const low = raw
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // "jan/2026" ou "janeiro/2026" ou "jan 2026" ou "janeiro 2026"
  // "feb/2026" ou "february/2026" etc.
  m = low.match(/^([a-zç]+)\s*[\/ -]\s*(\d{4})$/);
  if (!m) return '';

  const mon = m[1];
  const yyyy = m[2];

  // ✅ SEM CHAVES DUPLICADAS (TS-safe)
  const map: Record<string, string> = {
    // PT
    jan: '01',
    janeiro: '01',

    fev: '02',
    fevereiro: '02',

    mar: '03',
    março: '03',
    marco: '03',

    abr: '04',
    abril: '04',

    mai: '05',
    maio: '05',

    jun: '06',
    junho: '06',

    jul: '07',
    julho: '07',

    ago: '08',
    agosto: '08',

    set: '09',
    setembro: '09',

    out: '10',
    outubro: '10',

    nov: '11',
    novembro: '11',

    dez: '12',
    dezembro: '12',

    // EN (abreviações e nomes completos)
    january: '01',

    feb: '02',
    february: '02',

    march: '03',

    april: '04',
    apr: '04',

    may: '05',

    june: '06',
    july: '07',

    august: '08',
    aug: '08',

    september: '09',
    sept: '09',
    sep: '09',

    october: '10',
    oct: '10',

    november: '11',

    december: '12',
    dec: '12',
  };

  const mm = map[mon];
  if (!mm) return '';

  return `${yyyy}-${mm}`;
}

function monthKeyInRange(monthKey: string, start: Date, end: Date) {
  // monthKey = "YYYY-MM"
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return false;
  const d = new Date(`${monthKey}-01T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;

  // Considera o mês como um todo: início do mês <= end && fim do mês >= start
  const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return monthStart.getTime() <= end.getTime() && monthEnd.getTime() >= start.getTime();
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ cache simples (REV SAQUES CSV)
  private revSaquesCsvCache = new Map<string, { at: number; headers: string[]; rows: string[][] }>();
  private revSaquesCsvCacheTtlMs = 10_000;

  // =========================
  // ✅ LISTAR EXPERTS (ADMIN)
  // =========================
  async listExperts() {
    try {
      const rows = await this.prisma.user.findMany({
        where: { role: UserRole.EXPERT },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          isActive: true,
          createdAt: true,
          photoUrl: true,

          // perfil
          description: true,
          youtubeUrl: true,
          instagramUrl: true,
          telegramUrl: true,
          whatsappUrl: true,

          // sheets (leads)
          leadsSheetCsvUrl: true,
          leadsSheetId: true,
          leadsSheetTab: true,
          leadsSheetGid: true,

          // ✅ sheets (métricas/relatórios)
          metricsSheetCsvUrl: true,
          metricsSheetId: true,
          metricsSheetTab: true,
          metricsSheetGid: true,

          // ✅ sheets (ativacoes)
          activationsSheetCsvUrl: true,
          activationsSheetId: true,
          activationsSheetTab: true,
          activationsSheetGid: true,

          // ✅✅✅ sheets (REV SAQUES)
          revSaquesSheetCsvUrl: true,
          revSaquesSheetId: true,
          revSaquesSheetTab: true,
          revSaquesSheetGid: true,
        } as any,
      });

      return {
        items: rows.map((x: any) => ({
          ...x,
          createdAt: new Date(x.createdAt).toISOString(),
        })),
      };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ CRIAR EXPERT (ADMIN)
  // =========================
  async createExpert(body: any) {
    try {
      const email = String(body?.email || '').trim().toLowerCase();
      const password = String(body?.password || '');
      const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;

      if (!email) throw new Error('email obrigatório');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('email inválido');
      if (!password || password.length < 6) throw new Error('password muito curta (mínimo 6)');

      const exists = await this.prisma.user.findUnique({ where: { email } });
      if (exists) throw new Error('já existe usuário com esse email');

      const passwordHash = await argon2.hash(password);

      const data: any = {
        email,
        passwordHash,
        role: UserRole.EXPERT,
        isActive,

        // perfil opcional
        description: cleanNullableString(body?.description),
        youtubeUrl: cleanNullableString(body?.youtubeUrl),
        instagramUrl: cleanNullableString(body?.instagramUrl),
        telegramUrl: cleanNullableString(body?.telegramUrl),
        whatsappUrl: cleanNullableString(body?.whatsappUrl),

        // sheets (leads) opcionais
        leadsSheetCsvUrl: cleanNullableString(body?.leadsSheetCsvUrl),
        leadsSheetId: cleanNullableString(body?.leadsSheetId),
        leadsSheetTab: cleanNullableString(body?.leadsSheetTab),
        leadsSheetGid: cleanNullableString(body?.leadsSheetGid),

        // ✅ sheets (métricas/relatórios)
        metricsSheetCsvUrl: cleanNullableString(body?.metricsSheetCsvUrl),
        metricsSheetId: cleanNullableString(body?.metricsSheetId),
        metricsSheetTab: cleanNullableString(body?.metricsSheetTab),
        metricsSheetGid: cleanNullableString(body?.metricsSheetGid),

        // ✅ sheets (ativacoes)
        activationsSheetCsvUrl: cleanNullableString(body?.activationsSheetCsvUrl),
        activationsSheetId: cleanNullableString(body?.activationsSheetId),
        activationsSheetTab: cleanNullableString(body?.activationsSheetTab),
        activationsSheetGid: cleanNullableString(body?.activationsSheetGid),

        // ✅✅✅ sheets (REV SAQUES)
        revSaquesSheetCsvUrl: cleanNullableString(body?.revSaquesSheetCsvUrl),
        revSaquesSheetId: cleanNullableString(body?.revSaquesSheetId),
        revSaquesSheetTab: cleanNullableString(body?.revSaquesSheetTab),
        revSaquesSheetGid: cleanNullableString(body?.revSaquesSheetGid),
      };

      const created = await this.prisma.user.create({
        data,
        select: {
          id: true,
          email: true,
          isActive: true,
          createdAt: true,
          photoUrl: true,

          description: true,
          youtubeUrl: true,
          instagramUrl: true,
          telegramUrl: true,
          whatsappUrl: true,

          leadsSheetCsvUrl: true,
          leadsSheetId: true,
          leadsSheetTab: true,
          leadsSheetGid: true,

          metricsSheetCsvUrl: true,
          metricsSheetId: true,
          metricsSheetTab: true,
          metricsSheetGid: true,

          activationsSheetCsvUrl: true,
          activationsSheetId: true,
          activationsSheetTab: true,
          activationsSheetGid: true,

          // ✅✅✅ REV SAQUES
          revSaquesSheetCsvUrl: true,
          revSaquesSheetId: true,
          revSaquesSheetTab: true,
          revSaquesSheetGid: true,
        } as any,
      });

      return {
        ok: true,
        expert: { ...created, createdAt: new Date((created as any).createdAt).toISOString() },
      };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ OVERVIEW GERAL
  // =========================
  async overview(params?: { from?: string; to?: string; expertId?: string }) {
    try {
      const expertId = params?.expertId;
      const fallback = defaultYearRange();

      const from = params?.from ?? fallback.from;
      const to = params?.to ?? fallback.to;

      const { start, end } = parseDateRange(from, to);

      const where: any = { day: { gte: start, lte: end } };
      if (expertId && expertId !== 'ALL') where.expertId = expertId;

      const [usersTotal, usersAdmins, usersExperts, usersActive] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
        this.prisma.user.count({ where: { role: UserRole.EXPERT } }),
        this.prisma.user.count({ where: { isActive: true } }),
      ]);

      const agg = await this.prisma.metricsDaily.aggregate({
        where,
        _sum: {
          leadsTotal: true,
          leadsActive: true,
          depositsCount: true,
          depositsTotalCents: true,
          ftdCount: true,
          revCents: true,
          salesCents: true,
          salesCount: true,
          trafficCents: true,
        },
      });

      const s = agg._sum || {};

      // ✅ REV SAQUES (planilha) — consolidado ALL ou por expert
      const revWithdrawalsCents = await this.sumRevSaquesCentsByRange({
        start,
        end,
        expertId: expertId && expertId !== 'ALL' ? expertId : 'ALL',
      });

      return {
        period: { from, to, expertId: expertId || 'ALL' },

        users: {
          total: usersTotal,
          admins: usersAdmins,
          experts: usersExperts,
          active: usersActive,
        },

        leads: {
          total: Number(s.leadsTotal ?? 0),
          active: Number(s.leadsActive ?? 0),
        },

        deposits: {
          count: Number(s.depositsCount ?? 0),
          totalCents: Number(s.depositsTotalCents ?? 0),
          ftdCount: Number(s.ftdCount ?? 0),
        },

        revenue: {
          revCents: Number(s.revCents ?? 0),
          // ✅ NOVO (admin): REV SAQUES em centavos
          revWithdrawalsCents: Number(revWithdrawalsCents ?? 0),
        },

        sales: {
          salesCents: Number(s.salesCents ?? 0),
          salesCount: Number(s.salesCount ?? 0),
        },

        traffic: {
          trafficCents: Number(s.trafficCents ?? 0),
        },
      };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  /**
   * ✅ SÉRIE (ADMIN)
   * - consolidado (ALL) ou filtrado por expertId
   * - retorna: revBRL, depositsBRL, leadsTotal, ftdCount
   */
  async series(params?: { from?: string; to?: string; group?: 'day' | 'week' | 'month'; expertId?: string }) {
    try {
      const expertId = params?.expertId;
      const fallback = defaultYearRange();

      const from = params?.from ?? fallback.from;
      const to = params?.to ?? fallback.to;

      const { start, end } = parseDateRange(from, to);

      const where: any = { day: { gte: start, lte: end } };
      if (expertId && expertId !== 'ALL') where.expertId = expertId;

      const rows = await this.prisma.metricsDaily.findMany({
        where,
        orderBy: { day: 'asc' },
        select: {
          day: true,
          revCents: true,
          depositsTotalCents: true,
          leadsTotal: true,
          ftdCount: true,
        },
      });

      const group = params?.group ?? 'day';

      // soma por dia (consolidado ou não)
      const byIso = new Map<
        string,
        {
          revCents: number;
          depositsCents: number;
          leadsTotal: number;
          ftdCount: number;
        }
      >();

      for (const r of rows) {
        const iso = isoDayLabel(r.day);

        const prev = byIso.get(iso) ?? {
          revCents: 0,
          depositsCents: 0,
          leadsTotal: 0,
          ftdCount: 0,
        };

        byIso.set(iso, {
          revCents: prev.revCents + Number(r.revCents ?? 0),
          depositsCents: prev.depositsCents + Number(r.depositsTotalCents ?? 0),
          leadsTotal: prev.leadsTotal + Number(r.leadsTotal ?? 0),
          ftdCount: prev.ftdCount + Number(r.ftdCount ?? 0),
        });
      }

      if (group === 'day') {
        const points: any[] = [];
        let cur = startOfDayUTC(start);
        const last = startOfDayUTC(end);

        while (cur.getTime() <= last.getTime()) {
          const iso = isoDayLabel(cur);
          const v = byIso.get(iso) ?? { revCents: 0, depositsCents: 0, leadsTotal: 0, ftdCount: 0 };

          points.push({
            label: iso,
            revBRL: Number(v.revCents ?? 0) / 100,
            depositsBRL: Number(v.depositsCents ?? 0) / 100,
            leadsTotal: Number(v.leadsTotal ?? 0),
            ftdCount: Number(v.ftdCount ?? 0),
          });

          cur = addDaysUTC(cur, 1);
        }

        return { period: { from, to, group, expertId: expertId || 'ALL' }, points };
      }

      const bucketMap = new Map<
        string,
        {
          key: string;
          label: string;
          revCents: number;
          depositsCents: number;
          leadsTotal: number;
          ftdCount: number;
        }
      >();

      const ensureBucket = (key: string) => {
        if (!bucketMap.has(key)) {
          bucketMap.set(key, {
            key,
            label: key,
            revCents: 0,
            depositsCents: 0,
            leadsTotal: 0,
            ftdCount: 0,
          });
        }
        return bucketMap.get(key)!;
      };

      for (const r of rows) {
        const key = group === 'week' ? isoDayLabel(startOfWeekUTC(r.day)) : monthKeyUTC(r.day);
        const it = ensureBucket(key);

        it.revCents += Number(r.revCents ?? 0);
        it.depositsCents += Number(r.depositsTotalCents ?? 0);
        it.leadsTotal += Number(r.leadsTotal ?? 0);
        it.ftdCount += Number(r.ftdCount ?? 0);
      }

      if (group === 'week') {
        let cur = startOfWeekUTC(start);
        const last = startOfWeekUTC(end);

        while (cur.getTime() <= last.getTime()) {
          const key = isoDayLabel(cur);
          ensureBucket(key);
          cur = addDaysUTC(cur, 7);
        }
      } else {
        let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
        const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

        while (cur.getTime() <= last.getTime()) {
          const key = monthKeyUTC(cur);
          ensureBucket(key);
          cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
        }
      }

      const points = Array.from(bucketMap.values())
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((b) => ({
          label: b.label,
          revBRL: Number(b.revCents ?? 0) / 100,
          depositsBRL: Number(b.depositsCents ?? 0) / 100,
          leadsTotal: Number(b.leadsTotal ?? 0),
          ftdCount: Number(b.ftdCount ?? 0),
        }));

      return { period: { from, to, group, expertId: expertId || 'ALL' }, points };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  /**
   * detalhe do expert + métricas agregadas no período
   */
  async expertOverview(expertId: string, params?: { from?: string; to?: string }) {
    try {
      if (!expertId) throw new Error('expertId required');

      const expert = await this.prisma.user.findUnique({
        where: { id: expertId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          photoUrl: true,

          // PERFIL
          description: true,
          youtubeUrl: true,
          instagramUrl: true,
          telegramUrl: true,
          whatsappUrl: true,

          // sheets (leads)
          leadsSheetId: true,
          leadsSheetTab: true,
          leadsSheetGid: true,
          leadsSheetCsvUrl: true,

          // ✅ sheets (métricas/relatórios)
          metricsSheetId: true,
          metricsSheetTab: true,
          metricsSheetGid: true,
          metricsSheetCsvUrl: true,

          // sheets (ativacoes)
          activationsSheetId: true,
          activationsSheetTab: true,
          activationsSheetGid: true,
          activationsSheetCsvUrl: true,

          // ✅✅✅ sheets (REV SAQUES)
          revSaquesSheetId: true,
          revSaquesSheetTab: true,
          revSaquesSheetGid: true,
          revSaquesSheetCsvUrl: true,
        } as any,
      });

      if (!expert) throw new Error('expertId não encontrado');
      if ((expert as any).role !== UserRole.EXPERT) throw new Error('user não é EXPERT');

      const fallback = defaultYearRange();
      const from = params?.from ?? fallback.from;
      const to = params?.to ?? fallback.to;

      const { start, end } = parseDateRange(from, to);

      const agg = await this.prisma.metricsDaily.aggregate({
        where: {
          expertId,
          day: { gte: start, lte: end },
        },
        _sum: {
          leadsTotal: true,
          leadsActive: true,
          depositsCount: true,
          depositsTotalCents: true,
          ftdCount: true,
          revCents: true,
          salesCents: true,
          salesCount: true,
          trafficCents: true,
        },
      });

      const s = agg._sum || {};

      return {
        period: { from, to, expertId },
        expert: {
          id: expert.id,
          email: expert.email,
          isActive: expert.isActive,
          createdAt: expert.createdAt,
          photoUrl: expert.photoUrl ?? null,

          description: (expert as any).description ?? null,
          youtubeUrl: (expert as any).youtubeUrl ?? null,
          instagramUrl: (expert as any).instagramUrl ?? null,
          telegramUrl: (expert as any).telegramUrl ?? null,
          whatsappUrl: (expert as any).whatsappUrl ?? null,

          leadsSheetId: (expert as any).leadsSheetId ?? null,
          leadsSheetTab: (expert as any).leadsSheetTab ?? null,
          leadsSheetGid: (expert as any).leadsSheetGid ?? null,
          leadsSheetCsvUrl: (expert as any).leadsSheetCsvUrl ?? null,

          metricsSheetId: (expert as any).metricsSheetId ?? null,
          metricsSheetTab: (expert as any).metricsSheetTab ?? null,
          metricsSheetGid: (expert as any).metricsSheetGid ?? null,
          metricsSheetCsvUrl: (expert as any).metricsSheetCsvUrl ?? null,

          activationsSheetId: (expert as any).activationsSheetId ?? null,
          activationsSheetTab: (expert as any).activationsSheetTab ?? null,
          activationsSheetGid: (expert as any).activationsSheetGid ?? null,
          activationsSheetCsvUrl: (expert as any).activationsSheetCsvUrl ?? null,

          // ✅✅✅ REV SAQUES
          revSaquesSheetId: (expert as any).revSaquesSheetId ?? null,
          revSaquesSheetTab: (expert as any).revSaquesSheetTab ?? null,
          revSaquesSheetGid: (expert as any).revSaquesSheetGid ?? null,
          revSaquesSheetCsvUrl: (expert as any).revSaquesSheetCsvUrl ?? null,
        },
        kpis: {
          leadsTotal: Number(s.leadsTotal ?? 0),
          leadsActive: Number(s.leadsActive ?? 0),
          depositsCount: Number(s.depositsCount ?? 0),
          depositsTotalCents: Number(s.depositsTotalCents ?? 0),
          ftdCount: Number(s.ftdCount ?? 0),
          revCents: Number(s.revCents ?? 0),
          salesCents: Number(s.salesCents ?? 0),
          salesCount: Number(s.salesCount ?? 0),
          trafficCents: Number(s.trafficCents ?? 0),
        },
      };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  /**
   * ✅ Série temporal (pro gráfico no admin)
   * - day: devolve TODOS os dias do range (preenche gaps com 0)
   * - week/month: preenche buckets vazios
   */
  async expertSeries(expertId: string, params: { from?: string; to?: string; group?: 'day' | 'week' | 'month' }) {
    try {
      if (!expertId) throw new Error('expertId required');

      const fallback = defaultYearRange();
      const from = params.from ?? fallback.from;
      const to = params.to ?? fallback.to;

      const { start, end } = parseDateRange(from, to);

      const rows = await this.prisma.metricsDaily.findMany({
        where: { expertId, day: { gte: start, lte: end } },
        orderBy: { day: 'asc' },
        select: {
          day: true,
          leadsTotal: true,
          depositsTotalCents: true,
          revCents: true,
          salesCents: true,
          trafficCents: true,
          ftdCount: true,
          salesCount: true,
        },
      });

      const group = params.group ?? 'day';

      const byIso = new Map<
        string,
        {
          leadsTotal: number;
          depositsTotalCents: number;
          revCents: number;
          salesCents: number;
          trafficCents: number;
          ftdCount: number;
          salesCount: number;
        }
      >();

      for (const r of rows) {
        const iso = isoDayLabel(r.day);
        byIso.set(iso, {
          leadsTotal: Number(r.leadsTotal ?? 0),
          depositsTotalCents: Number(r.depositsTotalCents ?? 0),
          revCents: Number(r.revCents ?? 0),
          salesCents: Number(r.salesCents ?? 0),
          trafficCents: Number(r.trafficCents ?? 0),
          ftdCount: Number(r.ftdCount ?? 0),
          salesCount: Number(r.salesCount ?? 0),
        });
      }

      if (group === 'day') {
        const points: any[] = [];
        let cur = startOfDayUTC(start);
        const last = startOfDayUTC(end);

        while (cur.getTime() <= last.getTime()) {
          const iso = isoDayLabel(cur);
          const v =
            byIso.get(iso) ?? {
              leadsTotal: 0,
              depositsTotalCents: 0,
              revCents: 0,
              salesCents: 0,
              trafficCents: 0,
              ftdCount: 0,
              salesCount: 0,
            };

          points.push({
            label: iso,
            ...v,
          });

          cur = addDaysUTC(cur, 1);
        }

        return { period: { from, to, group }, points };
      }

      const bucketMap = new Map<string, any>();

      const ensureBucket = (key: string) => {
        if (!bucketMap.has(key)) {
          bucketMap.set(key, {
            key,
            label: key,
            leadsTotal: 0,
            depositsTotalCents: 0,
            revCents: 0,
            salesCents: 0,
            trafficCents: 0,
            ftdCount: 0,
            salesCount: 0,
          });
        }
        return bucketMap.get(key);
      };

      for (const r of rows) {
        const key = group === 'week' ? isoDayLabel(startOfWeekUTC(r.day)) : monthKeyUTC(r.day);
        const it = ensureBucket(key);

        it.leadsTotal += Number(r.leadsTotal ?? 0);
        it.depositsTotalCents += Number(r.depositsTotalCents ?? 0);
        it.revCents += Number(r.revCents ?? 0);
        it.salesCents += Number(r.salesCents ?? 0);
        it.trafficCents += Number(r.trafficCents ?? 0);
        it.ftdCount += Number(r.ftdCount ?? 0);
        it.salesCount += Number(r.salesCount ?? 0);
      }

      if (group === 'week') {
        let cur = startOfWeekUTC(start);
        const last = startOfWeekUTC(end);

        while (cur.getTime() <= last.getTime()) {
          const key = isoDayLabel(cur);
          ensureBucket(key);
          cur = addDaysUTC(cur, 7);
        }
      } else {
        let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
        const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

        while (cur.getTime() <= last.getTime()) {
          const key = monthKeyUTC(cur);
          ensureBucket(key);
          cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
        }
      }

      const points = Array.from(bucketMap.values())
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(({ key, ...rest }) => rest);

      return { period: { from, to, group }, points };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  /**
   * ✅ Leads do expert (ADMIN)
   */
  async expertLeads(
    expertId: string,
    params: {
      from?: string;
      to?: string;
      page: number;
      pageSize: number;
      q?: string;
      status?: string;
      sortBy?: string;
      sortDir?: string;
    },
  ) {
    try {
      if (!expertId) throw new Error('expertId required');

      const from = params.from ?? DEFAULT_FROM;
      const to = params.to ?? DEFAULT_TO;

      const { start, end } = parseDateRange(from, to);

      const page = Math.max(1, params.page || 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));

      const sortBy = String(params.sortBy || 'date');
      const sortDir = (String(params.sortDir || 'desc') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

      const q = String(params.q || '').trim().toLowerCase();

      const expert = await this.prisma.user.findUnique({
        where: { id: expertId },
        select: {
          id: true,
          role: true,
          leadsSheetCsvUrl: true,
        } as any,
      });

      if (!expert) throw new Error('expertId não encontrado');
      if ((expert as any).role !== UserRole.EXPERT) throw new Error('user não é EXPERT');

      const csvUrl = String((expert as any).leadsSheetCsvUrl || '').trim();

      // 1) Google Sheets CSV
      if (csvUrl) {
        const csvText = await fetchText(csvUrl);
        const { headers, rows } = parseCsv(csvText);

        if (!headers.length) {
          return {
            source: 'sheets',
            period: { from, to },
            page,
            pageSize,
            total: 0,
            items: [],
            csvUrl,
            warning: 'CSV vazio (sem cabeçalho).',
          };
        }

        const idx = new Map<string, number>();
        headers.forEach((h, i) => idx.set(normKey(h), i));

        const pick = (row: string[], keys: string[]) => {
          for (const k of keys) {
            const j = idx.get(k);
            if (j != null) return row[j];
          }
          return '';
        };

        const keyDate = ['date', 'datacriacao', 'datadecriacao', 'createdat', 'data'];
        const keyEmail = ['email', 'e-mail', 'mail'];
        const keyWpp = ['wpp', 'whatsapp', 'telefone', 'phone', 'celular'];

        const keyFirstDeposit = ['firstdeposit', '1deposito', 'primeirodeposito', 'ftd', '1odeposito'];
        const keyDeposits = ['deposits', 'depositos', 'depositototal', 'totaldepositos', 'totaldepositado'];
        const keyWithdrawals = ['withdrawals', 'saques', 'saque', 'total_saques'];
        const keyGains = ['gains', 'ganhos', 'lucros', 'profit'];
        const keyLosses = ['losses', 'perdas', 'loss'];
        const keyBalance = ['balance', 'saldo', 'resultado', 'pnl'];

        const all = rows
          .map((r, i) => {
            const dateIso = parseDateLooseISO(pick(r, keyDate)) || '';
            const email = String(pick(r, keyEmail) || '').trim();
            const wpp = String(pick(r, keyWpp) || '').trim();

            const firstDeposit = parseNumLoose(pick(r, keyFirstDeposit));
            const deposits = parseNumLoose(pick(r, keyDeposits));
            const withdrawals = parseNumLoose(pick(r, keyWithdrawals));
            const gains = parseNumLoose(pick(r, keyGains));
            const losses = parseNumLoose(pick(r, keyLosses));
            const balanceRaw = pick(r, keyBalance);

            const balance =
              balanceRaw !== '' && balanceRaw != null ? parseNumLoose(balanceRaw) : (gains || 0) - (losses || 0);

            const d = dateIso ? new Date(dateIso) : null;

            return {
              id: `${expertId}_${i + 1}`,
              date: dateIso || '',
              dateLabel: dateIso ? toBRDateLabel(dateIso) : '',
              email,
              wpp,
              firstDeposit,
              deposits,
              withdrawals,
              gains,
              losses,
              balance,
              _d: d,
            };
          })
          .filter((it) => {
            if (it._d && (it._d < start || it._d > end)) return false;

            if (q) {
              const hay = `${it.email} ${it.wpp}`.toLowerCase();
              if (!hay.includes(q)) return false;
            }

            return true;
          });

        const getSortVal = (x: any) => {
          switch (sortBy) {
            case 'email':
              return String(x.email || '');
            case 'wpp':
              return String(x.wpp || '');
            case 'firstDeposit':
              return Number(x.firstDeposit || 0);
            case 'deposits':
              return Number(x.deposits || 0);
            case 'withdrawals':
              return Number(x.withdrawals || 0);
            case 'gains':
              return Number(x.gains || 0);
            case 'losses':
              return Number(x.losses || 0);
            case 'balance':
              return Number(x.balance || 0);
            case 'date':
            default:
              return x._d ? x._d.getTime() : 0;
          }
        };

        all.sort((a, b) => {
          const av = getSortVal(a);
          const bv = getSortVal(b);

          if (typeof av === 'string' || typeof bv === 'string') {
            const cmp = String(av).localeCompare(String(bv));
            return sortDir === 'asc' ? cmp : -cmp;
          }

          const diff = Number(av) - Number(bv);
          return sortDir === 'asc' ? diff : -diff;
        });

        const total = all.length;
        const startIdx = (page - 1) * pageSize;
        const items = all.slice(startIdx, startIdx + pageSize).map(({ _d, ...rest }) => rest);

        return {
          source: 'sheets',
          period: { from, to },
          page,
          pageSize,
          total,
          items,
          csvUrl,
        };
      }

      // 2) Fallback Prisma (sem CSV configurado)
      const where: any = {
        expertId,
        createdAt: { gte: start, lte: end },
      };

      if (q) {
        where.OR = [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ];
      }

      const [total, rows] = await Promise.all([
        this.prisma.lead.count({ where }),
        this.prisma.lead.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: { id: true, email: true, phone: true, createdAt: true },
        }),
      ]);

      const items = rows.map((x) => ({
        id: x.id,
        date: x.createdAt.toISOString(),
        dateLabel: toBRDateLabel(x.createdAt.toISOString()),
        email: x.email || '',
        wpp: x.phone || '',
        firstDeposit: 0,
        deposits: 0,
        withdrawals: 0,
        gains: 0,
        losses: 0,
        balance: 0,
      }));

      return {
        source: 'prisma',
        period: { from, to },
        page,
        pageSize,
        total,
        items,
        warning: 'Expert sem leadsSheetCsvUrl configurado. Mostrando fallback do banco (sem valores financeiros).',
      };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ editar expert (ADMIN)
  // =========================
  async updateExpert(expertId: string, body: any) {
    try {
      if (!expertId) throw new Error('expertId required');

      const data: any = {
        ...(body?.email ? { email: cleanEmail(body.email) } : {}),
        ...(typeof body?.isActive === 'boolean' ? { isActive: body.isActive } : {}),
        ...(body?.photoUrl ? { photoUrl: String(body.photoUrl) } : {}),
      };

      // PERFIL
      if (typeof body?.description === 'string') data.description = cleanNullableString(body.description);
      if (typeof body?.youtubeUrl === 'string') data.youtubeUrl = cleanNullableString(body.youtubeUrl);
      if (typeof body?.instagramUrl === 'string') data.instagramUrl = cleanNullableString(body.instagramUrl);
      if (typeof body?.telegramUrl === 'string') data.telegramUrl = cleanNullableString(body.telegramUrl);
      if (typeof body?.whatsappUrl === 'string') data.whatsappUrl = cleanNullableString(body.whatsappUrl);

      // LEADS
      if (typeof body?.leadsSheetCsvUrl === 'string') data.leadsSheetCsvUrl = cleanNullableString(body.leadsSheetCsvUrl);
      if (typeof body?.leadsSheetId === 'string') data.leadsSheetId = cleanNullableString(body.leadsSheetId);
      if (typeof body?.leadsSheetTab === 'string') data.leadsSheetTab = cleanNullableString(body.leadsSheetTab);
      if (typeof body?.leadsSheetGid === 'string') data.leadsSheetGid = cleanNullableString(body.leadsSheetGid);

      // ✅ MÉTRICAS/RELATÓRIOS
      if (typeof body?.metricsSheetCsvUrl === 'string') data.metricsSheetCsvUrl = cleanNullableString(body.metricsSheetCsvUrl);
      if (typeof body?.metricsSheetId === 'string') data.metricsSheetId = cleanNullableString(body.metricsSheetId);
      if (typeof body?.metricsSheetTab === 'string') data.metricsSheetTab = cleanNullableString(body.metricsSheetTab);
      if (typeof body?.metricsSheetGid === 'string') data.metricsSheetGid = cleanNullableString(body.metricsSheetGid);

      // ATIVAÇÕES
      if (typeof body?.activationsSheetCsvUrl === 'string')
        data.activationsSheetCsvUrl = cleanNullableString(body.activationsSheetCsvUrl);
      if (typeof body?.activationsSheetId === 'string') data.activationsSheetId = cleanNullableString(body.activationsSheetId);
      if (typeof body?.activationsSheetTab === 'string') data.activationsSheetTab = cleanNullableString(body.activationsSheetTab);
      if (typeof body?.activationsSheetGid === 'string') data.activationsSheetGid = cleanNullableString(body.activationsSheetGid);

      // ✅✅✅ REV SAQUES
      if (typeof body?.revSaquesSheetCsvUrl === 'string') data.revSaquesSheetCsvUrl = cleanNullableString(body.revSaquesSheetCsvUrl);
      if (typeof body?.revSaquesSheetId === 'string') data.revSaquesSheetId = cleanNullableString(body.revSaquesSheetId);
      if (typeof body?.revSaquesSheetTab === 'string') data.revSaquesSheetTab = cleanNullableString(body.revSaquesSheetTab);
      if (typeof body?.revSaquesSheetGid === 'string') data.revSaquesSheetGid = cleanNullableString(body.revSaquesSheetGid);

      const updated = await this.prisma.user.update({
        where: { id: expertId },
        data: data as any,
        select: {
          id: true,
          email: true,
          isActive: true,
          photoUrl: true,

          description: true,
          youtubeUrl: true,
          instagramUrl: true,
          telegramUrl: true,
          whatsappUrl: true,

          leadsSheetCsvUrl: true,
          leadsSheetId: true,
          leadsSheetTab: true,
          leadsSheetGid: true,

          metricsSheetCsvUrl: true,
          metricsSheetId: true,
          metricsSheetTab: true,
          metricsSheetGid: true,

          activationsSheetCsvUrl: true,
          activationsSheetId: true,
          activationsSheetTab: true,
          activationsSheetGid: true,

          // ✅✅✅ REV SAQUES
          revSaquesSheetCsvUrl: true,
          revSaquesSheetId: true,
          revSaquesSheetTab: true,
          revSaquesSheetGid: true,
        } as any,
      });

      return { ok: true, expert: updated };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ atualizar senha do expert (ADMIN) - com HASH
  // =========================
  async updateExpertPassword(expertId: string, password?: string) {
    try {
      if (!expertId) throw new Error('expertId required');
      if (!password || password.length < 6) throw new Error('password muito curta (mínimo 6)');

      const passwordHash = await argon2.hash(password);

      await this.prisma.user.update({
        where: { id: expertId },
        data: { passwordHash } as any,
        select: { id: true },
      });

      return { ok: true };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ upload foto do expert (ADMIN)
  // =========================
  async updateExpertPhoto(expertId: string, file?: Express.Multer.File) {
    try {
      if (!expertId) throw new Error('expertId required');
      if (!file) throw new Error('file required');

      const uploadsDir = path.join(process.cwd(), 'uploads', 'admin', 'experts');
      fs.mkdirSync(uploadsDir, { recursive: true });

      const ext = path.extname(file.originalname || '') || '.jpg';
      const filename = `expert_${expertId}_${Date.now()}${ext}`;
      const filepath = path.join(uploadsDir, filename);

      fs.writeFileSync(filepath, file.buffer);

      const photoUrl = `/uploads/admin/experts/${filename}`;

      const updated = await this.prisma.user.update({
        where: { id: expertId },
        data: { photoUrl } as any,
        select: { id: true, email: true, photoUrl: true },
      });

      return { ok: true, expert: updated };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅✅✅ REV SAQUES (Admin) - soma por período (ALL ou 1 expert)
  // =========================

  private async getRevSaquesResolvedUrlForExpert(expertId: string): Promise<string> {
    const expert = await this.prisma.user.findUnique({
      where: { id: expertId },
      select: {
        id: true,
        role: true,
        revSaquesSheetCsvUrl: true,
        revSaquesSheetId: true,
        revSaquesSheetTab: true,
        revSaquesSheetGid: true,
      } as any,
    });

    if (!expert) return '';

    // @ts-ignore
    if (String(expert.role) !== 'EXPERT') return '';

    const csvUrlDirect = String((expert as any).revSaquesSheetCsvUrl || '').trim();
    const sheetId = String((expert as any).revSaquesSheetId || '').trim();

    if (csvUrlDirect) return csvUrlDirect;
    if (!sheetId) return '';

    const resolvedUrl = buildSheetsCsvUrl({
      sheetId,
      tab: (expert as any).revSaquesSheetTab,
      gid: (expert as any).revSaquesSheetGid,
    });

    return resolvedUrl;
  }

  private async loadRevSaquesCsv(expertId: string, resolvedUrl: string) {
    const cacheKey = `${expertId}:${resolvedUrl}`;
    const now = Date.now();

    const cached = this.revSaquesCsvCache.get(cacheKey);
    const canUseCache = cached && now - cached.at < this.revSaquesCsvCacheTtlMs;

    if (canUseCache) return cached!;

    const csvText = await fetchText(resolvedUrl);
    const { headers, rows } = parseCsv(csvText);

    const payload = { at: now, headers, rows };
    this.revSaquesCsvCache.set(cacheKey, payload);
    return payload;
  }

  private findRevSaquesColumns(headers: string[]) {
    const norm = headers.map((h) => normKey(h));

    const monthIdx =
      norm.findIndex(
        (h) =>
          h === 'mes' ||
          h.includes('mes') ||
          h.includes('competencia') ||
          h.includes('periodo') ||
          h.includes('month'),
      ) ?? -1;

    let valueIdx = norm.findIndex((h) => h.includes('revsaque') || h.includes('rev_saque') || h.includes('revsq'));
    if (valueIdx < 0) valueIdx = norm.findIndex((h) => h.includes('saque'));
    if (valueIdx < 0) valueIdx = norm.findIndex((h) => h.includes('withdraw'));

    return { monthIdx, valueIdx };
  }

  private sumRevSaquesFromCsvInRange(csv: { headers: string[]; rows: string[][] }, start: Date, end: Date) {
    if (!csv?.headers?.length) return 0;

    const { monthIdx, valueIdx } = this.findRevSaquesColumns(csv.headers);

    if (monthIdx < 0 || valueIdx < 0) {
      // sem colunas suficientes
      return 0;
    }

    const byMonth = new Map<string, number>();

    for (const row of csv.rows || []) {
      const monthLabel = String(row?.[monthIdx] ?? '').trim();
      const key = parsePtMonthToKey(monthLabel);
      if (!key) continue;

      const valBRL = parseNumLoose(row?.[valueIdx]);
      if (!Number.isFinite(valBRL) || valBRL === 0) continue;

      const cents = Math.round(valBRL * 100);
      byMonth.set(key, (byMonth.get(key) ?? 0) + cents);
    }

    let sum = 0;
    for (const [k, cents] of byMonth.entries()) {
      if (!monthKeyInRange(k, start, end)) continue;
      sum += Number(cents ?? 0);
    }

    return sum;
  }

  private async sumRevSaquesCentsByRange(params: { start: Date; end: Date; expertId: string | 'ALL' }) {
    const { start, end, expertId } = params;

    // quais experts considerar?
    const ids: string[] =
      expertId !== 'ALL'
        ? [expertId]
        : (
            await this.prisma.user.findMany({
              where: { role: UserRole.EXPERT },
              select: { id: true },
            })
          ).map((x) => String((x as any).id));

    let total = 0;

    for (const id of ids) {
      const resolvedUrl = await this.getRevSaquesResolvedUrlForExpert(id);
      if (!resolvedUrl) continue;

      const csv = await this.loadRevSaquesCsv(id, resolvedUrl);
      total += this.sumRevSaquesFromCsvInRange(csv, start, end);
    }

    return total;
  }

 // =========================
// ✅✅✅ UTILIDADES (ADMIN) — PASTAS + TAGS + FILTRO + EDIT + REORDER
// =========================

private normalizeUrl(input: any) {
  const v = String(input ?? '').trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return `https://${v}`;
}

private safeExtFromMimeOrName(file?: Express.Multer.File) {
  const nameExt = file?.originalname ? path.extname(file.originalname) : '';
  const ext = (nameExt || '').toLowerCase();

  const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  if (allowed.has(ext)) return ext === '.jpeg' ? '.jpg' : ext;

  const mime = String(file?.mimetype || '').toLowerCase();
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';

  return '';
}

private toUtilityDto(row: any) {
  const tags = (row?.tags || []).map((t: any) => ({
    id: String(t?.tag?.id),
    name: String(t?.tag?.name || ''),
    color: t?.tag?.color ?? null,
  }));

  return {
    id: String(row?.id),
    name: String(row?.name || ''),
    url: String(row?.url || ''),
    description: row?.description ?? null,
    imageUrl: row?.imageUrl ?? null,
    folderId: row?.folderId ?? null,
    folder: row?.folder
      ? { id: String(row.folder.id), name: String(row.folder.name || ''), orderIndex: Number(row.folder.orderIndex ?? 0) }
      : null,
    tags,
    orderIndex: Number(row?.orderIndex ?? 0),
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

// ---------- PASTAS ----------

async listUtilityFolders() {
  const rows = await (this.prisma as any).utilityFolder.findMany({
    orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, orderIndex: true, createdAt: true, updatedAt: true },
  });

  return {
    items: (rows || []).map((x: any) => ({
      id: String(x.id),
      name: String(x.name || ''),
      orderIndex: Number(x.orderIndex ?? 0),
      createdAt: x.createdAt ? new Date(x.createdAt).toISOString() : null,
      updatedAt: x.updatedAt ? new Date(x.updatedAt).toISOString() : null,
    })),
  };
}

async createUtilityFolder(body: { name: string }) {
  const name = String(body?.name || '').trim();
  if (!name) throw new Error('name obrigatório');
  if (name.length > 60) throw new Error('name muito grande (máx 60)');

  const max = await (this.prisma as any).utilityFolder.aggregate({ _max: { orderIndex: true } });
  const nextOrder = Number(max?._max?.orderIndex ?? 0) + 1;

  const created = await (this.prisma as any).utilityFolder.create({
    data: { name, orderIndex: nextOrder },
    select: { id: true, name: true, orderIndex: true, createdAt: true, updatedAt: true },
  });

  return {
    id: String(created.id),
    name: String(created.name || ''),
    orderIndex: Number(created.orderIndex ?? 0),
    createdAt: created.createdAt ? new Date(created.createdAt).toISOString() : null,
    updatedAt: created.updatedAt ? new Date(created.updatedAt).toISOString() : null,
  };
}

async updateUtilityFolder(id: string, body: { name: string }) {
  const folderId = String(id || '').trim();
  if (!folderId) throw new Error('id obrigatório');

  const name = String(body?.name || '').trim();
  if (!name) throw new Error('name obrigatório');

  const updated = await (this.prisma as any).utilityFolder.update({
    where: { id: folderId },
    data: { name },
    select: { id: true, name: true, orderIndex: true, createdAt: true, updatedAt: true },
  });

  return {
    id: String(updated.id),
    name: String(updated.name || ''),
    orderIndex: Number(updated.orderIndex ?? 0),
    createdAt: updated.createdAt ? new Date(updated.createdAt).toISOString() : null,
    updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : null,
  };
}

async deleteUtilityFolder(id: string) {
  const folderId = String(id || '').trim();
  if (!folderId) throw new Error('id obrigatório');

  // coloca folderId = null nas utilidades (SetNull já faz, mas vamos ser explícitos)
  await (this.prisma as any).utilityLink.updateMany({
    where: { folderId },
    data: { folderId: null },
  });

  await (this.prisma as any).utilityFolder.delete({ where: { id: folderId } });
  return { ok: true };
}

// ---------- TAGS ----------

async listUtilityTags() {
  const rows = await (this.prisma as any).utilityTag.findMany({
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, color: true, createdAt: true, updatedAt: true },
  });

  return {
    items: (rows || []).map((x: any) => ({
      id: String(x.id),
      name: String(x.name || ''),
      color: x.color ?? null,
      createdAt: x.createdAt ? new Date(x.createdAt).toISOString() : null,
      updatedAt: x.updatedAt ? new Date(x.updatedAt).toISOString() : null,
    })),
  };
}

async createUtilityTag(body: { name: string; color?: string | null }) {
  const name = String(body?.name || '').trim();
  if (!name) throw new Error('name obrigatório');
  if (name.length > 40) throw new Error('name muito grande (máx 40)');

  const color = body?.color ? String(body.color).trim() : null;

  const created = await (this.prisma as any).utilityTag.create({
    data: { name, color: color || null },
    select: { id: true, name: true, color: true, createdAt: true, updatedAt: true },
  });

  return {
    id: String(created.id),
    name: String(created.name || ''),
    color: created.color ?? null,
    createdAt: created.createdAt ? new Date(created.createdAt).toISOString() : null,
    updatedAt: created.updatedAt ? new Date(created.updatedAt).toISOString() : null,
  };
}

async updateUtilityTag(id: string, body: { name: string; color?: string | null }) {
  const tagId = String(id || '').trim();
  if (!tagId) throw new Error('id obrigatório');

  const name = String(body?.name || '').trim();
  if (!name) throw new Error('name obrigatório');

  const color = body?.color ? String(body.color).trim() : null;

  const updated = await (this.prisma as any).utilityTag.update({
    where: { id: tagId },
    data: { name, color: color || null },
    select: { id: true, name: true, color: true, createdAt: true, updatedAt: true },
  });

  return {
    id: String(updated.id),
    name: String(updated.name || ''),
    color: updated.color ?? null,
    createdAt: updated.createdAt ? new Date(updated.createdAt).toISOString() : null,
    updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : null,
  };
}

async deleteUtilityTag(id: string) {
  const tagId = String(id || '').trim();
  if (!tagId) throw new Error('id obrigatório');

  // deleta relações primeiro
  await (this.prisma as any).utilityLinkTag.deleteMany({ where: { tagId } });
  await (this.prisma as any).utilityTag.delete({ where: { id: tagId } });

  return { ok: true };
}

// ---------- LIST / CREATE / UPDATE / DELETE ----------

async listUtilities(params?: { folderId?: string; tagIds?: string[]; q?: string }) {
  const folderId = String(params?.folderId || '').trim();
  const tagIds = Array.isArray(params?.tagIds) ? params!.tagIds!.map(String).filter(Boolean) : [];
  const q = String(params?.q || '').trim().toLowerCase();

  const where: any = {};

  if (folderId) where.folderId = folderId;

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { url: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  // filtro por tags: "tem todas as tags selecionadas"
  if (tagIds.length) {
    where.AND = tagIds.map((tid) => ({
      tags: { some: { tagId: tid } },
    }));
  }

  const rows = await (this.prisma as any).utilityLink.findMany({
    where,
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
    include: {
      folder: true,
      tags: { include: { tag: true } },
    },
  });

  return { items: (rows || []).map((r: any) => this.toUtilityDto(r)) };
}

async createUtility(
  body: { name: string; url: string; description?: string; folderId?: string; tagIds?: string[] },
  file?: Express.Multer.File,
) {
  const name = String(body?.name || '').trim();
  const url = this.normalizeUrl(body?.url);
  const description = cleanNullableString(String(body?.description ?? ''));
  const folderId = String(body?.folderId || '').trim() || null;

  const tagIds = Array.isArray(body?.tagIds) ? body!.tagIds!.map(String).filter(Boolean) : [];

  if (!name) throw new Error('name obrigatório');
  if (name.length > 80) throw new Error('name muito grande (máx 80)');
  if (!url) throw new Error('url obrigatório');

  let imageUrl: string | null = null;

  if (file) {
    const ext = this.safeExtFromMimeOrName(file);
    if (!ext) throw new Error('Arquivo inválido. Envie png/jpg/jpeg/webp.');
    if (Number(file.size || 0) > 5 * 1024 * 1024) throw new Error('Arquivo muito grande. Limite: 5MB.');

    const uploadsDir = path.join(process.cwd(), 'uploads', 'admin', 'utilities');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const filename = `utility_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, file.buffer);

    imageUrl = `/uploads/admin/utilities/${filename}`;
  }

  // next orderIndex = max + 1 dentro da pasta (ou global se folderId null)
  const max = await (this.prisma as any).utilityLink.aggregate({
    where: { folderId },
    _max: { orderIndex: true },
  });
  const nextOrder = Number(max?._max?.orderIndex ?? 0) + 1;

  const created = await (this.prisma as any).utilityLink.create({
    data: {
      name,
      url,
      description,
      imageUrl,
      folderId,
      orderIndex: nextOrder,
      tags: tagIds.length
        ? {
            create: tagIds.map((tagId) => ({ tagId })),
          }
        : undefined,
    },
    include: {
      folder: true,
      tags: { include: { tag: true } },
    },
  });

  return this.toUtilityDto(created);
}

async updateUtility(
  id: string,
  body: { name?: string; url?: string; description?: string; folderId?: string; tagIds?: string[] },
  file?: Express.Multer.File,
) {
  const utilityId = String(id || '').trim();
  if (!utilityId) throw new Error('id obrigatório');

  const exists = await (this.prisma as any).utilityLink.findUnique({
    where: { id: utilityId },
    include: { tags: true },
  });
  if (!exists) throw new Error('Utilidade não encontrada');

  const data: any = {};

  if (typeof body?.name === 'string') {
    const nm = body.name.trim();
    if (!nm) throw new Error('name obrigatório');
    if (nm.length > 80) throw new Error('name muito grande (máx 80)');
    data.name = nm;
  }

  if (typeof body?.url === 'string') {
    const u = this.normalizeUrl(body.url);
    if (!u) throw new Error('url obrigatório');
    data.url = u;
  }

  if (typeof body?.description === 'string') {
    data.description = cleanNullableString(body.description);
  }

  // mover de pasta: mantém orderIndex atual, mas se mudar pasta, joga pro final da pasta destino
  if (typeof body?.folderId === 'string') {
    const newFolderId = body.folderId.trim() || null;
    const oldFolderId = exists.folderId ?? null;

    if (newFolderId !== oldFolderId) {
      const max = await (this.prisma as any).utilityLink.aggregate({
        where: { folderId: newFolderId },
        _max: { orderIndex: true },
      });
      data.folderId = newFolderId;
      data.orderIndex = Number(max?._max?.orderIndex ?? 0) + 1;
    }
  }

  // substituir imagem (opcional)
  if (file) {
    const ext = this.safeExtFromMimeOrName(file);
    if (!ext) throw new Error('Arquivo inválido. Envie png/jpg/jpeg/webp.');
    if (Number(file.size || 0) > 5 * 1024 * 1024) throw new Error('Arquivo muito grande. Limite: 5MB.');

    const uploadsDir = path.join(process.cwd(), 'uploads', 'admin', 'utilities');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const filename = `utility_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, file.buffer);

    data.imageUrl = `/uploads/admin/utilities/${filename}`;

    // tenta remover arquivo antigo
    const oldImg = String(exists.imageUrl || '').trim();
    if (oldImg && oldImg.startsWith('/uploads/')) {
      const rel = oldImg.replace(/^\/uploads\//, '');
      const full = path.join(process.cwd(), 'uploads', rel);
      try {
        if (fs.existsSync(full)) fs.unlinkSync(full);
      } catch {}
    }
  }

  // tags (se veio)
  const shouldUpdateTags = Array.isArray(body?.tagIds);
  const nextTagIds = shouldUpdateTags ? (body!.tagIds || []).map(String).filter(Boolean) : null;

  const updated = await (this.prisma as any).$transaction(async (tx: any) => {
    if (shouldUpdateTags) {
      await tx.utilityLinkTag.deleteMany({ where: { utilityId } });
      if (nextTagIds!.length) {
        await tx.utilityLinkTag.createMany({
          data: nextTagIds!.map((tagId) => ({ utilityId, tagId })),
          skipDuplicates: true,
        });
      }
    }

    // update principal
    return await tx.utilityLink.update({
      where: { id: utilityId },
      data,
      include: {
        folder: true,
        tags: { include: { tag: true } },
      },
    });
  });

  return this.toUtilityDto(updated);
}

async deleteUtility(id: string) {
  const utilityId = String(id || '').trim();
  if (!utilityId) throw new Error('id obrigatório');

  const exists = await (this.prisma as any).utilityLink.findUnique({
    where: { id: utilityId },
    select: { id: true, imageUrl: true },
  });

  if (!exists) throw new Error('Utilidade não encontrada');

  // apaga imagem física
  const img = String(exists.imageUrl || '').trim();
  if (img && img.startsWith('/uploads/')) {
    const rel = img.replace(/^\/uploads\//, '');
    const full = path.join(process.cwd(), 'uploads', rel);
    try {
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch {}
  }

  // apaga tags
  await (this.prisma as any).utilityLinkTag.deleteMany({ where: { utilityId } });
  await (this.prisma as any).utilityLink.delete({ where: { id: utilityId } });

  return { ok: true };
}

// ---------- REORDER (drag & drop) ----------

async reorderUtilities(orderedIds: string[]) {
  const ids = Array.isArray(orderedIds) ? orderedIds.map(String).filter(Boolean) : [];
  if (!ids.length) return { ok: true };

  // buscamos para descobrir pasta e garantir consistência
  const rows = await (this.prisma as any).utilityLink.findMany({
    where: { id: { in: ids } },
    select: { id: true, folderId: true },
  });

  if (!rows.length) return { ok: true };

  // garante que todos são da mesma pasta (ou todos null) para evitar bagunça
  const folderKey = String(rows[0].folderId ?? '');
  const mixed = rows.some((r: any) => String(r.folderId ?? '') !== folderKey);
  if (mixed) throw new Error('Reordenação inválida: itens de pastas diferentes');

  // atualiza ordem
  await (this.prisma as any).$transaction(
    ids.map((id, idx) =>
      (this.prisma as any).utilityLink.update({
        where: { id },
        data: { orderIndex: idx + 1 },
        select: { id: true },
      }),
    ),
  );

  return { ok: true };
}