// src/components/ExpertLineChart.tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { useSensitiveMode } from '@/components/SensitiveMode';

export type ExpertSeriesPoint = {
  label: string;

  // contagens
  leadsTotal?: number;
  leadsActive?: number;
  ftdCount?: number;
  salesCount?: number;

  // valores em BRL (number)
  depositsBRL?: number;
  revBRL?: number;
  salesBRL?: number;
  trafficBRL?: number;
};

type MetricKey =
  | 'revBRL'
  | 'depositsBRL'
  | 'salesBRL'
  | 'trafficBRL'
  | 'salesCount'
  | 'leadsTotal'
  | 'ftdCount';

type MetricDef = {
  key: MetricKey;
  label: string;
  kind: 'money' | 'count';
};

const METRICS: MetricDef[] = [
  { key: 'revBRL', label: 'REV', kind: 'money' },
  { key: 'depositsBRL', label: 'Depósitos (R$)', kind: 'money' },
  { key: 'salesBRL', label: 'R$ Vendas', kind: 'money' },
  { key: 'trafficBRL', label: 'Tráfego (gasto)', kind: 'money' },

  { key: 'salesCount', label: 'Qtd Vendas', kind: 'count' },
  { key: 'leadsTotal', label: 'Leads', kind: 'count' },
  { key: 'ftdCount', label: 'FTD', kind: 'count' },
];

const METRIC_KIND: Record<MetricKey, 'money' | 'count'> = METRICS.reduce((acc, m) => {
  acc[m.key] = m.kind;
  return acc;
}, {} as Record<MetricKey, 'money' | 'count'>);

