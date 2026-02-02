// src/metrics/metrics.ingest.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { parseCsv, normalizeHeader } from '../utils/csv';

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
 * ✅ Parse robusto de moeda (BRL) => retorna CENTAVOS (int).
 * Aceita:
 * - "19.754,86"
 * - "19,754.86"
 * - "2398.6"
 * - "498.95"
 * - "150"
 * - "R$ 1.234,00"
 * - negativos
 */
function parseMoneyToCents(input: any): number {
  const s0 = String(input ?? '').trim();
  if (!s0) return 0;

  // mantém apenas dígitos, separadores e sinal
  let s = s0
    .replace(/\s+/g, '')
    .replace(/R\$/gi, '')
    .replace(/[^\d.,-]/g, '');

  if (!s || s === '-' || s === ',' || s === '.') return 0;

  const isNeg = s.startsWith('-');
  s = s.replace(/-/g, '');

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  // Heurística: se vier algo tipo "1975486" em coluna *Cents* (sem separador),
  // isso pode já ser cents. (≥ 6 dígitos)
  // Quem decide se usa isso é o wrapper abaixo.
  const normalizeWithDecimal = (decimalSep: '.' | ',') => {
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    // remove milhares e troca decimal por '.'
    let x = s.split(thousandsSep).join('');
    if (decimalSep === ',') x = x.replace(/,/g, '.');
    return x;
  };

  let normalized = '';

  if (hasDot && hasComma) {
    // decimal é o separador que aparece por último
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    const dec = lastDot > lastComma ? '.' : ',';
    normalized = normalizeWithDecimal(dec);
  } else if (hasComma) {
    // só vírgula -> decimal
    normalized = normalizeWithDecimal(',');
  } else if (hasDot) {
    // só ponto -> normalmente decimal (ex: 2398.6)
    // se tiver mais de 1 ponto, assume que os anteriores são milhar e o último é decimal se tiver 1-2 casas
    const parts = s.split('.');
    if (parts.length > 2) {
      const last = parts[parts.length - 1] || '';
      if (last.length >= 1 && last.length <= 2) {
        // remove todos os pontos e reinsere decimal antes do last
        const joined = parts.slice(0, -1).join('') + '.' + last;
        normalized = joined;
      } else {
        // trata tudo como milhar
        normalized = parts.join('');
      }
    } else {
      normalized = normalizeWithDecimal('.');
    }
  } else {
    // inteiro
    normalized = s;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;

  const cents = Math.round(n * 100);
  return isNeg ? -Math.abs(cents) : cents;
}

/**
 * ✅ Para campos que podem vir como:
 * - "depositsTotal" (reais)
 * - "depositsTotalCents" (às vezes reais com nome errado)
 * - ou realmente cents
 *
 * Regra:
 * - Se tem '.' ou ',' => é REAIS -> converte *100
 * - Se NÃO tem separador:
 *    - se coluna indica "cents" e número tem >= 6 dígitos => assume que já é CENTS (não multiplica)
 *    - caso contrário -> é REAIS inteiro -> *100
 */
function parseMoneyMaybeCents(input: any, headerHints: string[]): number {
  const raw = String(input ?? '').trim();
  if (!raw) return 0;

  const hasSep = raw.includes('.') || raw.includes(',');
  if (hasSep) return parseMoneyToCents(raw);

  const digitsOnly = raw.replace(/[^\d-]/g, '');
  if (!digitsOnly || digitsOnly === '-') return 0;

  const isNeg = digitsOnly.startsWith('-');
  const abs = digitsOnly.replace(/-/g, '');
  const intVal = Number(abs);
  if (!Number.isFinite(intVal)) return 0;

  const looksLikeCents = abs.length >= 6; // 100000+ (>= R$ 1.000,00 em cents)
  const headerHasCents = headerHints.some((h) => String(h).toLowerCase().includes('cents'));

  if (headerHasCents && looksLikeCents) {
    const cents = Math.trunc(intVal);
    return isNeg ? -Math.abs(cents) : cents;
  }

  const cents = Math.round(intVal * 100);
  return isNeg ? -Math.abs(cents) : cents;
}

function toIntLoose(input: any) {
  const s = String(input ?? '').trim();
  if (!s) return 0;

  const cleaned = s.replace(/\s+/g, '').replace(/[^\d-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseDayISO(input: any) {
  const s = String(input ?? '').trim();
  if (!s) return '';

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd/mm/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return '';
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

    const kNoUnd = kn.replace(/_/g, '');
    const v3 = row[kNoUnd];
    if (v3 !== undefined && v3 !== null && String(v3).trim() !== '') return v3;
  }
  return '';
}

@Injectable()
export class MetricsIngestService {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ roda sozinho (ex.: a cada 10 min). Pode mudar a frequência.
  @Cron('*/10 * * * *')
  async cronTick() {
    await this.ingestAllExperts({ fresh: false });
  }

  async ingestAllExperts(opts?: { fresh?: boolean }) {
    const experts = await this.prisma.user.findMany({
      where: { role: 'EXPERT', isActive: true },
      select: {
        id: true,
        metricsSheetCsvUrl: true,
        metricsSheetId: true,
        metricsSheetTab: true,
        metricsSheetGid: true,
      } as any,
    });

    let ok = 0;
    let skipped = 0;
    let failed = 0;

    for (const e of experts as any[]) {
      const csvUrlDirect = String(e.metricsSheetCsvUrl || '').trim();
      const sheetId = String(e.metricsSheetId || '').trim();

      if (!csvUrlDirect && !sheetId) {
        skipped++;
        continue;
      }

      const url =
        csvUrlDirect ||
        buildSheetsCsvUrl({
          sheetId,
          tab: e.metricsSheetTab,
          gid: e.metricsSheetGid,
        });

      try {
        await this.ingestOneExpertFromUrl(e.id, url, opts);
        ok++;
      } catch {
        failed++;
      }
    }

    return { ok, skipped, failed };
  }

  async ingestOneExpertFromUrl(expertId: string, url: string, opts?: { fresh?: boolean }) {
    const res = await fetch(url, {
      headers: opts?.fresh ? { 'Cache-Control': 'no-cache' } : undefined,
    });

    if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);

    const text = await res.text();
    const matrix = parseCsv(text);
    if (!matrix.length) return { ok: true, upserts: 0 };

    const headersRaw = matrix[0] || [];
    const headers = headersRaw.map((h) => normalizeHeader(h));
    const body = matrix.slice(1);

    const rows = body
      .map((line) => {
        const obj: Record<string, any> = {};
        for (let i = 0; i < headers.length; i++) obj[headers[i] || `col_${i}`] = (line[i] ?? '').trim();
        return obj;
      })
      .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));

    let upserts = 0;

    for (const r of rows) {
      const dayIso = parseDayISO(pickN(r, ['day', 'dia', 'data', 'date']));
      if (!dayIso) continue;

      const day = new Date(`${dayIso}T00:00:00.000Z`);
      if (Number.isNaN(day.getTime())) continue;

      // contagens (inteiro)
      const leadsTotal = toIntLoose(pickN(r, ['leadsTotal', 'leads', 'totalLeads', 'leads_total']));
      const leadsActive = toIntLoose(pickN(r, ['leadsActive', 'leadsAtivos', 'activeLeads', 'leads_active']));
      const ftdCount = toIntLoose(pickN(r, ['ftdCount', 'ftd', 'ftds']));

      // dinheiro -> CENTS (int)
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

      // depositsCount pode existir ou não
      const depositsCount = toIntLoose(pickN(r, ['depositsCount', 'qtdDepositos', 'deposits_count'])) || 0;

      await this.prisma.metricsDaily.upsert({
        where: { expertId_day: { expertId, day } } as any,
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
}
