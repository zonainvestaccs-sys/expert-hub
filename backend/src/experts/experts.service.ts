import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { parseCsv, normalizeHeader } from '../utils/csv';
import { createHash } from 'crypto';

function parseDateRange(from?: string, to?: string) {
  if (!from || !to) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;

  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  return { start, end };
}

function defaultMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));

  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;

  void start;
  return { from, to };
}

function isoDayLabel(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeekUTC(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setUTCDate(x.getUTCDate() + diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function monthKeyUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

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

function pickN(row: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    const v0 = row[k];
    if (v0 !== undefined && v0 !== null && String(v0).trim() !== '') return v0;

    const kn = normalizeHeader(k);
    const v1 = row[kn];
    if (v1 !== undefined && v1 !== null && String(v1).trim() !== '') return v1;

    const kUnd = kn.replace(/\s+/g, '_');
    const v2 = row[kUnd];
    if (v2 !== undefined && v2 !== null && String(v2).trim() !== '') return v2;

    const kNoUnd = kn.replace(/\s+/g, '');
    const v3 = row[kNoUnd];
    if (v3 !== undefined && v3 !== null && String(v3).trim() !== '') return v3;
  }
  return '';
}

function toNumberLoose(v: any) {
  if (v === null || v === undefined) return 0;
  const s0 = String(v).trim();
  if (!s0) return 0;

  const neg = s0.includes('-');

  let cleaned = s0.replace(/\s+/g, '').replace(/r\$/gi, '').replace(/[^\d,.-]/g, '');
  cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;

  return neg ? -Math.abs(n) : n;
}

/**
 * "06/03/2025" -> ISO "2025-03-06"
 * "06/03/2025 14:22" -> ISO "2025-03-06"
 * Se já vier ISO, retorna ISO.
 */
function parseBrDateToISO(input: any) {
  const s = String(input ?? '').trim();
  if (!s) return '';

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return '';

  const mm = m[2];
  const yyyy = m[3];
  const dd = m[1];

  return `${yyyy}-${mm}-${dd}`;
}

function isIsoInRange(iso: string, start: Date, end: Date) {
  if (!iso) return false;
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

type LeadsSortBy =
  | 'date'
  | 'firstDeposit'
  | 'deposits'
  | 'rev' // ✅ NOVO
  | 'withdrawals'
  | 'gains'
  | 'losses'
  | 'balance'
  | 'email'
  | 'wpp';

type ActivationsSortBy = 'date' | 'activation' | 'ftd' | 'deposit' | 'rev';

function isHexColor(v: any) {
  const s = String(v || '').trim();
  return /^#([0-9a-fA-F]{6})$/.test(s);
}

function stableRowKey(parts: string[]) {
  const raw = parts.map((x) => String(x || '').trim()).join('|');
  return createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

/* -------------------- NOTIFICAÇÕES: helpers -------------------- */

function normalizeTimeHHMM(v: any) {
  const s = String(v ?? '').trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return '';
  const [hh, mm] = s.split(':').map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizeTimes(v: any, limit = 10): string[] {
  const arr = Array.isArray(v) ? v : [];
  const ok = arr.map(normalizeTimeHHMM).filter(Boolean);
  const unique = Array.from(new Set(ok));
  unique.sort((a, b) => a.localeCompare(b));
  return unique.slice(0, limit);
}

function safeTimezone(v: any) {
  const s = String(v ?? '').trim();
  if (!s) return 'America/Sao_Paulo';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: s }).format(new Date());
    return s;
  } catch {
    return 'America/Sao_Paulo';
  }
}

function tzNowParts(timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';

  const yyyy = get('year');
  const mm = get('month');
  const dd = get('day');
  const hh = get('hour');
  const mi = get('minute');

  const dateIso = `${yyyy}-${mm}-${dd}`;
  const hhmm = `${hh}:${mi}`;

  return { dateIso, hhmm };
}

/* -------------------- ✅ REV SAQUE por mês (Sheets) -------------------- */

/**
 * Converte:
 * - "Jan/2026" "Janeiro/2026" "JAN/2026"
 * - "Feb/2026" "February/2026"
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
  m = low.match(/^([a-zç]+)\s*[\/ -]\s*(\d{4})$/);
  if (!m) return '';

  const mon = m[1];
  const yyyy = m[2];

  // ✅ PT + EN (abreviações e nomes completos)
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

    // EN (abreviações)
    feb: '02',
    apr: '04',
    may: '05',
    aug: '08',
    sep: '09',
    oct: '10',
    dec: '12',

    // EN (nomes completos)
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
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

function findValueColumnForRevSaque(headers: string[]) {
  // tenta achar uma coluna de valor de saque/rev saque.
  // prioridade: contém "rev saque", depois "saque", depois "withdraw"
  const h = headers.map((x) => normalizeHeader(x));
  const idxExact = h.findIndex((x) => x.includes('rev saque') || x.includes('rev_saque') || x.includes('revsq'));
  if (idxExact >= 0) return headers[idxExact];

  const idxSaque = h.findIndex((x) => x.includes('saque'));
  if (idxSaque >= 0) return headers[idxSaque];

  const idxWd = h.findIndex((x) => x.includes('withdraw'));
  if (idxWd >= 0) return headers[idxWd];

  return '';
}

@Injectable()
export class ExpertsService {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ cache simples (LEADS)
  private leadsCache = new Map<string, { at: number; items: any[] }>();
  private leadsCacheTtlMs = 10_000;

  // ✅ cache simples (ATIVAÇÕES)
  private activationsCache = new Map<string, { at: number; items: any[] }>();
  private activationsCacheTtlMs = 10_000;

  // ✅ cache simples (MÉTRICAS/RELATÓRIOS) — usado pra REV SAQUE por mês
  private metricsCsvCache = new Map<string, { at: number; rows: Record<string, any>[]; headers: string[] }>();
  private metricsCsvCacheTtlMs = 10_000;

  // ✅ cache simples (REV SAQUES) — NOVO (planilha própria)
  private revSaquesCsvCache = new Map<string, { at: number; rows: Record<string, any>[]; headers: string[] }>();
  private revSaquesCsvCacheTtlMs = 10_000;

  async getExpertOverview(expertId: string, params?: { from?: string; to?: string }) {
    if (!expertId) throw new Error('expertId required');

    const fallback = defaultMonthRange();
    const from = params?.from ?? fallback.from;
    const to = params?.to ?? fallback.to;

    const range = parseDateRange(from, to);
    if (!range) throw new Error('from/to inválidos (YYYY-MM-DD)');

    // 1) base: vem do banco (MetricsDaily)
    const agg = await this.prisma.metricsDaily.aggregate({
      where: { expertId, day: { gte: range.start, lte: range.end } },
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

    // 2) ✅ REV SAQUES por mês (planilha própria do expert)
    const revWithdrawalsCents = await this.sumRevSaqueByMonthInRange(expertId, range.start, range.end);

    return {
      period: { from, to },
      kpis: {
        leadsTotal: Number(s.leadsTotal ?? 0),
        leadsActive: Number(s.leadsActive ?? 0),
        depositsCount: Number(s.depositsCount ?? 0),
        depositsTotalCents: Number(s.depositsTotalCents ?? 0),
        ftdCount: Number(s.ftdCount ?? 0),

        // ✅ REV “normal” (banco)
        revCents: Number(s.revCents ?? 0),

        // ✅ NOVO: REV SAQUES (planilha)
        revWithdrawalsCents,

        salesCents: Number(s.salesCents ?? 0),
        salesCount: Number(s.salesCount ?? 0),
        trafficCents: Number(s.trafficCents ?? 0),
      },
    };
  }

  async getExpertProfile(expertId: string) {
    if (!expertId) throw new Error('expertId required');

    const u = await this.prisma.user.findUnique({
      where: { id: expertId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        photoUrl: true,

        description: true,
        youtubeUrl: true,
        instagramUrl: true,
        telegramUrl: true,
        whatsappUrl: true,

        leadsSheetId: true,
        leadsSheetTab: true,
        leadsSheetCsvUrl: true,
        leadsSheetGid: true,

        activationsSheetId: true,
        activationsSheetTab: true,
        activationsSheetCsvUrl: true,
        activationsSheetGid: true,

        // ✅ NOVO: métricas/relatórios
        metricsSheetId: true,
        metricsSheetTab: true,
        metricsSheetCsvUrl: true,
        metricsSheetGid: true,

        // ✅✅✅ NOVO: REV SAQUES (planilha própria)
        revSaquesSheetId: true,
        revSaquesSheetTab: true,
        revSaquesSheetCsvUrl: true,
        revSaquesSheetGid: true,

        // ✅✅✅ NOVO: DISPARO WHATSAPP
        whatsappBlastEnabled: true,
        whatsappBlastIframeUrl: true,

        notificationRule: {
          select: {
            id: true,
            isActive: true,
            times: true,
            timezone: true,
            updatedAt: true,
          },
        },
      } as any,
    });

    if (!u) throw new Error('Expert não encontrado');

    return {
      ...u,
      createdAt: new Date((u as any).createdAt).toISOString(),
      notificationRule: (u as any).notificationRule
        ? {
            ...(u as any).notificationRule,
            updatedAt: new Date((u as any).notificationRule.updatedAt).toISOString(),
          }
        : null,
    };
  }

  async getExpertSeries(expertId: string, params: { from?: string; to?: string; group?: 'day' | 'week' | 'month' }) {
    if (!expertId) throw new Error('expertId required');

    const fallback = defaultMonthRange();
    const from = params.from ?? fallback.from;
    const to = params.to ?? fallback.to;

    const range = parseDateRange(from, to);
    if (!range) throw new Error('from/to inválidos (YYYY-MM-DD)');

    const rows = await this.prisma.metricsDaily.findMany({
      where: { expertId, day: { gte: range.start, lte: range.end } },
      orderBy: { day: 'asc' },
      select: {
        day: true,
        leadsTotal: true,
        leadsActive: true,
        depositsTotalCents: true,
        ftdCount: true,
        revCents: true,
        salesCents: true,
        salesCount: true,
        trafficCents: true,
      },
    });

    const group = params.group ?? 'day';

    if (group === 'day') {
      const points = rows.map((r) => ({
        label: isoDayLabel(r.day),
        leadsTotal: Number(r.leadsTotal ?? 0),
        leadsActive: Number(r.leadsActive ?? 0),
        depositsBRL: Number(r.depositsTotalCents ?? 0) / 100,
        ftdCount: Number(r.ftdCount ?? 0),
        revBRL: Number(r.revCents ?? 0) / 100,
        salesBRL: Number(r.salesCents ?? 0) / 100,
        salesCount: Number(r.salesCount ?? 0),
        trafficBRL: Number(r.trafficCents ?? 0) / 100,
      }));

      return { period: { from, to }, group, points };
    }

    const map = new Map<string, any>();

    for (const r of rows) {
      const key = group === 'week' ? isoDayLabel(startOfWeekUTC(r.day)) : monthKeyUTC(r.day);

      if (!map.has(key)) {
        map.set(key, {
          key,
          label: key,
          leadsTotal: 0,
          leadsActive: 0,
          depositsBRL: 0,
          ftdCount: 0,
          revBRL: 0,
          salesBRL: 0,
          salesCount: 0,
          trafficBRL: 0,
        });
      }

      const it = map.get(key);
      it.leadsTotal += Number(r.leadsTotal ?? 0);
      it.leadsActive += Number(r.leadsActive ?? 0);
      it.depositsBRL += Number(r.depositsTotalCents ?? 0) / 100;
      it.ftdCount += Number(r.ftdCount ?? 0);
      it.revBRL += Number(r.revCents ?? 0) / 100;
      it.salesBRL += Number(r.salesCents ?? 0) / 100;
      it.salesCount += Number(r.salesCount ?? 0);
      it.trafficBRL += Number(r.trafficCents ?? 0) / 100;
    }

    const points = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
    return { period: { from, to }, group, points };
  }

  // =========================
  // ✅ TAGS (por expert)
  // =========================

  async listTags(expertId: string) {
    if (!expertId) throw new Error('expertId required');

    const tags = await this.prisma.tag.findMany({
      where: { expertId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, color: true, createdAt: true },
    });

    return { items: tags };
  }

  async createTag(expertId: string, body: any) {
    if (!expertId) throw new Error('expertId required');

    const name = String(body?.name || '').trim();
    const color = String(body?.color || '').trim();

    if (!name) throw new Error('Nome da tag é obrigatório');
    if (name.length > 40) throw new Error('Nome da tag muito grande (máx 40)');
    if (!isHexColor(color)) throw new Error('Cor inválida. Use HEX: #RRGGBB');

    const created = await this.prisma.tag.create({
      data: { expertId, name, color },
      select: { id: true, name: true, color: true, createdAt: true },
    });

    return { ok: true, tag: created };
  }

  async updateTag(expertId: string, tagId: string, body: any) {
    if (!expertId) throw new Error('expertId required');
    if (!tagId) throw new Error('tagId required');

    const data: any = {};
    if (typeof body?.name === 'string') {
      const name = body.name.trim();
      if (!name) throw new Error('Nome inválido');
      if (name.length > 40) throw new Error('Nome da tag muito grande (máx 40)');
      data.name = name;
    }
    if (typeof body?.color === 'string') {
      const color = body.color.trim();
      if (!isHexColor(color)) throw new Error('Cor inválida. Use HEX: #RRGGBB');
      data.color = color;
    }

    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, expertId },
      select: { id: true },
    });
    if (!tag) throw new Error('Tag não encontrada');

    const updated = await this.prisma.tag.update({
      where: { id: tagId },
      data,
      select: { id: true, name: true, color: true, createdAt: true },
    });

    return { ok: true, tag: updated };
  }

  async deleteTag(expertId: string, tagId: string) {
    if (!expertId) throw new Error('expertId required');
    if (!tagId) throw new Error('tagId required');

    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, expertId },
      select: { id: true },
    });
    if (!tag) throw new Error('Tag não encontrada');

    await this.prisma.leadTag.deleteMany({ where: { expertId, tagId } });
    await this.prisma.tag.delete({ where: { id: tagId } });

    return { ok: true };
  }

  async setLeadTag(expertId: string, leadKey: string, tagId: string, enabled: boolean) {
    if (!expertId) throw new Error('expertId required');
    if (!leadKey) throw new Error('leadKey required');
    if (!tagId) throw new Error('tagId required');

    const tag = await this.prisma.tag.findFirst({ where: { id: tagId, expertId }, select: { id: true } });
    if (!tag) throw new Error('Tag não encontrada');

    const key = String(leadKey).trim();
    if (!key) throw new Error('leadKey inválido');

    if (enabled) {
      await this.prisma.leadTag.upsert({
        where: { expertId_leadKey_tagId: { expertId, leadKey: key, tagId } },
        update: {},
        create: { expertId, leadKey: key, tagId },
      });
      return { ok: true, enabled: true };
    }

    await this.prisma.leadTag.deleteMany({
      where: { expertId, leadKey: key, tagId },
    });

    return { ok: true, enabled: false };
  }

  // ✅✅✅ BULK SET TAGS (substitui todas as tags de um lead)
  // Compatível com o expert-frontend: PUT/POST /expert/leads/:leadKey/tags  body: { tagIds: string[] }
  async setLeadTags(expertId: string, leadKey: string, body: any) {
    if (!expertId) throw new Error('expertId required');

    const key = String(leadKey || '').trim();
    if (!key) throw new Error('leadKey inválido');

    // ✅ garante string[]
    const raw =
      body && typeof body === 'object' && Array.isArray((body as any).tagIds)
        ? ((body as any).tagIds as unknown[])
        : [];

    const tagIds: string[] = Array.from(
      new Set(
        raw
          .map((x) => String(x).trim())
          .filter((x) => !!x),
      ),
    );

    if (tagIds.length > 60) throw new Error('Muitas tags selecionadas (máx 60).');

    // valida se as tags pertencem ao expert
    if (tagIds.length) {
      const found = await this.prisma.tag.findMany({
        where: { expertId, id: { in: tagIds } },
        select: { id: true },
      });

      const foundSet = new Set(found.map((t) => String(t.id)));
      const missing = tagIds.filter((id) => !foundSet.has(id));

      if (missing.length) {
        throw new Error(`Tag(s) inválida(s) para este expert: ${missing.join(', ')}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.leadTag.deleteMany({ where: { expertId, leadKey: key } });

      if (tagIds.length) {
        await tx.leadTag.createMany({
          data: tagIds.map((tagId) => ({ expertId, leadKey: key, tagId })),
          skipDuplicates: true,
        });
      }
    });

    return { ok: true, leadKey: key, tagIds };
  }

  // =========================
  // ✅ Leads do expert via Google Sheets CSV + tags
  // =========================
  async getExpertLeads(
    expertId: string,
    params: {
      from?: string;
      to?: string;
      page: number;
      pageSize: number;
      q?: string;
      sortBy?: LeadsSortBy;
      sortDir?: 'asc' | 'desc';
      fresh?: boolean;
      tagIds?: string[];
    },
  ) {
    if (!expertId) throw new Error('expertId required');

    const from = params.from;
    const to = params.to;

    const hasFromTo = !!from && !!to;
    const range = hasFromTo ? parseDateRange(from, to) : null;
    if (hasFromTo && !range) throw new Error('from/to inválidos (YYYY-MM-DD)');

    const expert = await this.prisma.user.findUnique({
      where: { id: expertId },
      select: {
        id: true,
        role: true,
        leadsSheetCsvUrl: true,
        leadsSheetId: true,
        leadsSheetTab: true,
        leadsSheetGid: true,
      } as any,
    });

    if (!expert) throw new Error('expertId não encontrado');
    // @ts-ignore
    if (String(expert.role) !== 'EXPERT') throw new Error('user não é EXPERT');

    const csvUrlDirect = String((expert as any).leadsSheetCsvUrl || '').trim();
    const sheetId = String((expert as any).leadsSheetId || '').trim();

    if (!csvUrlDirect && !sheetId) {
      return {
        source: 'GOOGLE_SHEETS',
        period: { from: from ?? null, to: to ?? null },
        page: 1,
        pageSize: Math.min(100, Math.max(1, params.pageSize || 25)),
        total: 0,
        items: [],
        warning: 'Planilha não configurada. Defina o link CSV (ou Sheet ID + Aba) no painel admin.',
      };
    }

    const resolvedUrl =
      csvUrlDirect ||
      buildSheetsCsvUrl({
        sheetId,
        tab: (expert as any).leadsSheetTab,
        gid: (expert as any).leadsSheetGid,
      });

    const cacheKey = `${expert.id}:${resolvedUrl}`;
    const now = Date.now();

    let mapped: Array<{
      id: string; // ✅ leadKey
      date: string; // ISO YYYY-MM-DD
      dateLabel: string;
      email: string;
      wpp: string;

      firstDeposit: number;
      deposits: number;

      // ✅ NOVO: REV na mesma planilha de leads
      rev: number;

      withdrawals: number;
      gains: number;
      losses: number;
      balance: number;

      raw?: any;
    }> = [];

    const cached = this.leadsCache.get(cacheKey);
    const canUseCache = !params.fresh && cached && now - cached.at < this.leadsCacheTtlMs;

    if (canUseCache) {
      // ✅ garante compat com cache antigo (sem rev)
      mapped = (cached!.items as any[]).map((it) => ({
        ...it,
        rev: Number((it as any)?.rev ?? 0),
      })) as any;
    } else {
      const res = await fetch(resolvedUrl);
      if (!res.ok) {
        throw new Error(
          `Não consegui acessar a planilha CSV (HTTP ${res.status}). Confere se a planilha está pública/compartilhada.`,
        );
      }

      const text = await res.text();
      const matrix = parseCsv(text);

      if (!matrix.length) {
        mapped = [];
      } else {
        const headersRaw = matrix[0] || [];
        const headers = headersRaw.map((h) => normalizeHeader(h));
        const body = matrix.slice(1);

        const rows = body
          .map((line) => {
            const obj: Record<string, any> = {};
            for (let i = 0; i < headers.length; i++) {
              obj[headers[i] || `col_${i}`] = (line[i] ?? '').trim();
            }
            return obj;
          })
          .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));

        mapped = rows.map((r, idx) => {
          const dateLabel = String(
            pickN(r, ['DATA CRIAÇÃO', 'DATA CRIACAO', 'DATA', 'DATA CADASTRO', 'DATA DE CRIACAO']),
          ).trim();

          const date = parseBrDateToISO(dateLabel);

          const email = String(pickN(r, ['EMAIL', 'E-MAIL'])).trim();

          const wppRaw = String(
            pickN(r, [
              'WPP',
              'WHATSAPP',
              'WHATS APP',
              'WHATS',
              'WHATSAPP / WPP',
              'TELEFONE',
              'TELEFONE WHATSAPP',
              'TEL',
              'CELULAR',
              'NUMERO',
              'NÚMERO',
              'PHONE',
            ]),
          ).trim();

          const wpp = wppRaw.replace(/\D+/g, '');

          const firstDeposit = toNumberLoose(pickN(r, ['PRIMEIRO DEPOSITO', 'PRIMEIRO DEPÓSITO', 'FTD']));
          const deposits = toNumberLoose(pickN(r, ['DEPOSITOS', 'DEPÓSITOS']));

          // ✅ NOVO: REV do lead na mesma planilha
          const rev = toNumberLoose(
            pickN(r, [
              'REV',
              'REVENUE',
              'RECEITA',
              'COMISSAO',
              'COMISSÃO',
              'COMMISSION',
            ]),
          );

          const withdrawals = toNumberLoose(pickN(r, ['SAQUES']));
          const gains = toNumberLoose(pickN(r, ['GANHOS']));
          const losses = toNumberLoose(pickN(r, ['PERDAS']));
          const balance = toNumberLoose(pickN(r, ['BALANCE', 'BALANCO', 'BALANÇO', 'SALDO']));

          const id = String(pickN(r, ['ID'])).trim() || String(idx + 1);

          return {
            id,
            date,
            dateLabel,
            email,
            wpp,
            firstDeposit,
            deposits,
            rev,
            withdrawals,
            gains,
            losses,
            balance,
            raw: r,
          };
        });

        this.leadsCache.set(cacheKey, { at: now, items: mapped });
      }
    }

    let filtered = mapped;
    if (range) {
      filtered = filtered.filter((l) => isIsoInRange(l.date, range.start, range.end));
    }

    const qq = (params.q || '').trim().toLowerCase();
    if (qq) {
      filtered = filtered.filter((l) => {
        const hay = `${l.email || ''} ${l.wpp || ''} ${l.dateLabel || ''} ${l.date || ''}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    const tagIds = (params.tagIds || [])
      .map((x) => String(x).trim())
      .filter(Boolean);

    if (tagIds.length) {
      const rows = await this.prisma.leadTag.findMany({
        where: { expertId, tagId: { in: tagIds } },
        select: { leadKey: true },
        distinct: ['leadKey'],
      });
      const set = new Set(rows.map((r) => String(r.leadKey)));
      filtered = filtered.filter((l) => set.has(String(l.id)));
    }

    const sortBy: LeadsSortBy = (params.sortBy as any) || 'date';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'asc' ? 'asc' : 'desc';
    const dir = sortDir === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      const va: any = (a as any)[sortBy];
      const vb: any = (b as any)[sortBy];

      if (sortBy === 'email' || sortBy === 'wpp' || sortBy === 'date') {
        const sa = String(va || '');
        const sb = String(vb || '');
        return sa.localeCompare(sb) * dir;
      }

      const na = Number(va ?? 0);
      const nb = Number(vb ?? 0);
      return (na - nb) * dir;
    });

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));
    const total = filtered.length;
    const start = (page - 1) * pageSize;

    const itemsPage = filtered.slice(start, start + pageSize);

    const leadKeys = itemsPage.map((it) => String(it.id));
    const taggings = leadKeys.length
      ? await this.prisma.leadTag.findMany({
          where: { expertId, leadKey: { in: leadKeys } },
          include: { tag: { select: { id: true, name: true, color: true } } },
        })
      : [];

    const mapTags = new Map<string, Array<{ id: string; name: string; color: string }>>();
    for (const lt of taggings) {
      const k = String((lt as any).leadKey);
      if (!mapTags.has(k)) mapTags.set(k, []);
      mapTags.get(k)!.push((lt as any).tag);
    }

    const items = itemsPage.map((it) => ({
      ...it,
      leadKey: String(it.id),
      tags: mapTags.get(String(it.id)) ?? [],
    }));

    return {
      source: 'GOOGLE_SHEETS',
      period: { from: from ?? null, to: to ?? null },
      page,
      pageSize,
      total,
      items,
      csvUrl: resolvedUrl,
    };
  }

  // =========================
  // ✅ ATIVAÇÕES (Sheets CSV)
  // =========================
  async getExpertActivations(
    expertId: string,
    params: {
      from?: string;
      to?: string;
      page: number;
      pageSize: number;
      q?: string;
      sortBy?: ActivationsSortBy;
      sortDir?: 'asc' | 'desc';
      fresh?: boolean;
    },
  ) {
    if (!expertId) throw new Error('expertId required');

    const from = params.from;
    const to = params.to;

    const hasFromTo = !!from && !!to;
    const range = hasFromTo ? parseDateRange(from, to) : null;
    if (hasFromTo && !range) throw new Error('from/to inválidos (YYYY-MM-DD)');

    const expert = await this.prisma.user.findUnique({
      where: { id: expertId },
      select: {
        id: true,
        role: true,

        activationsSheetCsvUrl: true,
        activationsSheetId: true,
        activationsSheetTab: true,
        activationsSheetGid: true,
      } as any,
    });

    if (!expert) throw new Error('expertId não encontrado');
    // @ts-ignore
    if (String(expert.role) !== 'EXPERT') throw new Error('user não é EXPERT');

    const csvUrlDirect = String((expert as any).activationsSheetCsvUrl || '').trim();
    const sheetId = String((expert as any).activationsSheetId || '').trim();

    if (!csvUrlDirect && !sheetId) {
      return {
        source: 'GOOGLE_SHEETS',
        period: { from: from ?? null, to: to ?? null },
        page: 1,
        pageSize: Math.min(100, Math.max(1, params.pageSize || 25)),
        total: 0,
        items: [],
        warning: 'Planilha de ativações não configurada. Defina o link CSV (ou Sheet ID + Aba) no painel admin.',
      };
    }

    const resolvedUrl =
      csvUrlDirect ||
      buildSheetsCsvUrl({
        sheetId,
        tab: (expert as any).activationsSheetTab,
        gid: (expert as any).activationsSheetGid,
      });

    const cacheKey = `${expert.id}:${resolvedUrl}`;
    const now = Date.now();

    let mapped: Array<{
      id: string; // chave estável
      date: string; // ISO yyyy-mm-dd
      dateLabel: string; // label original
      activation: string;
      description: string;
      ftd: number;
      deposit: number;
      rev: number;
      raw?: any;
    }> = [];

    const cached = this.activationsCache.get(cacheKey);
    const canUseCache = !params.fresh && cached && now - cached.at < this.activationsCacheTtlMs;

    if (canUseCache) {
      mapped = cached!.items as any;
    } else {
      const res = await fetch(resolvedUrl);
      if (!res.ok) {
        throw new Error(
          `Não consegui acessar a planilha CSV de ativações (HTTP ${res.status}). Confere se a planilha está pública/compartilhada.`,
        );
      }

      const text = await res.text();
      const matrix = parseCsv(text);

      if (!matrix.length) {
        mapped = [];
      } else {
        const headersRaw = matrix[0] || [];
        const headers = headersRaw.map((h) => normalizeHeader(h));
        const body = matrix.slice(1);

        const rows = body
          .map((line) => {
            const obj: Record<string, any> = {};
            for (let i = 0; i < headers.length; i++) {
              obj[headers[i] || `col_${i}`] = (line[i] ?? '').trim();
            }
            return obj;
          })
          .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));

        mapped = rows.map((r, idx) => {
          const dateLabel = String(pickN(r, ['DATA', 'DATA CRIAÇÃO', 'DATA CRIACAO', 'DIA'])).trim();
          const date = parseBrDateToISO(dateLabel);

          const activation = String(pickN(r, ['ATIVACAO', 'ATIVAÇÃO', 'TITULO', 'TÍTULO'])).trim();
          const description = String(
            pickN(r, ['DESCRICAO (OPCIONAL)', 'DESCRIÇÃO (OPCIONAL)', 'DESCRICAO', 'DESCRIÇÃO']),
          ).trim();

          const ftd = toNumberLoose(pickN(r, ['FTD', 'FTDS']));
          const deposit = toNumberLoose(pickN(r, ['DEPOSITO', 'DEPÓSITO', 'DEPOSITOS', 'DEPÓSITOS']));
          const rev = toNumberLoose(pickN(r, ['REV']));

          const stableId =
            String(pickN(r, ['ID'])).trim() ||
            stableRowKey([date, activation, description, String(ftd), String(deposit), String(rev), String(idx)]);

          return {
            id: stableId,
            date,
            dateLabel,
            activation,
            description,
            ftd,
            deposit,
            rev,
            raw: r,
          };
        });

        this.activationsCache.set(cacheKey, { at: now, items: mapped });
      }
    }

    let filtered = mapped;
    if (range) {
      filtered = filtered.filter((l) => isIsoInRange(l.date, range.start, range.end));
    }

    const qq = (params.q || '').trim().toLowerCase();
    if (qq) {
      filtered = filtered.filter((l) => {
        const hay = `${l.activation || ''} ${l.description || ''} ${l.dateLabel || ''} ${l.date || ''}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    const sortBy: ActivationsSortBy = (params.sortBy as any) || 'date';
    const sortDir: 'asc' | 'desc' = params.sortDir === 'asc' ? 'asc' : 'desc';
    const dir = sortDir === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      if (sortBy === 'date') return String(a.date || '').localeCompare(String(b.date || '')) * dir;
      if (sortBy === 'activation') return String(a.activation || '').localeCompare(String(b.activation || '')) * dir;

      const va = Number((a as any)[sortBy] ?? 0);
      const vb = Number((b as any)[sortBy] ?? 0);
      return (va - vb) * dir;
    });

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));
    const total = filtered.length;
    const start = (page - 1) * pageSize;

    const itemsPage = filtered.slice(start, start + pageSize);

    return {
      source: 'GOOGLE_SHEETS',
      period: { from: from ?? null, to: to ?? null },
      page,
      pageSize,
      total,
      items: itemsPage,
      csvUrl: resolvedUrl,
    };
  }

  // =========================
  // ✅ NOTIFICAÇÕES (RULE)
  // =========================

  async getExpertNotificationRule(expertId: string) {
    if (!expertId) throw new Error('expertId required');

    const rule = await this.prisma.expertNotificationRule.findUnique({
      where: { expertId },
      select: { id: true, expertId: true, isActive: true, times: true, timezone: true, createdAt: true, updatedAt: true },
    });

    if (!rule) {
      return {
        expertId,
        isActive: true,
        times: [],
        timezone: 'America/Sao_Paulo',
        createdAt: null,
        updatedAt: null,
      };
    }

    return {
      ...rule,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  async upsertExpertNotificationRule(expertId: string, body: any) {
    if (!expertId) throw new Error('expertId required');

    const isActive = body?.isActive === false ? false : true;
    const timezone = safeTimezone(body?.timezone);
    const times = normalizeTimes(body?.times, 10);

    const u = await this.prisma.user.findUnique({ where: { id: expertId }, select: { id: true, role: true } });
    if (!u) throw new Error('expertId não encontrado');
    // @ts-ignore
    if (String(u.role) !== 'EXPERT') throw new Error('user não é EXPERT');

    const rule = await this.prisma.expertNotificationRule.upsert({
      where: { expertId },
      update: { isActive, timezone, times },
      create: { expertId, isActive, timezone, times },
      select: { id: true, expertId: true, isActive: true, timezone: true, times: true, createdAt: true, updatedAt: true },
    });

    return {
      ...rule,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  // =========================
  // ✅ NOTIFICAÇÕES (LIST / READ)
  // =========================

  async listExpertNotifications(expertId: string, params: { page: number; pageSize: number; unreadOnly?: boolean }) {
    if (!expertId) throw new Error('expertId required');

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize || 20));
    const unreadOnly = !!params.unreadOnly;

    const where: any = { expertId };
    if (unreadOnly) where.isRead = false;

    const [total, items, unreadCount] = await Promise.all([
      this.prisma.expertNotification.count({ where }),
      this.prisma.expertNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          message: true,
          kind: true,
          dateIso: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.expertNotification.count({ where: { expertId, isRead: false } }),
    ]);

    return {
      page,
      pageSize,
      total,
      unreadCount,
      items: items.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt ? n.readAt.toISOString() : null,
      })),
    };
  }

  async markNotificationRead(expertId: string, notificationId: string) {
    if (!expertId) throw new Error('expertId required');
    if (!notificationId) throw new Error('notificationId required');

    const n = await this.prisma.expertNotification.findFirst({
      where: { id: notificationId, expertId },
      select: { id: true, isRead: true },
    });
    if (!n) throw new Error('Notificação não encontrada');

    if (n.isRead) return { ok: true, already: true };

    await this.prisma.expertNotification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return { ok: true };
  }

  async markAllNotificationsRead(expertId: string) {
    if (!expertId) throw new Error('expertId required');

    await this.prisma.expertNotification.updateMany({
      where: { expertId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { ok: true };
  }

  // =========================
  // ✅ NOTIFICAÇÕES (GERAR: usado pelo Scheduler)
  // =========================

  async createActivationNotificationIfNeeded(params: {
    expertId: string;
    dateIso: string;
    hhmm: string;
    fresh?: boolean;
  }) {
    const { expertId, dateIso, hhmm } = params;

    const act = await this.getExpertActivations(expertId, {
      from: dateIso,
      to: dateIso,
      page: 1,
      pageSize: 5,
      sortBy: 'date',
      sortDir: 'asc',
      fresh: params.fresh ?? false,
    });

    const first = (act as any)?.items?.[0] ?? null;
    const activationName = String(first?.activation ?? '').trim();
    if (!activationName) return { ok: true, skipped: 'no-activation' };

    const title = `Ativação de hoje • ${hhmm}`;
    const message = first?.description
      ? `${activationName}\n\n${String(first.description).trim()}`
      : `${activationName}`;

    const exists = await this.prisma.expertNotification.findFirst({
      where: { expertId, kind: 'ACTIVATION', dateIso, title },
      select: { id: true },
    });
    if (exists) return { ok: true, skipped: 'duplicate', id: exists.id };

    const created = await this.prisma.expertNotification.create({
      data: {
        expertId,
        kind: 'ACTIVATION',
        dateIso,
        title,
        message,
      },
      select: { id: true, title: true, message: true, kind: true, dateIso: true, createdAt: true, isRead: true },
    });

    return {
      ok: true,
      created: {
        ...created,
        createdAt: created.createdAt.toISOString(),
      },
    };
  }

  async runNotificationsTickNow() {
    const rules = await this.prisma.expertNotificationRule.findMany({
      where: { isActive: true },
      select: { expertId: true, timezone: true, times: true },
    });

    const actions: Array<{
      expertId: string;
      timezone: string;
      dateIso: string;
      hhmm: string;
    }> = [];

    for (const r of rules) {
      const tz = safeTimezone(r.timezone);
      const { dateIso, hhmm } = tzNowParts(tz);

      const times = Array.isArray(r.times) ? r.times : [];
      if (!times.includes(hhmm)) continue;

      actions.push({ expertId: r.expertId, timezone: tz, dateIso, hhmm });
    }

    return { actions };
  }

  /* -------------------- ✅ REV SAQUE: implementação -------------------- */

  private async getMetricsCsvConfig(expertId: string) {
    const expert = await this.prisma.user.findUnique({
      where: { id: expertId },
      select: {
        id: true,
        role: true,
        metricsSheetCsvUrl: true,
        metricsSheetId: true,
        metricsSheetTab: true,
        metricsSheetGid: true,
      } as any,
    });

    if (!expert) throw new Error('expertId não encontrado');
    // @ts-ignore
    if (String(expert.role) !== 'EXPERT') throw new Error('user não é EXPERT');

    const csvUrlDirect = String((expert as any).metricsSheetCsvUrl || '').trim();
    const sheetId = String((expert as any).metricsSheetId || '').trim();

    if (!csvUrlDirect && !sheetId) return null;

    const resolvedUrl =
      csvUrlDirect ||
      buildSheetsCsvUrl({
        sheetId,
        tab: (expert as any).metricsSheetTab,
        gid: (expert as any).metricsSheetGid,
      });

    return { resolvedUrl };
  }

  /**
   * ✅ NOVO: config do CSV de REV SAQUES (planilha própria)
   */
  private async getRevSaquesCsvConfig(expertId: string) {
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

    if (!expert) throw new Error('expertId não encontrado');
    // @ts-ignore
    if (String(expert.role) !== 'EXPERT') throw new Error('user não é EXPERT');

    const csvUrlDirect = String((expert as any).revSaquesSheetCsvUrl || '').trim();
    const sheetId = String((expert as any).revSaquesSheetId || '').trim();

    if (!csvUrlDirect && !sheetId) return null;

    const resolvedUrl =
      csvUrlDirect ||
      buildSheetsCsvUrl({
        sheetId,
        tab: (expert as any).revSaquesSheetTab,
        gid: (expert as any).revSaquesSheetGid,
      });

    return { resolvedUrl };
  }

  /**
   * Lê CSV de métricas (uma aba que pode ser “mensal” como no print) e devolve:
   * - headers
   * - rows (objetos por linha)
   */
  private async loadMetricsCsvRows(expertId: string, opts?: { fresh?: boolean }) {
    const cfg = await this.getMetricsCsvConfig(expertId);
    if (!cfg?.resolvedUrl) return null;

    const cacheKey = `${expertId}:${cfg.resolvedUrl}`;
    const now = Date.now();
    const cached = this.metricsCsvCache.get(cacheKey);
    const canUseCache = !opts?.fresh && cached && now - cached.at < this.metricsCsvCacheTtlMs;

    if (canUseCache) return cached!;

    const res = await fetch(cfg.resolvedUrl);
    if (!res.ok) {
      throw new Error(
        `Não consegui acessar a planilha CSV de métricas (HTTP ${res.status}). Confere se a planilha está pública/compartilhada.`,
      );
    }

    const text = await res.text();
    const matrix = parseCsv(text);
    if (!matrix.length) {
      const empty = { at: now, headers: [], rows: [] as Record<string, any>[] };
      this.metricsCsvCache.set(cacheKey, empty);
      return empty;
    }

    const headersRaw = matrix[0] || [];
    const headers = headersRaw.map((h) => String(h ?? '').trim());

    const normHeaders = headers.map((h) => normalizeHeader(h));
    const body = matrix.slice(1);

    const rows = body
      .map((line) => {
        const obj: Record<string, any> = {};
        for (let i = 0; i < normHeaders.length; i++) {
          obj[normHeaders[i] || `col_${i}`] = (line[i] ?? '').trim();
        }
        return obj;
      })
      .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));

    const payload = { at: now, headers, rows };
    this.metricsCsvCache.set(cacheKey, payload);
    return payload;
  }

  /**
   * ✅ NOVO: Lê CSV de REV SAQUES (planilha com MÊS e SAQUE)
   */
  private async loadRevSaquesCsvRows(expertId: string, opts?: { fresh?: boolean }) {
    const cfg = await this.getRevSaquesCsvConfig(expertId);
    if (!cfg?.resolvedUrl) return null;

    const cacheKey = `${expertId}:${cfg.resolvedUrl}`;
    const now = Date.now();
    const cached = this.revSaquesCsvCache.get(cacheKey);
    const canUseCache = !opts?.fresh && cached && now - cached.at < this.revSaquesCsvCacheTtlMs;

    if (canUseCache) return cached!;

    const res = await fetch(cfg.resolvedUrl);
    if (!res.ok) {
      throw new Error(
        `Não consegui acessar a planilha CSV de REV SAQUES (HTTP ${res.status}). Confere se a planilha está pública/compartilhada.`,
      );
    }

    const text = await res.text();
    const matrix = parseCsv(text);
    if (!matrix.length) {
      const empty = { at: now, headers: [], rows: [] as Record<string, any>[] };
      this.revSaquesCsvCache.set(cacheKey, empty);
      return empty;
    }

    const headersRaw = matrix[0] || [];
    const headers = headersRaw.map((h) => String(h ?? '').trim());

    const normHeaders = headers.map((h) => normalizeHeader(h));
    const body = matrix.slice(1);

    const rows = body
      .map((line) => {
        const obj: Record<string, any> = {};
        for (let i = 0; i < normHeaders.length; i++) {
          obj[normHeaders[i] || `col_${i}`] = (line[i] ?? '').trim();
        }
        return obj;
      })
      .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));

    const payload = { at: now, headers, rows };
    this.revSaquesCsvCache.set(cacheKey, payload);
    return payload;
  }

  /**
   * Extrai e soma REV SAQUE por mês:
   * Espera algo como:
   * - coluna "MÊS" com "Jan/2026"
   * - coluna "SAQUE PUMABROKER" (ou qualquer header que contenha "saque")
   */
  private async revSaqueCentsByMonth(expertId: string): Promise<Map<string, number>> {
    const parsed = await this.loadRevSaquesCsvRows(expertId);
    const map = new Map<string, number>();
    if (!parsed) return map;

    // acha coluna do mês
    // (normalizeHeader vai virar algo como "mes")
    const monthCol = normalizeHeader('MÊS') || 'mes';

    // tenta achar a coluna de valor automaticamente pelos headers originais
    const valueColOriginal = findValueColumnForRevSaque(parsed.headers);
    const valueCol = valueColOriginal ? normalizeHeader(valueColOriginal) : '';

    for (const r of parsed.rows) {
      const monthLabel =
        String(
          pickN(r, [
            'MES',
            'MÊS',
            'MONTH',
            'PERIODO',
            'PERÍODO',
            'COMPETENCIA',
            'COMPETÊNCIA',
          ]),
        ).trim() || String((r as any)[monthCol] ?? '').trim();

      const key = parsePtMonthToKey(monthLabel);
      if (!key) continue;

      let val = 0;

      if (valueCol) {
        val = toNumberLoose((r as any)[valueCol]);
      } else {
        // fallback: procura em qualquer coluna que tenha "saque"
        const candidates = Object.keys(r || {});
        const col = candidates.find((c) => normalizeHeader(c).includes('saque')) || '';
        val = col ? toNumberLoose((r as any)[col]) : 0;
      }

      if (!Number.isFinite(val) || val === 0) {
        // permite valores 0, mas não soma
        continue;
      }

      // ✅ valores da planilha estão em REAIS => converte para CENTAVOS
      const cents = Math.round(val * 100);

      // ✅ soma múltiplas linhas do mesmo mês (Jan/2026 repetido)
      map.set(key, (map.get(key) ?? 0) + cents);
    }

    return map;
  }

  private async sumRevSaqueByMonthInRange(expertId: string, start: Date, end: Date): Promise<number> {
    const byMonth = await this.revSaqueCentsByMonth(expertId);
    let sum = 0;

    for (const [monthKey, cents] of byMonth.entries()) {
      if (!monthKeyInRange(monthKey, start, end)) continue;
      sum += Number(cents || 0);
    }

    return sum;
  }
}