const METRIC_COLORS: Record<MetricKey, string> = {
  revBRL: '#8B5CF6', // roxo
  depositsBRL: '#FB7185', // rosa/vermelho
  salesBRL: '#60A5FA', // azul
  trafficBRL: '#A3A3A3', // cinza

  salesCount: '#F59E0B', // laranja
  leadsTotal: '#34D399', // verde
  ftdCount: '#FACC15', // amarelo
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function formatBRL(value: number) {
  const v = Number(value ?? 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatInt(n: number) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

function safeNumber(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clampMin0(v: any) {
  const n = safeNumber(v);
  return n < 0 ? 0 : n;
}

function computeMinMax(data: any[], keys: string[]) {
  let min = 0;
  let max = 0;
  let started = false;

  for (const row of data) {
    for (const k of keys) {
      const v = safeNumber((row as any)?.[k]);
      if (!started) {
        min = v;
        max = v;
        started = true;
      } else {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }

  min = Math.min(min, 0);
  max = Math.max(max, 0);

  if (min === max) max = min + 1;

  return { min, max };
}

function makeNiceTicks0toMax(max: number, parts = 4) {
  const m = Math.max(0, Math.ceil(max));
  if (m === 0) return [0];

  const step = Math.max(1, Math.ceil(m / parts));
  const ticks: number[] = [];
  for (let v = 0; v <= m; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== m) ticks.push(m);
  return ticks;
}

function CustomTooltip({
  active,
  payload,
  label,
  hidden,
}: {
  active?: boolean;
  payload?: any[];
  label?: any;
  hidden: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0B1022]/95 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.55)] p-3">
      <div className="text-white/80 text-xs font-medium mb-2">{String(label)}</div>

      <div className="space-y-1.5">
        {payload
          .filter((p) => p && p.dataKey)
          .map((p, idx) => {
            const k = String(p.dataKey) as MetricKey;
            const kind = METRIC_KIND[k] ?? (String(p.dataKey).includes('BRL') ? 'money' : 'count');

            const val = hidden
              ? kind === 'money'
                ? 'R$ ••••'
                : '•••'
              : kind === 'money'
                ? formatBRL(safeNumber(p.value))
                : formatInt(safeNumber(p.value));

            return (
              <div key={idx} className="flex items-center justify-between gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-white/75">{p.name}</span>
                </div>
                <div className="text-white/90 font-medium">{val}</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default function ExpertLineChart({
  points,
  defaultEnabled,
}: {
  points: ExpertSeriesPoint[];
  defaultEnabled?: Partial<Record<MetricKey, boolean>>;
}) {
  const { hidden } = useSensitiveMode();

  const [enabled, setEnabled] = useState<Record<MetricKey, boolean>>(() => {
    // ✅ default pedido: só REV + Depósitos + Leads + FTD
    const base: Record<MetricKey, boolean> = {
      revBRL: true,
      depositsBRL: true,
      leadsTotal: true,
      ftdCount: true,

      salesBRL: false,
      trafficBRL: false,
      salesCount: false,
    };
    return { ...base, ...(defaultEnabled ?? {}) } as Record<MetricKey, boolean>;
  });

  const hasCountAxis = useMemo(() => {
    return METRICS.some((m) => m.kind === 'count' && enabled[m.key]);
  }, [enabled]);

  const hasMoneyAxis = useMemo(() => {
    return METRICS.some((m) => m.kind === 'money' && enabled[m.key]);
  }, [enabled]);

  function toggleMetric(k: MetricKey) {
    setEnabled((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  // ✅ GARANTIA VISUAL: contagens nunca negativas; só REV pode ser negativo
  const data = useMemo(() => {
    return (points ?? []).map((p) => ({
      ...p,

      // COUNT (nunca < 0)
      leadsTotal: clampMin0(p.leadsTotal),
      leadsActive: clampMin0(p.leadsActive),
      ftdCount: clampMin0(p.ftdCount),
      salesCount: clampMin0(p.salesCount),

      // MONEY
      revBRL: safeNumber(p.revBRL), // REV pode ser negativo
      depositsBRL: clampMin0(p.depositsBRL),
      salesBRL: clampMin0(p.salesBRL),
      trafficBRL: clampMin0(p.trafficBRL),
    }));
  }, [points]);

  // ✅ Alinhamento do 0 (money x count) + ticks do count só >= 0
  const domains = useMemo(() => {
    const moneyKeys = [
      enabled.revBRL ? 'revBRL' : null,
      enabled.depositsBRL ? 'depositsBRL' : null,
      enabled.salesBRL ? 'salesBRL' : null,
      enabled.trafficBRL ? 'trafficBRL' : null,
    ].filter(Boolean) as string[];

    const countKeys = [
      enabled.leadsTotal ? 'leadsTotal' : null,
      enabled.ftdCount ? 'ftdCount' : null,
      enabled.salesCount ? 'salesCount' : null,
    ].filter(Boolean) as string[];

    const hasMoney = moneyKeys.length > 0;
    const hasCount = countKeys.length > 0;

    const money = hasMoney ? computeMinMax(data, moneyKeys) : { min: 0, max: 1 };
    const count = hasCount ? computeMinMax(data, countKeys) : { min: 0, max: 1 };

    const moneyDomain: [number, number] = [money.min, money.max];

    let countMax = Math.max(0, count.max);
    if (countMax === 0) countMax = 1;
    let countMin = 0;

    if (hasMoney && hasCount && money.min < 0) {
      const moneyRange = money.max - money.min;
      const zeroPos = (0 - money.min) / (moneyRange || 1);

      const eps = 1e-9;
      const denom = Math.max(eps, 1 - zeroPos);
      const computed = -((zeroPos * countMax) / denom);

      if (Number.isFinite(computed) && computed <= 0) countMin = computed;
    }

    const countDomain: [number, number] = [countMin, countMax];
    const countTicks = makeNiceTicks0toMax(countMax, 4);

    return { moneyDomain, countDomain, countTicks };
  }, [data, enabled]);

  const moneyTick = (v: any) => (hidden ? 'R$ ••••' : formatBRL(safeNumber(v)));
  const countTick = (v: any) => (hidden ? '•••' : formatInt(safeNumber(v)));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
      {/* controles */}
      <div className="p-4 border-b border-white/10 flex flex-wrap items-center gap-2">
        <div className="text-white/80 text-sm font-medium mr-2">Métricas</div>

        {METRICS.map((m) => {
          const on = enabled[m.key];
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggleMetric(m.key)}
              className={cx(
                'h-9 px-3 rounded-xl border border-white/10 text-xs font-medium transition',
                on ? 'bg-white/[0.08] text-white/90' : 'bg-white/[0.02] text-white/60 hover:bg-white/[0.05]',
              )}
              title={m.label}
            >
              <span
                className="inline-block h-2 w-2 rounded-full mr-2 align-middle"
                style={{ backgroundColor: METRIC_COLORS[m.key], opacity: on ? 1 : 0.35 }}
              />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        <div className={cx('h-[320px] w-full', hidden && 'select-none')} style={hidden ? { pointerEvents: 'none' } : undefined}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />

              <XAxis
                dataKey="label"
                tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                tickLine={{ stroke: 'rgba(255,255,255,0.12)' }}
              />

              {hasMoneyAxis ? (
                <YAxis
                  yAxisId="money"
                  tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                  tickFormatter={moneyTick}
                  width={84}
                  domain={domains.moneyDomain}
                />
              ) : null}

              {hasCountAxis ? (
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                  tickFormatter={countTick}
                  width={54}
                  allowDecimals={false}
                  domain={domains.countDomain}
                  ticks={domains.countTicks}
                />
              ) : null}

              {/* ✅ remove o risco pontilhado/“cursor” */}
              <Tooltip content={<CustomTooltip hidden={hidden} />} cursor={false} />
              <Legend wrapperStyle={{ display: 'none' }} />

              {/* MONEY */}
              {enabled.revBRL && (
                <Area
                  yAxisId="money"
                  type="monotone"
                  dataKey="revBRL"
                  name="REV"
                  stroke={METRIC_COLORS.revBRL}
                  fill={METRIC_COLORS.revBRL}
                  fillOpacity={0.10}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              )}

              {enabled.depositsBRL && (
                <Area
                  yAxisId="money"
                  type="monotone"
                  dataKey="depositsBRL"
                  name="Depósitos (R$)"
                  stroke={METRIC_COLORS.depositsBRL}
                  fill={METRIC_COLORS.depositsBRL}
                  fillOpacity={0.10}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              )}

              {enabled.salesBRL && (
                <Area
                  yAxisId="money"
                  type="monotone"
                  dataKey="salesBRL"
                  name="R$ Vendas"
                  stroke={METRIC_COLORS.salesBRL}
                  fill={METRIC_COLORS.salesBRL}
                  fillOpacity={0.08}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              )}

              {enabled.trafficBRL && (
                <Area
                  yAxisId="money"
                  type="monotone"
                  dataKey="trafficBRL"
                  name="Tráfego (gasto)"
                  stroke={METRIC_COLORS.trafficBRL}
                  fill={METRIC_COLORS.trafficBRL}
                  fillOpacity={0.08}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              )}

              {/* COUNT */}
              {enabled.salesCount && (
                <Area
                  yAxisId="count"
                  type="monotone"
                  dataKey="salesCount"
                  name="Qtd Vendas"
                  stroke={METRIC_COLORS.salesCount}
                  fill={METRIC_COLORS.salesCount}
                  fillOpacity={0.10}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              )}

              {enabled.leadsTotal && (
                <Area
                  yAxisId="count"
                  type="monotone"
                  dataKey="leadsTotal"
                  name="Leads"
                  stroke={METRIC_COLORS.leadsTotal}
                  fill={METRIC_COLORS.leadsTotal}
                  fillOpacity={0.10}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              )}

              {enabled.ftdCount && (
                <Area
                  yAxisId="count"
                  type="monotone"
                  dataKey="ftdCount"
                  name="FTD"
                  stroke={METRIC_COLORS.ftdCount}
                  fill={METRIC_COLORS.ftdCount}
                  fillOpacity={0.10}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* legenda bonita */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs text-white/55">
          {METRICS.filter((m) => enabled[m.key]).map((m) => (
            <div key={m.key} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: METRIC_COLORS[m.key] }} />
              <span>{m.label}</span>
            </div>
          ))}
        </div>

        {hidden ? (
          <div className="mt-3 text-center text-xs text-white/45">
            Dados ocultos (ative o “olho” para visualizar).
          </div>
        ) : null}
      </div>
    </div>
  );
}
