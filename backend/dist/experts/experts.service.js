"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpertsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const csv_1 = require("../utils/csv");
const crypto_1 = require("crypto");
function parseDateRange(from, to) {
    if (!from || !to)
        return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from))
        return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to))
        return null;
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
function isoDayLabel(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function startOfWeekUTC(d) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = x.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    x.setUTCDate(x.getUTCDate() + diff);
    x.setUTCHours(0, 0, 0, 0);
    return x;
}
function monthKeyUTC(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}
function buildSheetsCsvUrl(params) {
    const { sheetId, tab, gid } = params;
    if (tab && tab.trim()) {
        const sheet = encodeURIComponent(tab.trim());
        return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${sheet}`;
    }
    if (gid && gid.trim()) {
        return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid.trim())}`;
    }
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv`;
}
function pickN(row, keys) {
    for (const k of keys) {
        const v0 = row[k];
        if (v0 !== undefined && v0 !== null && String(v0).trim() !== '')
            return v0;
        const kn = (0, csv_1.normalizeHeader)(k);
        const v1 = row[kn];
        if (v1 !== undefined && v1 !== null && String(v1).trim() !== '')
            return v1;
        const kUnd = kn.replace(/\s+/g, '_');
        const v2 = row[kUnd];
        if (v2 !== undefined && v2 !== null && String(v2).trim() !== '')
            return v2;
        const kNoUnd = kn.replace(/\s+/g, '');
        const v3 = row[kNoUnd];
        if (v3 !== undefined && v3 !== null && String(v3).trim() !== '')
            return v3;
    }
    return '';
}
function toNumberLoose(v) {
    if (v === null || v === undefined)
        return 0;
    const s0 = String(v).trim();
    if (!s0)
        return 0;
    const neg = s0.includes('-');
    let cleaned = s0.replace(/\s+/g, '').replace(/r\$/gi, '').replace(/[^\d,.-]/g, '');
    cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    const n = Number(cleaned);
    if (!Number.isFinite(n))
        return 0;
    return neg ? -Math.abs(n) : n;
}
function parseBrDateToISO(input) {
    const s = String(input ?? '').trim();
    if (!s)
        return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s))
        return s.slice(0, 10);
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m)
        return '';
    const mm = m[2];
    const yyyy = m[3];
    const dd = m[1];
    return `${yyyy}-${mm}-${dd}`;
}
function isIsoInRange(iso, start, end) {
    if (!iso)
        return false;
    const d = new Date(`${iso}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()))
        return false;
    return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}
