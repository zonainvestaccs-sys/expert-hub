'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Props = {
  value: { from: string; to: string };
  onChange: (next: { from: string; to: string }) => void;
};

function toDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toISO(d?: Date) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);

  const range: DateRange = {
    from: value.from ? toDate(value.from) : undefined,
    to: value.to ? toDate(value.to) : undefined,
  };

  const label = React.useMemo(() => {
    const f = range.from ? format(range.from, 'dd/MM/yyyy') : '—';
    const t = range.to ? format(range.to, 'dd/MM/yyyy') : '—';
    return `${f} → ${t}`;
  }, [range.from, range.to]);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        className="w-[260px] justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <CalendarIcon size={16} className="text-white/70" />
          <span className="text-white/85">{label}</span>
        </span>
        <span className="text-white/45 text-xs">Período</span>
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] rounded-2xl border border-white/10 bg-[hsl(225_25%_6%)] p-3 shadow-soft backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2">
            <div className="text-sm font-extrabold text-white/90">Selecionar período</div>
            <button
              className="rounded-lg px-2 py-1 text-xs text-white/60 hover:bg-white/5"
              onClick={() => setOpen(false)}
            >
              Fechar
            </button>
          </div>

          <div className={cn('rounded-xl border border-white/10 bg-black/20 p-2')}>
            <DayPicker
              mode="range"
              selected={range}
              onSelect={(r) => {
                const nextFrom = toISO(r?.from);
                const nextTo = toISO(r?.to);
                if (nextFrom) onChange({ from: nextFrom, to: nextTo || nextFrom });
              }}
              numberOfMonths={2}
              showOutsideDays
              className="text-white"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => onChange({ from: '2026-01-01', to: '2026-12-31' })}
            >
              Ano atual
            </Button>
            <Button type="button" className="flex-1" onClick={() => setOpen(false)}>
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
