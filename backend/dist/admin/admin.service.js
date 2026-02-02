"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const client_1 = require("@prisma/client");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const argon2 = __importStar(require("argon2"));
const DEFAULT_FROM = '2000-01-01';
const DEFAULT_TO = '2099-12-31';
function parseDateRange(from, to) {
    if (!from || !to)
        throw new Error('from/to required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from))
        throw new Error('from invalid (YYYY-MM-DD)');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to))
        throw new Error('to invalid (YYYY-MM-DD)');
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:59:59.999Z`);
    return { start, end };
}
function defaultYearRange() {
    const now = new Date();
    const y = now.getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31` };
}
function isoDayLabel(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function startOfDayUTC(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDaysUTC(d, days) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() + days);
    x.setUTCHours(0, 0, 0, 0);
    return x;
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
function normKey(v) {
    return String(v ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
}
function parseNumLoose(v) {
    const s = String(v ?? '').trim();
    if (!s)
        return 0;
    const cleaned = s
        .replace(/\s/g, '')
        .replace(/R\$/gi, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
}
function parseDateLooseISO(v) {
    const s = String(v ?? '').trim();
    if (!s)
        return '';
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
        const [dd, mm, yyyy] = s.split('/');
        return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime()))
        return d.toISOString();
    return s;
}
function toBRDateLabel(isoOrAny) {
    const d = new Date(isoOrAny);
    if (Number.isNaN(d.getTime()))
        return String(isoOrAny || '');
    return d.toLocaleDateString('pt-BR');
}
function parseCsv(text) {
    const raw = String(text ?? '').replace(/^\uFEFF/, '').trim();
    if (!raw)
        return { headers: [], rows: [] };
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const detectDelim = (line) => {
        const comma = (line.match(/,/g) || []).length;
        const semi = (line.match(/;/g) || []).length;
        return semi > comma ? ';' : ',';
    };
    const delim = detectDelim(lines[0]);
    const splitLine = (line) => {
        const out = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                const next = line[i + 1];
                if (inQuotes && next === '"') {
                    cur += '"';
                    i++;
                }
                else {
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
async function fetchText(url) {
    const res = await global.fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res?.ok) {
        const txt = await res?.text?.().catch(() => '');
        throw new Error(txt || `HTTP ${res?.status || 0} ao buscar CSV`);
    }
    return await res.text();
}
function cleanNullableString(v) {
    if (typeof v !== 'string')
        return undefined;
    const s = v.trim();
    return s.length ? s : null;
}
function cleanEmail(v) {
    if (typeof v !== 'string')
        return undefined;
    const s = v.trim().toLowerCase();
    if (!s)
        return null;
    return s;
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
    const low = raw
        .toLowerCase()
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
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
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    revSaquesCsvCache = new Map();
    revSaquesCsvCacheTtlMs = 10_000;
    async listExperts() {
        try {
            const rows = await this.prisma.user.findMany({
                where: { role: client_1.UserRole.EXPERT },
                orderBy: { createdAt: 'desc' },
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
                    revSaquesSheetCsvUrl: true,
                    revSaquesSheetId: true,
                    revSaquesSheetTab: true,
                    revSaquesSheetGid: true,
                },
            });
            return {
                items: rows.map((x) => ({
                    ...x,
                    createdAt: new Date(x.createdAt).toISOString(),
                })),
            };
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async createExpert(body) {
        try {
            const email = String(body?.email || '').trim().toLowerCase();
            const password = String(body?.password || '');
            const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;
            if (!email)
                throw new Error('email obrigatório');
            if (!/^\S+@\S+\.\S+$/.test(email))
                throw new Error('email inválido');
            if (!password || password.length < 6)
                throw new Error('password muito curta (mínimo 6)');
            const exists = await this.prisma.user.findUnique({ where: { email } });
            if (exists)
                throw new Error('já existe usuário com esse email');
            const passwordHash = await argon2.hash(password);
            const data = {
                email,
                passwordHash,
                role: client_1.UserRole.EXPERT,
                isActive,
                description: cleanNullableString(body?.description),
                youtubeUrl: cleanNullableString(body?.youtubeUrl),
                instagramUrl: cleanNullableString(body?.instagramUrl),
                telegramUrl: cleanNullableString(body?.telegramUrl),
                whatsappUrl: cleanNullableString(body?.whatsappUrl),
                leadsSheetCsvUrl: cleanNullableString(body?.leadsSheetCsvUrl),
                leadsSheetId: cleanNullableString(body?.leadsSheetId),
                leadsSheetTab: cleanNullableString(body?.leadsSheetTab),
                leadsSheetGid: cleanNullableString(body?.leadsSheetGid),
                metricsSheetCsvUrl: cleanNullableString(body?.metricsSheetCsvUrl),
                metricsSheetId: cleanNullableString(body?.metricsSheetId),
                metricsSheetTab: cleanNullableString(body?.metricsSheetTab),
                metricsSheetGid: cleanNullableString(body?.metricsSheetGid),
                activationsSheetCsvUrl: cleanNullableString(body?.activationsSheetCsvUrl),
                activationsSheetId: cleanNullableString(body?.activationsSheetId),
                activationsSheetTab: cleanNullableString(body?.activationsSheetTab),
                activationsSheetGid: cleanNullableString(body?.activationsSheetGid),
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
                    revSaquesSheetCsvUrl: true,
                    revSaquesSheetId: true,
                    revSaquesSheetTab: true,
                    revSaquesSheetGid: true,
                },
            });
            return {
                ok: true,
                expert: { ...created, createdAt: new Date(created.createdAt).toISOString() },
            };
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async overview(params) {
        try {
            const expertId = params?.expertId;
            const fallback = defaultYearRange();
            const from = params?.from ?? fallback.from;
            const to = params?.to ?? fallback.to;
            const { start, end } = parseDateRange(from, to);
            const where = { day: { gte: start, lte: end } };
            if (expertId && expertId !== 'ALL')
                where.expertId = expertId;
            const [usersTotal, usersAdmins, usersExperts, usersActive] = await Promise.all([
                this.prisma.user.count(),
                this.prisma.user.count({ where: { role: client_1.UserRole.ADMIN } }),
                this.prisma.user.count({ where: { role: client_1.UserRole.EXPERT } }),
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
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async series(params) {
        try {
            const expertId = params?.expertId;
            const fallback = defaultYearRange();
            const from = params?.from ?? fallback.from;
            const to = params?.to ?? fallback.to;
            const { start, end } = parseDateRange(from, to);
            const where = { day: { gte: start, lte: end } };
            if (expertId && expertId !== 'ALL')
                where.expertId = expertId;
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
            const byIso = new Map();
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
                const points = [];
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
            const bucketMap = new Map();
            const ensureBucket = (key) => {
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
                return bucketMap.get(key);
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
            }
            else {
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
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async expertOverview(expertId, params) {
        try {
            if (!expertId)
                throw new Error('expertId required');
            const expert = await this.prisma.user.findUnique({
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
                    leadsSheetGid: true,
                    leadsSheetCsvUrl: true,
                    metricsSheetId: true,
                    metricsSheetTab: true,
                    metricsSheetGid: true,
                    metricsSheetCsvUrl: true,
                    activationsSheetId: true,
                    activationsSheetTab: true,
                    activationsSheetGid: true,
                    activationsSheetCsvUrl: true,
                    revSaquesSheetId: true,
                    revSaquesSheetTab: true,
                    revSaquesSheetGid: true,
                    revSaquesSheetCsvUrl: true,
                },
            });
            if (!expert)
                throw new Error('expertId não encontrado');
            if (expert.role !== client_1.UserRole.EXPERT)
                throw new Error('user não é EXPERT');
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
                    description: expert.description ?? null,
                    youtubeUrl: expert.youtubeUrl ?? null,
                    instagramUrl: expert.instagramUrl ?? null,
                    telegramUrl: expert.telegramUrl ?? null,
                    whatsappUrl: expert.whatsappUrl ?? null,
                    leadsSheetId: expert.leadsSheetId ?? null,
                    leadsSheetTab: expert.leadsSheetTab ?? null,
                    leadsSheetGid: expert.leadsSheetGid ?? null,
                    leadsSheetCsvUrl: expert.leadsSheetCsvUrl ?? null,
                    metricsSheetId: expert.metricsSheetId ?? null,
                    metricsSheetTab: expert.metricsSheetTab ?? null,
                    metricsSheetGid: expert.metricsSheetGid ?? null,
                    metricsSheetCsvUrl: expert.metricsSheetCsvUrl ?? null,
                    activationsSheetId: expert.activationsSheetId ?? null,
                    activationsSheetTab: expert.activationsSheetTab ?? null,
                    activationsSheetGid: expert.activationsSheetGid ?? null,
                    activationsSheetCsvUrl: expert.activationsSheetCsvUrl ?? null,
                    revSaquesSheetId: expert.revSaquesSheetId ?? null,
                    revSaquesSheetTab: expert.revSaquesSheetTab ?? null,
                    revSaquesSheetGid: expert.revSaquesSheetGid ?? null,
                    revSaquesSheetCsvUrl: expert.revSaquesSheetCsvUrl ?? null,
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
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async expertSeries(expertId, params) {
        try {
            if (!expertId)
                throw new Error('expertId required');
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
            const byIso = new Map();
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
                const points = [];
                let cur = startOfDayUTC(start);
                const last = startOfDayUTC(end);
                while (cur.getTime() <= last.getTime()) {
                    const iso = isoDayLabel(cur);
                    const v = byIso.get(iso) ?? {
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
            const bucketMap = new Map();
            const ensureBucket = (key) => {
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
            }
            else {
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
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async expertLeads(expertId, params) {
        try {
            if (!expertId)
                throw new Error('expertId required');
            const from = params.from ?? DEFAULT_FROM;
            const to = params.to ?? DEFAULT_TO;
            const { start, end } = parseDateRange(from, to);
            const page = Math.max(1, params.page || 1);
            const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));
            const sortBy = String(params.sortBy || 'date');
            const sortDir = (String(params.sortDir || 'desc') === 'asc' ? 'asc' : 'desc');
            const q = String(params.q || '').trim().toLowerCase();
            const expert = await this.prisma.user.findUnique({
                where: { id: expertId },
                select: {
                    id: true,
                    role: true,
                    leadsSheetCsvUrl: true,
                },
            });
            if (!expert)
                throw new Error('expertId não encontrado');
            if (expert.role !== client_1.UserRole.EXPERT)
                throw new Error('user não é EXPERT');
            const csvUrl = String(expert.leadsSheetCsvUrl || '').trim();
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
                const idx = new Map();
                headers.forEach((h, i) => idx.set(normKey(h), i));
                const pick = (row, keys) => {
                    for (const k of keys) {
                        const j = idx.get(k);
                        if (j != null)
                            return row[j];
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
                    const balance = balanceRaw !== '' && balanceRaw != null ? parseNumLoose(balanceRaw) : (gains || 0) - (losses || 0);
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
                    if (it._d && (it._d < start || it._d > end))
                        return false;
                    if (q) {
                        const hay = `${it.email} ${it.wpp}`.toLowerCase();
                        if (!hay.includes(q))
                            return false;
                    }
                    return true;
                });
                const getSortVal = (x) => {
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
            const where = {
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
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async updateExpert(expertId, body) {
        try {
            if (!expertId)
                throw new Error('expertId required');
            const data = {
                ...(body?.email ? { email: cleanEmail(body.email) } : {}),
                ...(typeof body?.isActive === 'boolean' ? { isActive: body.isActive } : {}),
                ...(body?.photoUrl ? { photoUrl: String(body.photoUrl) } : {}),
            };
            if (typeof body?.description === 'string')
                data.description = cleanNullableString(body.description);
            if (typeof body?.youtubeUrl === 'string')
                data.youtubeUrl = cleanNullableString(body.youtubeUrl);
            if (typeof body?.instagramUrl === 'string')
                data.instagramUrl = cleanNullableString(body.instagramUrl);
            if (typeof body?.telegramUrl === 'string')
                data.telegramUrl = cleanNullableString(body.telegramUrl);
            if (typeof body?.whatsappUrl === 'string')
                data.whatsappUrl = cleanNullableString(body.whatsappUrl);
            if (typeof body?.leadsSheetCsvUrl === 'string')
                data.leadsSheetCsvUrl = cleanNullableString(body.leadsSheetCsvUrl);
            if (typeof body?.leadsSheetId === 'string')
                data.leadsSheetId = cleanNullableString(body.leadsSheetId);
            if (typeof body?.leadsSheetTab === 'string')
                data.leadsSheetTab = cleanNullableString(body.leadsSheetTab);
            if (typeof body?.leadsSheetGid === 'string')
                data.leadsSheetGid = cleanNullableString(body.leadsSheetGid);
            if (typeof body?.metricsSheetCsvUrl === 'string')
                data.metricsSheetCsvUrl = cleanNullableString(body.metricsSheetCsvUrl);
            if (typeof body?.metricsSheetId === 'string')
                data.metricsSheetId = cleanNullableString(body.metricsSheetId);
            if (typeof body?.metricsSheetTab === 'string')
                data.metricsSheetTab = cleanNullableString(body.metricsSheetTab);
            if (typeof body?.metricsSheetGid === 'string')
                data.metricsSheetGid = cleanNullableString(body.metricsSheetGid);
            if (typeof body?.activationsSheetCsvUrl === 'string')
                data.activationsSheetCsvUrl = cleanNullableString(body.activationsSheetCsvUrl);
            if (typeof body?.activationsSheetId === 'string')
                data.activationsSheetId = cleanNullableString(body.activationsSheetId);
            if (typeof body?.activationsSheetTab === 'string')
                data.activationsSheetTab = cleanNullableString(body.activationsSheetTab);
            if (typeof body?.activationsSheetGid === 'string')
                data.activationsSheetGid = cleanNullableString(body.activationsSheetGid);
            if (typeof body?.revSaquesSheetCsvUrl === 'string')
                data.revSaquesSheetCsvUrl = cleanNullableString(body.revSaquesSheetCsvUrl);
            if (typeof body?.revSaquesSheetId === 'string')
                data.revSaquesSheetId = cleanNullableString(body.revSaquesSheetId);
            if (typeof body?.revSaquesSheetTab === 'string')
                data.revSaquesSheetTab = cleanNullableString(body.revSaquesSheetTab);
            if (typeof body?.revSaquesSheetGid === 'string')
                data.revSaquesSheetGid = cleanNullableString(body.revSaquesSheetGid);
            const updated = await this.prisma.user.update({
                where: { id: expertId },
                data: data,
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
                    revSaquesSheetCsvUrl: true,
                    revSaquesSheetId: true,
                    revSaquesSheetTab: true,
                    revSaquesSheetGid: true,
                },
            });
            return { ok: true, expert: updated };
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async updateExpertPassword(expertId, password) {
        try {
            if (!expertId)
                throw new Error('expertId required');
            if (!password || password.length < 6)
                throw new Error('password muito curta (mínimo 6)');
            const passwordHash = await argon2.hash(password);
            await this.prisma.user.update({
                where: { id: expertId },
                data: { passwordHash },
                select: { id: true },
            });
            return { ok: true };
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async updateExpertPhoto(expertId, file) {
        try {
            if (!expertId)
                throw new Error('expertId required');
            if (!file)
                throw new Error('file required');
            const uploadsDir = path.join(process.cwd(), 'uploads', 'admin', 'experts');
            fs.mkdirSync(uploadsDir, { recursive: true });
            const ext = path.extname(file.originalname || '') || '.jpg';
            const filename = `expert_${expertId}_${Date.now()}${ext}`;
            const filepath = path.join(uploadsDir, filename);
            fs.writeFileSync(filepath, file.buffer);
            const photoUrl = `/uploads/admin/experts/${filename}`;
            const updated = await this.prisma.user.update({
                where: { id: expertId },
                data: { photoUrl },
                select: { id: true, email: true, photoUrl: true },
            });
            return { ok: true, expert: updated };
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async getRevSaquesResolvedUrlForExpert(expertId) {
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
            return '';
        if (String(expert.role) !== 'EXPERT')
            return '';
        const csvUrlDirect = String(expert.revSaquesSheetCsvUrl || '').trim();
        const sheetId = String(expert.revSaquesSheetId || '').trim();
        if (csvUrlDirect)
            return csvUrlDirect;
        if (!sheetId)
            return '';
        const resolvedUrl = buildSheetsCsvUrl({
            sheetId,
            tab: expert.revSaquesSheetTab,
            gid: expert.revSaquesSheetGid,
        });
        return resolvedUrl;
    }
    async loadRevSaquesCsv(expertId, resolvedUrl) {
        const cacheKey = `${expertId}:${resolvedUrl}`;
        const now = Date.now();
        const cached = this.revSaquesCsvCache.get(cacheKey);
        const canUseCache = cached && now - cached.at < this.revSaquesCsvCacheTtlMs;
        if (canUseCache)
            return cached;
        const csvText = await fetchText(resolvedUrl);
        const { headers, rows } = parseCsv(csvText);
        const payload = { at: now, headers, rows };
        this.revSaquesCsvCache.set(cacheKey, payload);
        return payload;
    }
    findRevSaquesColumns(headers) {
        const norm = headers.map((h) => normKey(h));
        const monthIdx = norm.findIndex((h) => h === 'mes' ||
            h.includes('mes') ||
            h.includes('competencia') ||
            h.includes('periodo') ||
            h.includes('month')) ?? -1;
        let valueIdx = norm.findIndex((h) => h.includes('revsaque') || h.includes('rev_saque') || h.includes('revsq'));
        if (valueIdx < 0)
            valueIdx = norm.findIndex((h) => h.includes('saque'));
        if (valueIdx < 0)
            valueIdx = norm.findIndex((h) => h.includes('withdraw'));
        return { monthIdx, valueIdx };
    }
    sumRevSaquesFromCsvInRange(csv, start, end) {
        if (!csv?.headers?.length)
            return 0;
        const { monthIdx, valueIdx } = this.findRevSaquesColumns(csv.headers);
        if (monthIdx < 0 || valueIdx < 0) {
            return 0;
        }
        const byMonth = new Map();
        for (const row of csv.rows || []) {
            const monthLabel = String(row?.[monthIdx] ?? '').trim();
            const key = parsePtMonthToKey(monthLabel);
            if (!key)
                continue;
            const valBRL = parseNumLoose(row?.[valueIdx]);
            if (!Number.isFinite(valBRL) || valBRL === 0)
                continue;
            const cents = Math.round(valBRL * 100);
            byMonth.set(key, (byMonth.get(key) ?? 0) + cents);
        }
        let sum = 0;
        for (const [k, cents] of byMonth.entries()) {
            if (!monthKeyInRange(k, start, end))
                continue;
            sum += Number(cents ?? 0);
        }
        return sum;
    }
    async sumRevSaquesCentsByRange(params) {
        const { start, end, expertId } = params;
        const ids = expertId !== 'ALL'
            ? [expertId]
            : (await this.prisma.user.findMany({
                where: { role: client_1.UserRole.EXPERT },
                select: { id: true },
            })).map((x) => String(x.id));
        let total = 0;
        for (const id of ids) {
            const resolvedUrl = await this.getRevSaquesResolvedUrlForExpert(id);
            if (!resolvedUrl)
                continue;
            const csv = await this.loadRevSaquesCsv(id, resolvedUrl);
            total += this.sumRevSaquesFromCsvInRange(csv, start, end);
        }
        return total;
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map