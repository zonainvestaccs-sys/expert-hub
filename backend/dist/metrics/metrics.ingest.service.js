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
exports.MetricsIngestService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma.service");
const csv_1 = require("../utils/csv");
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
function parseMoneyToCents(input) {
    const s0 = String(input ?? '').trim();
    if (!s0)
        return 0;
    let s = s0
        .replace(/\s+/g, '')
        .replace(/R\$/gi, '')
        .replace(/[^\d.,-]/g, '');
    if (!s || s === '-' || s === ',' || s === '.')
        return 0;
    const isNeg = s.startsWith('-');
    s = s.replace(/-/g, '');
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    const normalizeWithDecimal = (decimalSep) => {
        const thousandsSep = decimalSep === '.' ? ',' : '.';
        let x = s.split(thousandsSep).join('');
        if (decimalSep === ',')
            x = x.replace(/,/g, '.');
        return x;
    };
    let normalized = '';
    if (hasDot && hasComma) {
        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');
        const dec = lastDot > lastComma ? '.' : ',';
        normalized = normalizeWithDecimal(dec);
    }
    else if (hasComma) {
        normalized = normalizeWithDecimal(',');
    }
    else if (hasDot) {
        const parts = s.split('.');
        if (parts.length > 2) {
            const last = parts[parts.length - 1] || '';
            if (last.length >= 1 && last.length <= 2) {
                const joined = parts.slice(0, -1).join('') + '.' + last;
                normalized = joined;
            }
            else {
                normalized = parts.join('');
            }
        }
        else {
            normalized = normalizeWithDecimal('.');
        }
    }
    else {
        normalized = s;
    }
    const n = Number(normalized);
    if (!Number.isFinite(n))
        return 0;
    const cents = Math.round(n * 100);
    return isNeg ? -Math.abs(cents) : cents;
}
function parseMoneyMaybeCents(input, headerHints) {
    const raw = String(input ?? '').trim();
    if (!raw)
        return 0;
    const hasSep = raw.includes('.') || raw.includes(',');
    if (hasSep)
        return parseMoneyToCents(raw);
    const digitsOnly = raw.replace(/[^\d-]/g, '');
    if (!digitsOnly || digitsOnly === '-')
        return 0;
    const isNeg = digitsOnly.startsWith('-');
    const abs = digitsOnly.replace(/-/g, '');
    const intVal = Number(abs);
    if (!Number.isFinite(intVal))
        return 0;
    const looksLikeCents = abs.length >= 6;
    const headerHasCents = headerHints.some((h) => String(h).toLowerCase().includes('cents'));
    if (headerHasCents && looksLikeCents) {
        const cents = Math.trunc(intVal);
        return isNeg ? -Math.abs(cents) : cents;
    }
    const cents = Math.round(intVal * 100);
    return isNeg ? -Math.abs(cents) : cents;
}
function toIntLoose(input) {
    const s = String(input ?? '').trim();
    if (!s)
        return 0;
    const cleaned = s.replace(/\s+/g, '').replace(/[^\d-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function parseDayISO(input) {
    const s = String(input ?? '').trim();
    if (!s)
        return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m)
        return `${m[3]}-${m[2]}-${m[1]}`;
    return '';
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
        const kNoUnd = kn.replace(/_/g, '');
        const v3 = row[kNoUnd];
        if (v3 !== undefined && v3 !== null && String(v3).trim() !== '')
            return v3;
    }
    return '';
}
let MetricsIngestService = class MetricsIngestService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async cronTick() {
        await this.ingestAllExperts({ fresh: false });
    }
    async ingestAllExperts(opts) {
        const experts = await this.prisma.user.findMany({
            where: { role: 'EXPERT', isActive: true },
            select: {
                id: true,
                metricsSheetCsvUrl: true,
                metricsSheetId: true,
                metricsSheetTab: true,
                metricsSheetGid: true,
            },
        });
        let ok = 0;
        let skipped = 0;
        let failed = 0;
        for (const e of experts) {
            const csvUrlDirect = String(e.metricsSheetCsvUrl || '').trim();
            const sheetId = String(e.metricsSheetId || '').trim();
            if (!csvUrlDirect && !sheetId) {
                skipped++;
                continue;
            }
            const url = csvUrlDirect ||
                buildSheetsCsvUrl({
                    sheetId,
                    tab: e.metricsSheetTab,
                    gid: e.metricsSheetGid,
                });
            try {
                await this.ingestOneExpertFromUrl(e.id, url, opts);
                ok++;
            }
            catch {
                failed++;
            }
        }
        return { ok, skipped, failed };
    }
    async ingestOneExpertFromUrl(expertId, url, opts) {
        const res = await fetch(url, {
            headers: opts?.fresh ? { 'Cache-Control': 'no-cache' } : undefined,
        });
        if (!res.ok)
            throw new Error(`CSV HTTP ${res.status}`);
        const text = await res.text();
        const matrix = (0, csv_1.parseCsv)(text);
        if (!matrix.length)
            return { ok: true, upserts: 0 };
        const headersRaw = matrix[0] || [];
        const headers = headersRaw.map((h) => (0, csv_1.normalizeHeader)(h));
        const body = matrix.slice(1);
        const rows = body
            .map((line) => {
            const obj = {};
            for (let i = 0; i < headers.length; i++)
                obj[headers[i] || `col_${i}`] = (line[i] ?? '').trim();
            return obj;
        })
            .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));
        let upserts = 0;
        for (const r of rows) {
            const dayIso = parseDayISO(pickN(r, ['day', 'dia', 'data', 'date']));
            if (!dayIso)
                continue;
            const day = new Date(`${dayIso}T00:00:00.000Z`);
            if (Number.isNaN(day.getTime()))
                continue;
            const leadsTotal = toIntLoose(pickN(r, ['leadsTotal', 'leads', 'totalLeads', 'leads_total']));
            const leadsActive = toIntLoose(pickN(r, ['leadsActive', 'leadsAtivos', 'activeLeads', 'leads_active']));
            const ftdCount = toIntLoose(pickN(r, ['ftdCount', 'ftd', 'ftds']));
            const depositsTotalRaw = pickN(r, [
                'depositsTotalCents',
                'depositsTotal',
                'deposits',
                'depositosTotal',
                'depositos',
            ]);
            const revRaw = pickN(r, ['revCents', 'rev', 'revenue', 'receita']);
            const salesRaw = pickN(r, ['salesCents', 'sales', 'vendas', 'vendasTotal']);
            const trafficRaw = pickN(r, ['trafficCents', 'traffic', 'trafego', 'gastos', 'trafegoPago']);
            const depositsTotalCents = parseMoneyMaybeCents(depositsTotalRaw, ['depositsTotalCents', 'depositsTotal']);
            const revCents = parseMoneyMaybeCents(revRaw, ['revCents', 'rev']);
            const salesCents = parseMoneyMaybeCents(salesRaw, ['salesCents', 'sales']);
            const trafficCents = parseMoneyMaybeCents(trafficRaw, ['trafficCents', 'traffic']);
            const salesCount = toIntLoose(pickN(r, ['salesCount', 'qtdVendas', 'sales_count']));
            const depositsCount = toIntLoose(pickN(r, ['depositsCount', 'qtdDepositos', 'deposits_count'])) || 0;
            await this.prisma.metricsDaily.upsert({
                where: { expertId_day: { expertId, day } },
                update: {
                    leadsTotal,
                    leadsActive,
                    depositsCount,
                    depositsTotalCents,
                    ftdCount,
                    revCents,
                    salesCents,
                    salesCount,
                    trafficCents,
                    source: 'SHEETS',
                    raw: r,
                },
                create: {
                    expertId,
                    day,
                    leadsTotal,
                    leadsActive,
                    depositsCount,
                    depositsTotalCents,
                    ftdCount,
                    revCents,
                    salesCents,
                    salesCount,
                    trafficCents,
                    source: 'SHEETS',
                    raw: r,
                },
            });
            upserts++;
        }
        return { ok: true, upserts };
    }
};
exports.MetricsIngestService = MetricsIngestService;
__decorate([
    (0, schedule_1.Cron)('*/10 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsIngestService.prototype, "cronTick", null);
exports.MetricsIngestService = MetricsIngestService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MetricsIngestService);
//# sourceMappingURL=metrics.ingest.service.js.map