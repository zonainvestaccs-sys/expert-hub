// src/lib/recurrence.ts
import type { CreateAppointmentInput } from '@/lib/appointments';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly';

export type RecurrenceRule = {
  freq: RecurrenceFreq;
  interval?: number; // default 1
  count?: number; // número de ocorrências
  until?: string; // ISO (inclusive)
  byWeekday?: number[]; // 0=Dom ... 6=Sáb (para weekly)
  exDates?: string[]; // ISO datas a excluir (compara por dia UTC)
};

function dayKeyUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function addDaysUTC(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonthsUTC(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

function clampInterval(n?: number) {
  const v = Number(n ?? 1);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;
}

function normalizeWeekdays(byWeekday?: number[]) {
  const arr = Array.isArray(byWeekday) ? byWeekday : [];
  const norm = Array.from(new Set(arr.map((x) => Math.max(0, Math.min(6, Math.floor(Number(x)))))));
  norm.sort((a, b) => a - b);
  return norm;
}

export function buildRecurringAppointments(base: CreateAppointmentInput, rule: RecurrenceRule): CreateAppointmentInput[] {
  if (!base?.startAt) throw new Error('base.startAt é obrigatório (ISO)');

  const interval = clampInterval(rule.interval);
  const start0 = new Date(base.startAt);
  if (Number.isNaN(start0.getTime())) throw new Error('base.startAt inválido');

  const end0 = base.endAt ? new Date(base.endAt) : null;
  if (base.endAt && (!end0 || Number.isNaN(end0.getTime()))) throw new Error('base.endAt inválido');

  const durationMs = base.allDay || !end0 ? null : Math.max(0, end0.getTime() - start0.getTime());

  const until = rule.until ? new Date(rule.until) : null;
  if (rule.until && (!until || Number.isNaN(until.getTime()))) throw new Error('rule.until inválido');

  const count = rule.count ? Math.max(1, Math.floor(rule.count)) : null;

  if (!count && !until) throw new Error('Recorrência precisa de count ou until');

  const exSet = new Set(
    (rule.exDates ?? [])
      .map((iso) => {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? null : dayKeyUTC(d);
      })
      .filter(Boolean) as string[],
  );

  const out: CreateAppointmentInput[] = [];

  const pushOccurrence = (start: Date) => {
    const key = dayKeyUTC(start);
    if (exSet.has(key)) return;

    const startIso = start.toISOString();
    const endIso = base.allDay || durationMs === null ? null : new Date(start.getTime() + durationMs).toISOString();

    out.push({ ...base, startAt: startIso, endAt: endIso });
  };

  if (rule.freq === 'daily') {
    let cur = new Date(start0);
    while (true) {
      if (until && cur.getTime() > until.getTime()) break;
      pushOccurrence(cur);
      if (count && out.length >= count) break;
      cur = addDaysUTC(cur, interval);
    }
    return out;
  }

  if (rule.freq === 'monthly') {
    let cur = new Date(start0);
    while (true) {
      if (until && cur.getTime() > until.getTime()) break;
      pushOccurrence(cur);
      if (count && out.length >= count) break;
      cur = addMonthsUTC(cur, interval);
    }
    return out;
  }

  // weekly
  const byWeekday = normalizeWeekdays(rule.byWeekday);
  const useDays = byWeekday.length ? byWeekday : [start0.getUTCDay()];

  const timeH = start0.getUTCHours();
  const timeM = start0.getUTCMinutes();
  const timeS = start0.getUTCSeconds();
  const timeMs = start0.getUTCMilliseconds();

  const startAnchor = new Date(Date.UTC(start0.getUTCFullYear(), start0.getUTCMonth(), start0.getUTCDate()));
  const dow0 = start0.getUTCDay();
  let weekStart = addDaysUTC(startAnchor, -dow0);

  while (true) {
    for (const wd of useDays) {
      const occ = addDaysUTC(weekStart, wd);
      occ.setUTCHours(timeH, timeM, timeS, timeMs);

      if (occ.getTime() < start0.getTime()) continue;
      if (until && occ.getTime() > until.getTime()) continue;

      pushOccurrence(occ);
      if (count && out.length >= count) return out;
    }

    weekStart = addDaysUTC(weekStart, 7 * interval);

    if (until) {
      // se o primeiro dia útil possível da próxima semana já passou do until, encerra
      const probe = addDaysUTC(weekStart, useDays[0]);
      probe.setUTCHours(timeH, timeM, timeS, timeMs);
      if (probe.getTime() > until.getTime()) break;
    }
  }

  return out;
}
