'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Expert = { id: string; email: string };

type Props = {
  experts: Expert[];
  value: string; // 'all' ou id
  onChange: (v: string) => void;
};

export function ExpertCombobox({ experts, value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');

  const items = React.useMemo(() => {
    const base = [{ id: 'all', email: 'Todos os experts' }, ...experts];
    if (!q.trim()) return base;
    const qq = q.toLowerCase();
    return base.filter((x) => x.email.toLowerCase().includes(qq));
  }, [experts, q]);

  const selected = React.useMemo(() => {
    if (value === 'all') return 'Todos os experts';
    return experts.find((x) => x.id === value)?.email ?? 'Selecionar expert';
  }, [experts, value]);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        className="w-[260px] justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <Users size={16} className="text-white/70" />
          <span className="truncate text-white/85">{selected}</span>
        </span>
        <ChevronsUpDown size={16} className="text-white/55" />
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] rounded-2xl border border-white/10 bg-[hsl(225_25%_6%)] p-3 shadow-soft backdrop-blur-xl">
          <div className="text-sm font-extrabold text-white/90">Filtrar por expert</div>
          <div className="mt-2">
            <input
              className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white/90 outline-none placeholder:text-white/40 focus:border-primary/40"
              placeholder="Buscar por email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/20">
            {items.map((x) => {
              const active = value === x.id;
              return (
                <button
                  key={x.id}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-white/85 hover:bg-white/6',
                    active && 'bg-white/6',
                  )}
                  onClick={() => {
                    onChange(x.id);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{x.email}</span>
                  {active ? <Check size={16} className="text-primary" /> : <span className="w-4" />}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => { onChange('all'); setOpen(false); }}>
              Limpar filtro
            </Button>
            <Button type="button" className="flex-1" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