function isHexColor(v) {
    const s = String(v || '').trim();
    return /^#([0-9a-fA-F]{6})$/.test(s);
}
function stableRowKey(parts) {
    const raw = parts.map((x) => String(x || '').trim()).join('|');
    return (0, crypto_1.createHash)('sha1').update(raw).digest('hex').slice(0, 16);
}
function normalizeTimeHHMM(v) {
    const s = String(v ?? '').trim();
    if (!/^\d{2}:\d{2}$/.test(s))
        return '';
    const [hh, mm] = s.split(':').map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm))
        return '';
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
        return '';
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function normalizeTimes(v, limit = 10) {
    const arr = Array.isArray(v) ? v : [];
    const ok = arr.map(normalizeTimeHHMM).filter(Boolean);
    const unique = Array.from(new Set(ok));
    unique.sort((a, b) => a.localeCompare(b));
    return unique.slice(0, limit);
}
function safeTimezone(v) {
    const s = String(v ?? '').trim();
    if (!s)
        return 'America/Sao_Paulo';
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: s }).format(new Date());
        return s;
    }
    catch {
        return 'America/Sao_Paulo';
    }
}
function tzNowParts(timeZone) {
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
    const get = (t) => parts.find((p) => p.type === t)?.value || '';
    const yyyy = get('year');
    const mm = get('month');
    const dd = get('day');
    const hh = get('hour');
    const mi = get('minute');
    const dateIso = `${yyyy}-${mm}-${dd}`;
    const hhmm = `${hh}:${mi}`;
    return { dateIso, hhmm };
}
function parsePtMonthToKey(input) {
    const raw = String(input ?? '').trim();
    if (!raw)
        return '';
    let m = raw.match(/^(\d{4})[-\/](\d{1,2})$/);
    if (m) {
        const yyyy = m[1];
        const mm = String(Number(m[2])).padStart(2, '0');
        if (Number(mm) < 1 || Number(mm) > 12)
            return '';
        return `${yyyy}-${mm}`;
    }
    m = raw.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) {
        const mm = String(Number(m[1])).padStart(2, '0');
        const yyyy = m[2];
        if (Number(mm) < 1 || Number(mm) > 12)
            return '';
        return `${yyyy}-${mm}`;
    }
    const low = raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    m = low.match(/^([a-zç]+)\s*[\/ -]\s*(\d{4})$/);
    if (!m)
        return '';
    const mon = m[1];
    const yyyy = m[2];
    const map = {
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
    };
    const mm = map[mon];
    if (!mm)
        return '';
    return `${yyyy}-${mm}`;
}
function monthKeyInRange(monthKey, start, end) {
    if (!/^\d{4}-\d{2}$/.test(monthKey))
        return false;
    const d = new Date(`${monthKey}-01T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()))
        return false;
    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return monthStart.getTime() <= end.getTime() && monthEnd.getTime() >= start.getTime();
}
function findValueColumnForRevSaque(headers) {
    const h = headers.map((x) => (0, csv_1.normalizeHeader)(x));
    const idxExact = h.findIndex((x) => x.includes('rev saque') || x.includes('rev_saque') || x.includes('revsq'));
    if (idxExact >= 0)
        return headers[idxExact];
    const idxSaque = h.findIndex((x) => x.includes('saque'));
    if (idxSaque >= 0)
        return headers[idxSaque];
    const idxWd = h.findIndex((x) => x.includes('withdraw'));
    if (idxWd >= 0)
        return headers[idxWd];
    return '';
}
let ExpertsService = class ExpertsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    leadsCache = new Map();
    leadsCacheTtlMs = 10_000;
    activationsCache = new Map();
    activationsCacheTtlMs = 10_000;
    metricsCsvCache = new Map();
    metricsCsvCacheTtlMs = 10_000;
    revSaquesCsvCache = new Map();
    revSaquesCsvCacheTtlMs = 10_000;
    async getExpertOverview(expertId, params) {
        if (!expertId)
            throw new Error('expertId required');
        const fallback = defaultMonthRange();
        const from = params?.from ?? fallback.from;
        const to = params?.to ?? fallback.to;
        const range = parseDateRange(from, to);
        if (!range)
            throw new Error('from/to inválidos (YYYY-MM-DD)');
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
        const revWithdrawalsCents = await this.sumRevSaqueByMonthInRange(expertId, range.start, range.end);
        return {
            period: { from, to },
            kpis: {
                leadsTotal: Number(s.leadsTotal ?? 0),
                leadsActive: Number(s.leadsActive ?? 0),
                depositsCount: Number(s.depositsCount ?? 0),
                depositsTotalCents: Number(s.depositsTotalCents ?? 0),
                ftdCount: Number(s.ftdCount ?? 0),
                revCents: Number(s.revCents ?? 0),
                revWithdrawalsCents,
                salesCents: Number(s.salesCents ?? 0),
                salesCount: Number(s.salesCount ?? 0),
                trafficCents: Number(s.trafficCents ?? 0),
            },
        };
    }
    async getExpertProfile(expertId) {
        if (!expertId)
            throw new Error('expertId required');
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
                metricsSheetId: true,
                metricsSheetTab: true,
                metricsSheetCsvUrl: true,
                metricsSheetGid: true,
                revSaquesSheetId: true,
                revSaquesSheetTab: true,
                revSaquesSheetCsvUrl: true,
                revSaquesSheetGid: true,
                notificationRule: {
                    select: {
                        id: true,
                        isActive: true,
                        times: true,
                        timezone: true,
                        updatedAt: true,
                    },
                },
            },
        });
        if (!u)
            throw new Error('Expert não encontrado');
        return {
            ...u,
            createdAt: new Date(u.createdAt).toISOString(),
            notificationRule: u.notificationRule
                ? {
                    ...u.notificationRule,
                    updatedAt: new Date(u.notificationRule.updatedAt).toISOString(),
                }
                : null,
        };
    }
    async getExpertSeries(expertId, params) {
        if (!expertId)
            throw new Error('expertId required');
        const fallback = defaultMonthRange();
        const from = params.from ?? fallback.from;
        const to = params.to ?? fallback.to;
        const range = parseDateRange(from, to);
        if (!range)
            throw new Error('from/to inválidos (YYYY-MM-DD)');
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
        const map = new Map();
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
    async listTags(expertId) {
        if (!expertId)
            throw new Error('expertId required');
        const tags = await this.prisma.tag.findMany({
            where: { expertId },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, color: true, createdAt: true },
        });
        return { items: tags };
    }
    async createTag(expertId, body) {
        if (!expertId)
            throw new Error('expertId required');
        const name = String(body?.name || '').trim();
        const color = String(body?.color || '').trim();
        if (!name)
            throw new Error('Nome da tag é obrigatório');
        if (name.length > 40)
            throw new Error('Nome da tag muito grande (máx 40)');
        if (!isHexColor(color))
            throw new Error('Cor inválida. Use HEX: #RRGGBB');
        const created = await this.prisma.tag.create({
            data: { expertId, name, color },
            select: { id: true, name: true, color: true, createdAt: true },
        });
        return { ok: true, tag: created };
    }
    async updateTag(expertId, tagId, body) {
        if (!expertId)
            throw new Error('expertId required');
        if (!tagId)
            throw new Error('tagId required');
        const data = {};
        if (typeof body?.name === 'string') {
            const name = body.name.trim();
            if (!name)
                throw new Error('Nome inválido');
            if (name.length > 40)
                throw new Error('Nome da tag muito grande (máx 40)');
            data.name = name;
        }
        if (typeof body?.color === 'string') {
            const color = body.color.trim();
            if (!isHexColor(color))
                throw new Error('Cor inválida. Use HEX: #RRGGBB');
            data.color = color;
        }
        const tag = await this.prisma.tag.findFirst({
            where: { id: tagId, expertId },
            select: { id: true },
        });
        if (!tag)
            throw new Error('Tag não encontrada');
        const updated = await this.prisma.tag.update({
            where: { id: tagId },
            data,
            select: { id: true, name: true, color: true, createdAt: true },
        });
        return { ok: true, tag: updated };
    }
    async deleteTag(expertId, tagId) {
        if (!expertId)
            throw new Error('expertId required');
        if (!tagId)
            throw new Error('tagId required');
        const tag = await this.prisma.tag.findFirst({
            where: { id: tagId, expertId },
            select: { id: true },
        });
        if (!tag)
            throw new Error('Tag não encontrada');
        await this.prisma.leadTag.deleteMany({ where: { expertId, tagId } });
        await this.prisma.tag.delete({ where: { id: tagId } });
        return { ok: true };
    }
    async setLeadTag(expertId, leadKey, tagId, enabled) {
        if (!expertId)
            throw new Error('expertId required');
        if (!leadKey)
            throw new Error('leadKey required');
        if (!tagId)
            throw new Error('tagId required');
        const tag = await this.prisma.tag.findFirst({ where: { id: tagId, expertId }, select: { id: true } });
        if (!tag)
            throw new Error('Tag não encontrada');
        const key = String(leadKey).trim();
        if (!key)
            throw new Error('leadKey inválido');
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
    async setLeadTags(expertId, leadKey, body) {
        if (!expertId)
            throw new Error('expertId required');
        const key = String(leadKey || '').trim();
        if (!key)
            throw new Error('leadKey inválido');
        const raw = body && typeof body === 'object' && Array.isArray(body.tagIds)
            ? body.tagIds
            : [];
        const tagIds = Array.from(new Set(raw
            .map((x) => String(x).trim())
            .filter((x) => !!x)));
        if (tagIds.length > 60)
            throw new Error('Muitas tags selecionadas (máx 60).');
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
    async getExpertLeads(expertId, params) {
        if (!expertId)
            throw new Error('expertId required');
        const from = params.from;
        const to = params.to;
        const hasFromTo = !!from && !!to;
        const range = hasFromTo ? parseDateRange(from, to) : null;
        if (hasFromTo && !range)
            throw new Error('from/to inválidos (YYYY-MM-DD)');
        const expert = await this.prisma.user.findUnique({
            where: { id: expertId },
            select: {
                id: true,
                role: true,
                leadsSheetCsvUrl: true,
                leadsSheetId: true,
                leadsSheetTab: true,
                leadsSheetGid: true,
            },
        });
        if (!expert)
            throw new Error('expertId não encontrado');
        if (String(expert.role) !== 'EXPERT')
            throw new Error('user não é EXPERT');
        const csvUrlDirect = String(expert.leadsSheetCsvUrl || '').trim();
        const sheetId = String(expert.leadsSheetId || '').trim();
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
        const resolvedUrl = csvUrlDirect ||
            buildSheetsCsvUrl({
                sheetId,
                tab: expert.leadsSheetTab,
                gid: expert.leadsSheetGid,
            });
        const cacheKey = `${expert.id}:${resolvedUrl}`;
        const now = Date.now();
        let mapped = [];
        const cached = this.leadsCache.get(cacheKey);
        const canUseCache = !params.fresh && cached && now - cached.at < this.leadsCacheTtlMs;
        if (canUseCache) {
            mapped = cached.items.map((it) => ({
                ...it,
                rev: Number(it?.rev ?? 0),
            }));
        }
        else {
            const res = await fetch(resolvedUrl);
            if (!res.ok) {
                throw new Error(`Não consegui acessar a planilha CSV (HTTP ${res.status}). Confere se a planilha está pública/compartilhada.`);
            }
            const text = await res.text();
            const matrix = (0, csv_1.parseCsv)(text);
            if (!matrix.length) {
                mapped = [];
            }
            else {
                const headersRaw = matrix[0] || [];
                const headers = headersRaw.map((h) => (0, csv_1.normalizeHeader)(h));
                const body = matrix.slice(1);
                const rows = body
                    .map((line) => {
                    const obj = {};
                    for (let i = 0; i < headers.length; i++) {
                        obj[headers[i] || `col_${i}`] = (line[i] ?? '').trim();
                    }
                    return obj;
                })
                    .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));
                mapped = rows.map((r, idx) => {
                    const dateLabel = String(pickN(r, ['DATA CRIAÇÃO', 'DATA CRIACAO', 'DATA', 'DATA CADASTRO', 'DATA DE CRIACAO'])).trim();
                    const date = parseBrDateToISO(dateLabel);
                    const email = String(pickN(r, ['EMAIL', 'E-MAIL'])).trim();
                    const wppRaw = String(pickN(r, [
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
                    ])).trim();
                    const wpp = wppRaw.replace(/\D+/g, '');
                    const firstDeposit = toNumberLoose(pickN(r, ['PRIMEIRO DEPOSITO', 'PRIMEIRO DEPÓSITO', 'FTD']));
                    const deposits = toNumberLoose(pickN(r, ['DEPOSITOS', 'DEPÓSITOS']));
                    const rev = toNumberLoose(pickN(r, [
                        'REV',
                        'REVENUE',
                        'RECEITA',
                        'COMISSAO',
                        'COMISSÃO',
                        'COMMISSION',
                    ]));
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
        const sortBy = params.sortBy || 'date';
        const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';
        const dir = sortDir === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            const va = a[sortBy];
            const vb = b[sortBy];
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
        const mapTags = new Map();
        for (const lt of taggings) {
            const k = String(lt.leadKey);
            if (!mapTags.has(k))
                mapTags.set(k, []);
            mapTags.get(k).push(lt.tag);
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
    async getExpertActivations(expertId, params) {
        if (!expertId)
            throw new Error('expertId required');
        const from = params.from;
        const to = params.to;
        const hasFromTo = !!from && !!to;
        const range = hasFromTo ? parseDateRange(from, to) : null;
        if (hasFromTo && !range)
            throw new Error('from/to inválidos (YYYY-MM-DD)');
        const expert = await this.prisma.user.findUnique({
            where: { id: expertId },
            select: {
                id: true,
                role: true,
                activationsSheetCsvUrl: true,
                activationsSheetId: true,
                activationsSheetTab: true,
                activationsSheetGid: true,
            },
        });
        if (!expert)
            throw new Error('expertId não encontrado');
        if (String(expert.role) !== 'EXPERT')
            throw new Error('user não é EXPERT');
        const csvUrlDirect = String(expert.activationsSheetCsvUrl || '').trim();
        const sheetId = String(expert.activationsSheetId || '').trim();
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
        const resolvedUrl = csvUrlDirect ||
            buildSheetsCsvUrl({
                sheetId,
                tab: expert.activationsSheetTab,
                gid: expert.activationsSheetGid,
            });
        const cacheKey = `${expert.id}:${resolvedUrl}`;
        const now = Date.now();
        let mapped = [];
        const cached = this.activationsCache.get(cacheKey);
        const canUseCache = !params.fresh && cached && now - cached.at < this.activationsCacheTtlMs;
        if (canUseCache) {
            mapped = cached.items;
        }
        else {
            const res = await fetch(resolvedUrl);
            if (!res.ok) {
                throw new Error(`Não consegui acessar a planilha CSV de ativações (HTTP ${res.status}). Confere se a planilha está pública/compartilhada.`);
            }
            const text = await res.text();
            const matrix = (0, csv_1.parseCsv)(text);
            if (!matrix.length) {
                mapped = [];
            }
            else {
                const headersRaw = matrix[0] || [];
                const headers = headersRaw.map((h) => (0, csv_1.normalizeHeader)(h));
                const body = matrix.slice(1);
                const rows = body
                    .map((line) => {
                    const obj = {};
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
                    const description = String(pickN(r, ['DESCRICAO (OPCIONAL)', 'DESCRIÇÃO (OPCIONAL)', 'DESCRICAO', 'DESCRIÇÃO'])).trim();
                    const ftd = toNumberLoose(pickN(r, ['FTD', 'FTDS']));
                    const deposit = toNumberLoose(pickN(r, ['DEPOSITO', 'DEPÓSITO', 'DEPOSITOS', 'DEPÓSITOS']));
                    const rev = toNumberLoose(pickN(r, ['REV']));
                    const stableId = String(pickN(r, ['ID'])).trim() ||
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
        const sortBy = params.sortBy || 'date';
        const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';
        const dir = sortDir === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            if (sortBy === 'date')
                return String(a.date || '').localeCompare(String(b.date || '')) * dir;
            if (sortBy === 'activation')
                return String(a.activation || '').localeCompare(String(b.activation || '')) * dir;
            const va = Number(a[sortBy] ?? 0);
            const vb = Number(b[sortBy] ?? 0);
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
    async getExpertNotificationRule(expertId) {
        if (!expertId)
            throw new Error('expertId required');
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
    async upsertExpertNotificationRule(expertId, body) {
        if (!expertId)
            throw new Error('expertId required');
        const isActive = body?.isActive === false ? false : true;
        const timezone = safeTimezone(body?.timezone);
        const times = normalizeTimes(body?.times, 10);
        const u = await this.prisma.user.findUnique({ where: { id: expertId }, select: { id: true, role: true } });
        if (!u)
            throw new Error('expertId não encontrado');
        if (String(u.role) !== 'EXPERT')
            throw new Error('user não é EXPERT');
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
    async listExpertNotifications(expertId, params) {
        if (!expertId)
            throw new Error('expertId required');
        const page = Math.max(1, params.page || 1);
        const pageSize = Math.min(50, Math.max(1, params.pageSize || 20));
        const unreadOnly = !!params.unreadOnly;
        const where = { expertId };
        if (unreadOnly)
            where.isRead = false;
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
    async markNotificationRead(expertId, notificationId) {
        if (!expertId)
            throw new Error('expertId required');
        if (!notificationId)
            throw new Error('notificationId required');
        const n = await this.prisma.expertNotification.findFirst({
            where: { id: notificationId, expertId },
            select: { id: true, isRead: true },
        });
        if (!n)
            throw new Error('Notificação não encontrada');
        if (n.isRead)
            return { ok: true, already: true };
        await this.prisma.expertNotification.update({
            where: { id: notificationId },
            data: { isRead: true, readAt: new Date() },
        });
        return { ok: true };
    }
    async markAllNotificationsRead(expertId) {
        if (!expertId)
            throw new Error('expertId required');
        await this.prisma.expertNotification.updateMany({
            where: { expertId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        return { ok: true };
    }
    async createActivationNotificationIfNeeded(params) {
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
        const first = act?.items?.[0] ?? null;
        const activationName = String(first?.activation ?? '').trim();
        if (!activationName)
            return { ok: true, skipped: 'no-activation' };
        const title = `Ativação de hoje • ${hhmm}`;
        const message = first?.description
            ? `${activationName}\n\n${String(first.description).trim()}`
            : `${activationName}`;
        const exists = await this.prisma.expertNotification.findFirst({
            where: { expertId, kind: 'ACTIVATION', dateIso, title },
            select: { id: true },
        });
        if (exists)
            return { ok: true, skipped: 'duplicate', id: exists.id };
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
        const actions = [];
        for (const r of rules) {
            const tz = safeTimezone(r.timezone);
            const { dateIso, hhmm } = tzNowParts(tz);
            const times = Array.isArray(r.times) ? r.times : [];
            if (!times.includes(hhmm))
                continue;
            actions.push({ expertId: r.expertId, timezone: tz, dateIso, hhmm });
        }
        return { actions };
    }
    async getMetricsCsvConfig(expertId) {
        const expert = await this.prisma.user.findUnique({
            where: { id: expertId },
            select: {
                id: true,
                role: true,
                metricsSheetCsvUrl: true,
                metricsSheetId: true,
                metricsSheetTab: true,
                metricsSheetGid: true,
            },
        });
        if (!expert)
            throw new Error('expertId não encontrado');
        if (String(expert.role) !== 'EXPERT')
            throw new Error('user não é EXPERT');
        const csvUrlDirect = String(expert.metricsSheetCsvUrl || '').trim();
        const sheetId = String(expert.metricsSheetId || '').trim();
        if (!csvUrlDirect && !sheetId)
            return null;
        const resolvedUrl = csvUrlDirect ||
            buildSheetsCsvUrl({
                sheetId,
                tab: expert.metricsSheetTab,
                gid: expert.metricsSheetGid,
            });
        return { resolvedUrl };
    }
    async getRevSaquesCsvConfig(expertId) {
        const expert = await this.prisma.user.findUnique({
            where: { id: expertId },
            select: {
                id: true,
                role: true,
                revSaquesSheetCsvUrl: true,
                revSaquesSheetId: true,
                revSaquesSheetTab: true,
                revSaquesSheetGid: true,
            },
        });
        if (!expert)
            throw new Error('expertId não encontrado');
        if (String(expert.role) !== 'EXPERT')
            throw new Error('user não é EXPERT');
        const csvUrlDirect = String(expert.revSaquesSheetCsvUrl || '').trim();
        const sheetId = String(expert.revSaquesSheetId || '').trim();
        if (!csvUrlDirect && !sheetId)
            return null;
        const resolvedUrl = csvUrlDirect ||
            buildSheetsCsvUrl({
                sheetId,
                tab: expert.revSaquesSheetTab,
                gid: expert.revSaquesSheetGid,
            });
        return { resolvedUrl };
    }
    async loadMetricsCsvRows(expertId, opts) {
        const cfg = await this.getMetricsCsvConfig(expertId);
        if (!cfg?.resolvedUrl)
            return null;
        const cacheKey = `${expertId}:${cfg.resolvedUrl}`;
        const now = Date.now();
        const cached = this.metricsCsvCache.get(cacheKey);
        const canUseCache = !opts?.fresh && cached && now - cached.at < this.metricsCsvCacheTtlMs;
        if (canUseCache)
            return cached;
        const res = await fetch(cfg.resolvedUrl);
        if (!res.ok) {
            throw new Error(`Não consegui acessar a planilha CSV de métricas (HTTP ${res.status}). Confere se a planilha está pública/compartilhada.`);
        }
        const text = await res.text();
        const matrix = (0, csv_1.parseCsv)(text);
        if (!matrix.length) {
            const empty = { at: now, headers: [], rows: [] };
            this.metricsCsvCache.set(cacheKey, empty);
            return empty;
        }
        const headersRaw = matrix[0] || [];
        const headers = headersRaw.map((h) => String(h ?? '').trim());
        const normHeaders = headers.map((h) => (0, csv_1.normalizeHeader)(h));
        const body = matrix.slice(1);
        const rows = body
            .map((line) => {
            const obj = {};
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
    async loadRevSaquesCsvRows(expertId, opts) {
        const cfg = await this.getRevSaquesCsvConfig(expertId);
        if (!cfg?.resolvedUrl)
            return null;
        const cacheKey = `${expertId}:${cfg.resolvedUrl}`;
        const now = Date.now();
        const cached = this.revSaquesCsvCache.get(cacheKey);
        const canUseCache = !opts?.fresh && cached && now - cached.at < this.revSaquesCsvCacheTtlMs;
        if (canUseCache)
            return cached;
        const res = await fetch(cfg.resolvedUrl);
        if (!res.ok) {
            throw new Error(`Não consegui acessar a planilha CSV de REV SAQUES (HTTP ${res.status}). Confere se a planilha está pública/compartilhada.`);
        }
        const text = await res.text();
        const matrix = (0, csv_1.parseCsv)(text);
        if (!matrix.length) {
            const empty = { at: now, headers: [], rows: [] };
            this.revSaquesCsvCache.set(cacheKey, empty);
            return empty;
        }
        const headersRaw = matrix[0] || [];
        const headers = headersRaw.map((h) => String(h ?? '').trim());
        const normHeaders = headers.map((h) => (0, csv_1.normalizeHeader)(h));
        const body = matrix.slice(1);
        const rows = body
            .map((line) => {
            const obj = {};
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
    async revSaqueCentsByMonth(expertId) {
        const parsed = await this.loadRevSaquesCsvRows(expertId);
        const map = new Map();
        if (!parsed)
            return map;
        const monthCol = (0, csv_1.normalizeHeader)('MÊS') || 'mes';
        const valueColOriginal = findValueColumnForRevSaque(parsed.headers);
        const valueCol = valueColOriginal ? (0, csv_1.normalizeHeader)(valueColOriginal) : '';
        for (const r of parsed.rows) {
            const monthLabel = String(pickN(r, [
                'MES',
                'MÊS',
                'MONTH',
                'PERIODO',
                'PERÍODO',
                'COMPETENCIA',
                'COMPETÊNCIA',
            ])).trim() || String(r[monthCol] ?? '').trim();
            const key = parsePtMonthToKey(monthLabel);
            if (!key)
                continue;
            let val = 0;
            if (valueCol) {
                val = toNumberLoose(r[valueCol]);
            }
            else {
                const candidates = Object.keys(r || {});
                const col = candidates.find((c) => (0, csv_1.normalizeHeader)(c).includes('saque')) || '';
                val = col ? toNumberLoose(r[col]) : 0;
            }
            if (!Number.isFinite(val) || val === 0) {
                continue;
            }
            const cents = Math.round(val * 100);
            map.set(key, (map.get(key) ?? 0) + cents);
        }
        return map;
    }
    async sumRevSaqueByMonthInRange(expertId, start, end) {
        const byMonth = await this.revSaqueCentsByMonth(expertId);
        let sum = 0;
        for (const [monthKey, cents] of byMonth.entries()) {
            if (!monthKeyInRange(monthKey, start, end))
                continue;
            sum += Number(cents || 0);
        }
        return sum;
    }
};
exports.ExpertsService = ExpertsService;
exports.ExpertsService = ExpertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExpertsService);
//# sourceMappingURL=experts.service.js.map