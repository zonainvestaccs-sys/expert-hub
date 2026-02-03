// frontend/src/components/admin/AdminCronogramasCalendar.tsx
'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';

import FullCalendar from '@fullcalendar/react';
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

// ✅ Tipos “compatíveis” (evita quebrar em versões diferentes do FullCalendar)
type FcMouseArg = {
  event: any;
  el: HTMLElement;
  [key: string]: any;
};

type ExpertLite = {
  id: string;
  email: string;
  photoUrl: string | null;
};

type AppointmentAdmin = {
  id: string;
  expertId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  color: string | null;
  expert: ExpertLite;
};

type HoverCard = {
  open: boolean;
  x: number;
  y: number;
  title: string;
  dateLine: string;
  timeLine: string;
  location: string;
  description: string;
  expertEmail: string;
  expertPhoto: string | null;
  color: string;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function pickColorOrDefault(v?: string | null) {
  const s = String(v ?? '').trim();
  return s ? s : '#6A5CFF';
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ✅ pega token como você já usa no projeto (ajuste se o seu storage for diferente)
function getTokenSafe() {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('auth_token') ||
    null
  );
}

// ✅ base url
function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

async function fetchJson<T>(path: string) {
  const token = getTokenSafe();
  const res = await fetch(`${apiBase()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Erro HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function AdminCronogramasCalendar() {
  const hoverRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [experts, setExperts] = useState<Array<{ id: string; email: string; photoUrl: string | null }>>([]);
  const [expertId, setExpertId] = useState<string>('all');

  const [items, setItems] = useState<AppointmentAdmin[]>([]);
  const [hover, setHover] = useState<HoverCard | null>(null);

  const ensureExperts = useCallback(async () => {
    // tenta usar rota que você já tem no admin
    // se sua resposta tiver outro formato, me manda que eu ajusto.
    const data = await fetchJson<any>('/admin/experts');
    const list = Array.isArray(data) ? data : data?.items || data?.experts || [];
    const normalized = list
      .map((x: any) => ({
        id: String(x.id),
        email: String(x.email ?? ''),
        photoUrl: x.photoUrl ? String(x.photoUrl) : null,
      }))
      .filter((x: any) => x.id && x.email);

    setExperts(normalized);
  }, []);

  const refresh = useCallback(
    async (fromIso: string, toIso: string, exId: string) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        // carrega experts 1x
        if (!experts.length) {
          await ensureExperts();
        }

        const q = new URLSearchParams();
        q.set('from', fromIso);
        q.set('to', toIso);
        if (exId && exId !== 'all') q.set('expertId', exId);

        const data = await fetchJson<AppointmentAdmin[]>(`/admin/cronogramas?${q.toString()}`);
        setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErrorMsg(typeof e?.message === 'string' ? e.message : 'Falha ao carregar cronogramas');
      } finally {
        setLoading(false);
      }
    },
    [experts.length, ensureExperts],
  );

  const onDatesSet = useCallback(
    async (arg: DatesSetArg) => {
      const fromIso = arg.start.toISOString();
      const toIso = arg.end.toISOString();
      setRange({ from: fromIso, to: toIso });
      await refresh(fromIso, toIso, expertId);
    },
    [refresh, expertId],
  );

  const events = useMemo(() => {
    return items.map((a) => {
      const color = pickColorOrDefault(a.color);
      return {
        id: a.id,
        title: a.title,
        start: a.startAt,
        end: a.endAt ?? undefined,
        allDay: a.allDay,
        backgroundColor: color,
        borderColor: color,
        textColor: 'rgba(255,255,255,0.95)',
        extendedProps: {
          description: a.description ?? '',
          location: a.location ?? '',
          color,
          expertEmail: a.expert?.email ?? '',
          expertPhoto: a.expert?.photoUrl ?? null,
        },
      };
    });
  }, [items]);

  const buildHover = useCallback((arg: FcMouseArg) => {
    const ev = arg.event;
    const start = ev.start ? new Date(ev.start) : new Date();
    const end = ev.end ? new Date(ev.end) : null;

    const ep: any = (ev as any).extendedProps ?? {};
    const rect = (arg.el as HTMLElement).getBoundingClientRect();

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    const x = clamp(rect.right + 14, 12, vw - 360);
    const y = clamp(rect.top + 8, 12, vh - 240);

    const dateLine = start.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    let timeLine = '';
    if (ev.allDay) timeLine = 'Dia todo';
    else {
      const s = fmtTime(start);
      const e = end ? fmtTime(end) : '';
      timeLine = e ? `${s} • ${e}` : s;
    }

    const card: HoverCard = {
      open: true,
      x,
      y,
      title: String(ev.title ?? '').trim() || 'Compromisso',
      dateLine,
      timeLine,
      location: String(ep.location ?? ''),
      description: String(ep.description ?? ''),
      expertEmail: String(ep.expertEmail ?? ''),
      expertPhoto: ep.expertPhoto ? String(ep.expertPhoto) : null,
      color: pickColorOrDefault(ep.color),
    };

    return card;
  }, []);

  const onEventMouseEnter = useCallback(
    (arg: FcMouseArg) => {
      const card = buildHover(arg);
      setHover(card);
      requestAnimationFrame(() => {
        if (!hoverRef.current) return;
        hoverRef.current.style.transform = `translate3d(${card.x}px, ${card.y}px, 0)`;
      });
    },
    [buildHover],
  );

  const onEventMouseLeave = useCallback((_arg: FcMouseArg) => {
    setHover(null);
    if (hoverRef.current) hoverRef.current.style.transform = `translate3d(-9999px,-9999px,0)`;
  }, []);

  const onEventClick = useCallback(
    (arg: EventClickArg) => {
      // click também abre (fixa) os detalhes
      const fakeEnterArg: any = { event: arg.event, el: arg.el };
      const card = buildHover(fakeEnterArg);
      setHover(card);
      requestAnimationFrame(() => {
        if (!hoverRef.current) return;
        hoverRef.current.style.transform = `translate3d(${card.x}px, ${card.y}px, 0)`;
      });
    },
    [buildHover],
  );

  return (
    <div className="space-y-3">
      {/* topo (filtros) */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1022]/60 p-4 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div className="min-w-0">
          <div className="text-white/90 font-semibold">Calendário de Cronogramas</div>
          <div className="text-white/45 text-xs mt-1">
            {range ? `Intervalo carregado • ${items.length} evento(s)` : 'Selecione/role o calendário para carregar'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-white/60 text-sm">Filtrar expert:</label>
          <select
            value={expertId}
            onChange={async (e) => {
              const v = e.target.value;
              setExpertId(v);
              if (range) await refresh(range.from, range.to, v);
            }}
            className="h-10 px-3 rounded-2xl border border-white/10 bg-white/[0.03] text-white/85 outline-none"
          >
            <option value="all">Todos</option>
            {experts.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
          {errorMsg}
        </div>
      ) : null}

      {loading ? <div className="text-white/55 text-sm">Carregando…</div> : null}

      {/* hover/click details */}
      {hover ? (
        <div
          ref={hoverRef}
          className="fixed z-[9999] w-[340px] rounded-2xl border border-white/10 bg-[#0B1022]/95 shadow-[0_40px_160px_rgba(0,0,0,0.75)] overflow-hidden"
          style={{ transform: 'translate3d(-9999px,-9999px,0)' }}
          aria-hidden="true"
        >
          <div className="h-1.5" style={{ background: hover.color }} />
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-white/92 font-semibold truncate">{hover.title}</div>
                <div className="text-white/45 text-xs mt-1 capitalize">{hover.dateLine}</div>
                <div className="text-white/60 text-xs mt-1">{hover.timeLine}</div>
              </div>

              <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden grid place-items-center">
                {hover.expertPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hover.expertPhoto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-white/40 text-xs">—</div>
                )}
              </div>
            </div>

            <div className="mt-3 text-white/65 text-xs">
              <span className="text-white/45">Expert:</span> {hover.expertEmail || '—'}
            </div>

            {hover.location ? (
              <div className="mt-2 text-white/70 text-sm">
                <span className="text-white/45 text-xs">Local:</span> {hover.location}
              </div>
            ) : null}

            {hover.description ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-white/70 text-sm whitespace-pre-wrap">
                {hover.description}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setHover(null)}
              className="mt-3 h-10 w-full rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] transition text-white/80 text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {/* calendar */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1022]/60 p-3 overflow-hidden">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
          locale={ptBrLocale}
          firstDay={0} // ✅ Domingo primeiro (como você queria)
          weekends
          nowIndicator
          selectable={false}
          editable={false}
          height={780}
          expandRows
          stickyHeaderDates
          handleWindowResize
          eventDisplay="block"
          dayMaxEventRows={4}
          events={events}
          datesSet={onDatesSet}
          eventMouseEnter={onEventMouseEnter as any}
          eventMouseLeave={onEventMouseLeave as any}
          eventClick={onEventClick}
          slotMinTime="06:00:00"
          slotMaxTime="23:30:00"
          // ✅ avatar + título dentro do evento
          eventContent={(arg) => {
            const ep: any = arg.event.extendedProps ?? {};
            const photo = ep.expertPhoto as string | null;
            const email = String(ep.expertEmail ?? '');
            return (
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-5 w-5 rounded-full overflow-hidden border border-white/15 bg-white/10 shrink-0">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold leading-tight">{arg.event.title}</div>
                  <div className="truncate text-[10px] opacity-80">{email}</div>
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
