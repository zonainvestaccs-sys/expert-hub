// src/components/CronogramaCalendar.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import FullCalendar from '@fullcalendar/react';
import type {
  EventApi,
  DatesSetArg,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  DateClickArg,
  EventMouseEnterArg,
  EventMouseLeaveArg,
  EventContentArg,
} from '@fullcalendar/core';
import type { CalendarApi } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

import {
  createAppointment,
  deleteAppointment,
  listAppointments,
  updateAppointment,
  type Appointment,
  type CreateAppointmentInput,
  type UpdateAppointmentInput,
} from '@/lib/appointments';

import { fetchExpertActivations } from '@/lib/expert';
import { getToken } from '@/lib/auth';
import { buildRecurringAppointments, type RecurrenceFreq } from '@/lib/recurrence';

import {
  scheduleLocalAppointmentReminders,
  type ExpertNotification,
} from '@/lib/notifications';

import {
  CalendarDays,
  Clock,
  MapPin,
  Trash2,
  X,
  Search,
  Plus,
  ChevronRight,
  ChevronLeft,
  Filter,
  Check,
  Sparkles,
  List as ListIcon,
  LayoutGrid,
  Wand2,
  Repeat,
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose,
  Maximize2,
  Minimize2,
  Pencil,
  Zap,
} from 'lucide-react';

import { ZI_FC_CSS } from '@/components/cronogramaCalendarStyles';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

/* ---------------------- helpers ---------------------- */

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function isoFromLocalInput(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error('Data inválida');
  return d.toISOString();
}

function safeEndIsoFromLocalInput(v: string, startIso: string, allDay: boolean) {
  if (allDay) return null;
  if (!v) return null;
  const endIso = isoFromLocalInput(v);
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) return null;
  return endIso;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDateShort(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function fmtDateLong(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: any) {
  return String(v ?? '').trim();
}

function pickColorOrDefault(v?: string | null) {
  const s = String(v ?? '').trim();
  return s ? s : '#6A5CFF';
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function createInChunks<T>(tasks: Array<() => Promise<T>>, chunkSize = 8): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const slice = tasks.slice(i, i + chunkSize);
    const res = await Promise.all(slice.map((fn) => fn()));
    out.push(...res);
  }
  return out;
}

function useInjectGlobalCssOnce(id: string, cssText: string) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const exists = document.getElementById(id) as HTMLStyleElement | null;
    if (exists) return;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = cssText;
    document.head.appendChild(style);
  }, [id, cssText]);
}

/* ---------------------- ✅ CSS FIXES ---------------------- */

const ZI_FC_HEADER_DARK_FIX = `
.ziCalendarApp .fc .fc-scrollgrid thead th,
.ziCalendarApp .fc .fc-scrollgrid thead td,
.ziCalendarApp .fc .fc-scrollgrid-section-header th,
.ziCalendarApp .fc .fc-scrollgrid-section-header td,
.ziCalendarApp .fc .fc-col-header,
.ziCalendarApp .fc .fc-col-header-cell,
.ziCalendarApp .fc .fc-timegrid-header,
.ziCalendarApp .fc .fc-timegrid-header th,
.ziCalendarApp .fc .fc-timegrid-header td,
.ziCalendarApp .fc .fc-timegrid-col-header,
.ziCalendarApp .fc .fc-timegrid-col-header-cushion,
.ziCalendarApp .fc .fc-scrollgrid-section-sticky th,
.ziCalendarApp .fc .fc-scrollgrid-section-sticky td {
  background: rgba(11,16,34,0.92) !important;
  background-color: rgba(11,16,34,0.92) !important;
}
.ziCalendarApp .fc .fc-col-header-cell-cushion,
.ziCalendarApp .fc .fc-timegrid-col-header-cushion {
  color: rgba(255,255,255,0.75) !important;
  font-weight: 600 !important;
}
.ziCalendarApp .fc .fc-timegrid-axis,
.ziCalendarApp .fc .fc-timegrid-axis-frame,
.ziCalendarApp .fc .fc-timegrid-axis-cushion {
  background: rgba(11,16,34,0.92) !important;
  background-color: rgba(11,16,34,0.92) !important;
  color: rgba(255,255,255,0.70) !important;
}
.ziCalendarApp .fc-theme-standard th,
.ziCalendarApp .fc-theme-standard td {
  border-color: rgba(255,255,255,0.10) !important;
}
.ziCalendarApp .fc table,
.ziCalendarApp .fc thead,
.ziCalendarApp .fc th {
  background-clip: padding-box !important;
}
`;

const ZI_FC_PAST_EVENTS = `
.ziCalendarApp .fc .zi-fc-past { opacity: 0.42 !important; filter: saturate(0.65) !important; }
.ziCalendarApp .fc .zi-fc-past .fc-event-title,
.ziCalendarApp .fc .zi-fc-past .fc-event-time { text-decoration: line-through !important; }
.ziCalendarApp .fc .zi-fc-past.fc-event,
.ziCalendarApp .fc .zi-fc-past .fc-event-main { box-shadow: none !important; }
.ziCalendarApp .fc .zi-fc-past:hover { opacity: 0.55 !important; }
`;

const ZI_FC_HOVER_FIXED = `
.ziCalendarApp .zi-fcHover {
  position: fixed !important;
  left: 0 !important;
  top: 0 !important;
  will-change: transform;
  z-index: 999999 !important;
  pointer-events: none !important;
}
`;

const ZI_FC_EVENT_PREMIUM = `
.ziCalendarApp .fc .fc-event { border-radius: 14px !important; overflow: visible !important; }
.ziCalendarApp .fc .fc-event-main { background: transparent !important; }
.ziCalendarApp .fc .fc-daygrid-event,
.ziCalendarApp .fc .fc-timegrid-event { background: transparent !important; border: 0 !important; }

.ziCalendarApp .fc .zi-fcEvtPill {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 6px 10px;
  box-shadow: 0 14px 60px rgba(0,0,0,0.35);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.20);
  line-height: 1;
}

.ziCalendarApp .fc .zi-fcEvtTime {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.02em;
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.ziCalendarApp .fc .zi-fcEvtTitle {
  min-width: 0;
  flex: 1;
  font-size: 12.5px;
  font-weight: 900;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ziCalendarApp .fc .zi-fcEvtDot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex: 0 0 auto;
  box-shadow: 0 8px 22px rgba(0,0,0,0.25);
}

.ziCalendarApp .fc .zi-fcEvtKind {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  white-space: nowrap;
}

.ziCalendarApp .fc .fc-timegrid-event .zi-fcEvtPill { margin-top: 2px; }
`;

/* ---------------------- UI presets ---------------------- */

const COLOR_PRESETS = [
  '#6A5CFF',
  '#3E78FF',
  '#22C55E',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#A3E635',
  '#14B8A6',
  '#F97316',
  '#E5E7EB',
] as const;

type ViewMode = 'calendar' | 'list';
type EntryKind = 'appointment' | 'activation';

type FormState = {
  id?: string;
  title: string;
  description: string;
  location: string;
  startAt: string; // datetime-local
  endAt: string; // datetime-local
  allDay: boolean;
  color: string;

  recurrenceEnabled: boolean;
  recurrenceFreq: RecurrenceFreq;
  recurrenceInterval: number;
  recurrenceMode: 'count' | 'until';
  recurrenceCount: number;
  recurrenceUntil: string; // datetime-local
  recurrenceWeekdays: number[]; // 0..6
};

type HoverPreview = {
  open: boolean;
  x: number;
  y: number;
  title: string;
  dateLine: string;
  timeLine: string;
  location: string;
  description: string;
  color: string;
};

type Entry = {
  kind: EntryKind;
  id: string;

  title: string;
  description?: string | null;
  location?: string | null;

  /**
   * Para compromissos: ISO normal
   * Para ativações: armazenamos o dateIso "YYYY-MM-DD" (pra não quebrar timezone em allDay)
   */
  startAt: string;

  endAt?: string | null;
  allDay: boolean;

  color?: string | null;

  raw: any;
};

function safeHex(v: string) {
  const s = String(v || '').trim();
  if (!s) return '#6A5CFF';
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1],
      g = s[2],
      b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#6A5CFF';
}
function hexToRgb(hex: string) {
  const h = safeHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function pickTextColorForBg(bgHex: string) {
  const lum = relativeLuminance(hexToRgb(bgHex));
  return lum > 0.55 ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.95)';
}
function isBlackText(rgba: string) {
  return rgba.includes('0,0,0');
}

function parseEntryStartDate(entry: Entry) {
  // ativação: YYYY-MM-DD => local midnight
  if (entry.kind === 'activation' && /^\d{4}-\d{2}-\d{2}$/.test(entry.startAt)) {
    return new Date(`${entry.startAt}T00:00:00`);
  }
  const d = new Date(entry.startAt);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
function parseEntryEndDate(entry: Entry) {
  if (!entry.endAt) return null;
  const d = new Date(entry.endAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isEntryPast(entry: Entry, nowMs: number) {
  const s = parseEntryStartDate(entry);
  const e = parseEntryEndDate(entry);
  if (entry.allDay) return endOfDay(s).getTime() < nowMs;
  if (e) return e.getTime() < nowMs;
  return s.getTime() < nowMs;
}

/* ✅ normaliza Appointment -> Entry */
function appointmentToEntry(a: Appointment): Entry {
  return {
    kind: 'appointment',
    id: String(a.id),
    title: String(a.title ?? ''),
    description: a.description ?? '',
    location: a.location ?? '',
    startAt: a.startAt,
    endAt: a.endAt ?? null,
    allDay: Boolean(a.allDay),
    color: a.color ?? null,
    raw: a,
  };
}

/* ✅ normaliza item de ativação (do fetchExpertActivations) -> Entry */
function activationItemToEntry(a: any, fallbackId: string): Entry {
  const id = str(a?.id) || fallbackId;
  const dateIso = str(a?.date) || ''; // yyyy-mm-dd
  const title = str(a?.activation) || 'Ativação';
  const description = str(a?.description) || '';

  // Mantemos startAt como YYYY-MM-DD pra allDay não quebrar por timezone
  const startAt = /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : str(a?.dateLabel) || dateIso || '';

  return {
    kind: 'activation',
    id,
    title,
    description,
    location: '',
    startAt,
    endAt: null,
    allDay: true,
    color: '#22C55E',
    raw: a,
  };
}

/* ✅ Entry -> FullCalendar event */
function entryToEvent(entry: Entry, selectedKey: string | null | undefined, nowMs: number) {
  const color = safeHex(pickColorOrDefault(entry.color ?? null));
  const key = `${entry.kind}:${entry.id}`;

  const isSelected = Boolean(selectedKey && key === selectedKey);
  const isPast = isEntryPast(entry, nowMs);
  const textColor = pickTextColorForBg(color);

  const classNames: string[] = [];
  if (isSelected) classNames.push('zi-fc-selected');
  if (isPast) classNames.push('zi-fc-past');

  // Ativação allDay com start "YYYY-MM-DD" evita shift de fuso
  const start = entry.kind === 'activation' && /^\d{4}-\d{2}-\d{2}$/.test(entry.startAt) ? entry.startAt : entry.startAt;
  const end = entry.endAt ?? undefined;

  return {
    id: key,
    title: entry.title,
    start,
    end,
    allDay: entry.allDay,
    backgroundColor: color,
    borderColor: isSelected ? 'rgba(255,255,255,0.55)' : color,
    textColor,
    classNames,
    extendedProps: {
      kind: entry.kind,
      entryId: entry.id,
      description: entry.description ?? '',
      location: entry.location ?? '',
      color,
      textColor,
      raw: entry.raw,
    },
  };
}

function startEndFromEvent(event: EventApi) {
  const start = event.start;
  const end = event.end;
  const allDay = Boolean(event.allDay);

  const startAt = start ? start.toISOString() : new Date().toISOString();
  const endAt = end ? end.toISOString() : null;

  return { startAt, endAt, allDay };
}

function nowPlusMinutes(min: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + min);
  d.setSeconds(0, 0);
  return d;
}

/* ✅ preview perto do cursor */
function buildHoverFromEvent(arg: EventMouseEnterArg): HoverPreview {
  const ev = arg.event;
  const start = ev.start ? new Date(ev.start) : new Date();
  const end = ev.end ? new Date(ev.end) : null;
  const allDay = Boolean(ev.allDay);

  const title = String(ev.title ?? '').trim() || 'Compromisso';
  const dateLine = start.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  let timeLine = '';
  if (allDay) timeLine = 'Dia todo';
  else {
    const s = fmtTime(start);
    const e = end ? fmtTime(end) : '';
    timeLine = e ? `${s} • ${e}` : s;
  }

  const ep: any = (ev as any).extendedProps ?? {};
  const location = String(ep.location ?? '').trim();
  const description = String(ep.description ?? '').trim();
  const color = safeHex(pickColorOrDefault(String(ep.color ?? '')));

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const jsEv: any = (arg as any).jsEvent ?? null;
  let baseX = 0;
  let baseY = 0;

  if (jsEv && typeof jsEv.clientX === 'number' && typeof jsEv.clientY === 'number') {
    baseX = jsEv.clientX + 18;
    baseY = jsEv.clientY + 16;
  } else {
    const rect = (arg.el as HTMLElement).getBoundingClientRect();
    baseX = rect.left + rect.width / 2;
    baseY = rect.top + rect.height / 2;
  }

  const x = clamp(baseX, 12, vw - 360);
  const y = clamp(baseY, 12, vh - 220);

  return { open: true, x, y, title, dateLine, timeLine, location, description, color };
}

/* ✅ pill de horário com contraste */
function TimePill({ color, children }: { color: string; children: React.ReactNode }) {
  const bg = safeHex(color);
  const tc = pickTextColorForBg(bg);
  const black = isBlackText(tc);

  const chipBg = black ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.22)';
  const chipBorder = black ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.22)';

  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-[0_12px_50px_rgba(0,0,0,0.28)]"
      style={{
        background: bg,
        color: tc,
        borderColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <span
        className="text-[11px] font-extrabold tracking-wide px-2 py-0.5 rounded-full border"
        style={{ background: chipBg, borderColor: chipBorder }}
      >
        <Clock className="inline-block h-3.5 w-3.5 mr-1 -mt-[1px]" />
        {children}
      </span>
    </span>
  );
}

/* ✅ etiqueta premium no FullCalendar */
function renderPremiumEventContent(arg: EventContentArg) {
  const ep: any = (arg.event as any)?.extendedProps ?? {};
  const bg = safeHex(String(ep.color ?? arg.backgroundColor ?? '#6A5CFF'));
  const tc = String(ep.textColor ?? pickTextColorForBg(bg));
  const black = isBlackText(tc);

  const kind: EntryKind = (ep.kind as EntryKind) || 'appointment';
  const kindLabel = kind === 'activation' ? 'ATIVAÇÃO' : '';

  // Para allDay o timeText pode vir vazio, então pra ativação mostramos "DIA"
  const time = arg.timeText ? String(arg.timeText).trim() : kind === 'activation' ? 'DIA' : '';
  const title = String(arg.event.title ?? '').trim() || (kind === 'activation' ? 'Ativação' : 'Compromisso');

  const timeBg = black ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.22)';
  const timeBorder = black ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.24)';

  const kindBg = kind === 'activation' ? (black ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.18)') : 'transparent';
  const kindBorder = kind === 'activation' ? (black ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.22)') : 'transparent';

  return (
    <div
      className="zi-fcEvtPill"
      style={{
        background: bg,
        color: tc,
        borderColor: black ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.20)',
      }}
    >
      <span className="zi-fcEvtDot" style={{ background: black ? 'rgba(0,0,0,0.24)' : 'rgba(255,255,255,0.75)' }} />

      {kindLabel ? (
        <span className="zi-fcEvtKind" style={{ background: kindBg, border: `1px solid ${kindBorder}` }}>
          {kindLabel}
        </span>
      ) : null}

      {time ? (
        <span className="zi-fcEvtTime" style={{ background: timeBg, border: `1px solid ${timeBorder}` }}>
          {time}
        </span>
      ) : null}

      <span className="zi-fcEvtTitle">{title}</span>
    </div>
  );
}

/* ---------------------- ✅ notificações locais (bridge pro sininho) ---------------------- */

function emitExpertNotification(n: ExpertNotification) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('expert-notification', { detail: n }));
  } catch {
    // ignore
  }
}

/* ---------------------- component ---------------------- */

export default function CronogramaCalendar() {
  useInjectGlobalCssOnce('zi-fc-css', ZI_FC_CSS);
  useInjectGlobalCssOnce('zi-fc-css-header-fix', ZI_FC_HEADER_DARK_FIX);
  useInjectGlobalCssOnce('zi-fc-css-past-events', ZI_FC_PAST_EVENTS);
  useInjectGlobalCssOnce('zi-fc-css-hover-fixed', ZI_FC_HOVER_FIXED);
  useInjectGlobalCssOnce('zi-fc-css-event-premium', ZI_FC_EVENT_PREMIUM);

  const calendarRef = useRef<FullCalendar | null>(null);
  const apiRef = useRef<CalendarApi | null>(null);
  const calendarWrapRef = useRef<HTMLDivElement | null>(null);

  const tokenRef = useRef<string | null>(null);

  const [mode, setMode] = useState<ViewMode>('calendar');

  const [panorama, setPanorama] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);

  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [viewTitle, setViewTitle] = useState<string>('—');
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const [hover, setHover] = useState<HoverPreview | null>(null);
  const hoverOpenRef = useRef(false);

  const hoverBoxRef = useRef<HTMLDivElement | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const hoverPosRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });

  // filtros
  const [q, setQ] = useState('');
  const [onlyAllDay, setOnlyAllDay] = useState(false);
  const [onlyWithLocation, setOnlyWithLocation] = useState(false);

  // ✅ mostrar ativações
  const [showActivations, setShowActivations] = useState(true);

  const [sortAsc, setSortAsc] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // modal detalhes (compromisso ou ativação)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsKey, setDetailsKey] = useState<string | null>(null);

  const [quickTitle, setQuickTitle] = useState('');
  const [quickMinutes, setQuickMinutes] = useState(60);

  const pendingActionRef = useRef<((api: CalendarApi) => void) | null>(null);

  function addMonthsLocal(d: Date, months: number) {
    const x = new Date(d);
    const day = x.getDate();
    x.setDate(1);
    x.setMonth(x.getMonth() + months);
    const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, lastDay));
    return x;
  }

  const [form, setForm] = useState<FormState>(() => {
    const start = nowPlusMinutes(15);
    const end = nowPlusMinutes(75);
    return {
      title: '',
      description: '',
      location: '',
      startAt: toLocalInputValue(start),
      endAt: toLocalInputValue(end),
      allDay: false,
      color: '#6A5CFF',

      recurrenceEnabled: false,
      recurrenceFreq: 'weekly',
      recurrenceInterval: 1,
      recurrenceMode: 'count',
      recurrenceCount: 4,
      recurrenceUntil: toLocalInputValue(addMonthsLocal(new Date(), 1)),
      recurrenceWeekdays: [1, 3, 5],
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    tokenRef.current = getToken();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const ensureApi = useCallback(() => {
    if (apiRef.current) return apiRef.current;
    const inst: any = calendarRef.current as any;
    const api: CalendarApi | null = inst?.getApi?.() ?? null;
    if (api) apiRef.current = api;
    return api;
  }, []);

  useEffect(() => {
    const api = ensureApi();
    if (!api) return;
    requestAnimationFrame(() => {
      try {
        api.updateSize();
      } catch {}
    });
  }, [panorama, leftOpen, rightOpen, mode, ensureApi]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = calendarWrapRef.current;
    if (!el) return;

    const api = ensureApi();
    let raf: number | null = null;

    const ro = new ResizeObserver(() => {
      if (!api) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          api.updateSize();
        } catch {}
      });
    });

    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ensureApi, mode]);

  useEffect(() => {
    if (mode !== 'calendar') return;
    const api = ensureApi();
    if (!api) return;

    if (pendingActionRef.current) {
      const fn = pendingActionRef.current;
      pendingActionRef.current = null;
      try {
        fn(api);
      } catch {}
    }

    requestAnimationFrame(() => {
      try {
        api.updateSize();
      } catch {}
    });
  }, [mode, ensureApi]);

  const runOnApi = useCallback(
    (fn: (api: CalendarApi) => void) => {
      const api = ensureApi();
      if (api) {
        fn(api);
        return;
      }
      pendingActionRef.current = fn;
      setMode('calendar');
    },
    [ensureApi],
  );

  useEffect(() => {
    if (!modalOpen && !detailsOpen) return;
    setHover(null);
    hoverOpenRef.current = false;
    if (hoverBoxRef.current) hoverBoxRef.current.style.transform = `translate3d(-9999px,-9999px,0)`;
  }, [modalOpen, detailsOpen]);

  useEffect(() => {
    if (!hoverOpenRef.current) return;

    function applyPos(x: number, y: number) {
      hoverPosRef.current = { x, y };
      if (!hoverBoxRef.current) return;
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);

      hoverRafRef.current = requestAnimationFrame(() => {
        if (!hoverBoxRef.current) return;
        const { x: px, y: py } = hoverPosRef.current;
        hoverBoxRef.current.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      });
    }

    function onMove(e: MouseEvent) {
      if (!hoverOpenRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = clamp(e.clientX + 18, 12, vw - 360);
      const y = clamp(e.clientY + 16, 12, vh - 220);
      applyPos(x, y);
    }

    function onScrollOrResize() {
      if (!hoverOpenRef.current) return;
      setHover(null);
      hoverOpenRef.current = false;
      if (hoverBoxRef.current) hoverBoxRef.current.style.transform = `translate3d(-9999px,-9999px,0)`;
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true } as any);
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove as any);
      window.removeEventListener('scroll', onScrollOrResize as any, true as any);
      window.removeEventListener('resize', onScrollOrResize as any);
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    };
  }, [hover?.open]);

  /* ---------------------- data / mapping ---------------------- */

  const filteredEntries = useMemo(() => {
    const query = q.trim().toLowerCase();

    const out = entries.filter((e) => {
      if (!showActivations && e.kind === 'activation') return false;

      if (onlyAllDay && !e.allDay) return false;
      if (onlyWithLocation && !String(e.location ?? '').trim()) return false;

      if (!query) return true;
      const hay = `${e.title ?? ''} ${e.description ?? ''} ${e.location ?? ''} ${e.startAt ?? ''}`.toLowerCase();
      return hay.includes(query);
    });

    out.sort((a, b) => {
      const av = parseEntryStartDate(a).getTime();
      const bv = parseEntryStartDate(b).getTime();
      return sortAsc ? av - bv : bv - av;
    });

    return out;
  }, [entries, q, onlyAllDay, onlyWithLocation, sortAsc, showActivations]);

  const events = useMemo(() => filteredEntries.map((e) => entryToEvent(e, selectedKey, nowTick)), [filteredEntries, selectedKey, nowTick]);

  const dayItems = useMemo(() => {
    const dayStart = startOfDay(selectedDay).getTime();
    const dayEnd = endOfDay(selectedDay).getTime();
    return filteredEntries.filter((e) => {
      const s = parseEntryStartDate(e).getTime();
      return s >= dayStart && s <= dayEnd;
    });
  }, [filteredEntries, selectedDay]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return filteredEntries.filter((e) => parseEntryStartDate(e).getTime() >= now).slice(0, 8);
  }, [filteredEntries]);

  const selected = useMemo(() => (selectedKey ? entries.find((e) => `${e.kind}:${e.id}` === selectedKey) ?? null : null), [entries, selectedKey]);
  const detailsItem = useMemo(() => (detailsKey ? entries.find((e) => `${e.kind}:${e.id}` === detailsKey) ?? null : null), [entries, detailsKey]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now).getTime();
    const todayEnd = endOfDay(now).getTime();
    const nowMs = now.getTime();

    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const in7Ms = in7.getTime();

    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);
    const in30Ms = in30.getTime();

    const today = filteredEntries.filter((e) => {
      const s = parseEntryStartDate(e).getTime();
      return s >= todayStart && s <= todayEnd;
    }).length;

    const next7 = filteredEntries.filter((e) => {
      const s = parseEntryStartDate(e).getTime();
      return s >= nowMs && s <= in7Ms;
    }).length;

    const next30 = filteredEntries.filter((e) => {
      const s = parseEntryStartDate(e).getTime();
      return s >= nowMs && s <= in30Ms;
    }).length;

    return { today, next7, next30 };
  }, [filteredEntries]);

  const groupedList = useMemo(() => {
    const groups = new Map<string, Entry[]>();
    for (const e of filteredEntries) {
      const d = parseEntryStartDate(e);
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    const keys = Array.from(groups.keys()).sort((a, b) => (sortAsc ? a.localeCompare(b) : b.localeCompare(a)));

    return keys.map((k) => {
      const d = new Date(`${k}T00:00:00`);
      const arr = groups.get(k)!;
      arr.sort((a, b) => parseEntryStartDate(a).getTime() - parseEntryStartDate(b).getTime());
      return { key: k, date: d, items: arr };
    });
  }, [filteredEntries, sortAsc]);

  /* ---------------------- ✅ fetch de ativações igual sua página ---------------------- */

  const fetchActivationsAll = useCallback(async (token: string, fromYmd: string, toYmd: string) => {
    const pageSizeFetch = 100;
    let p = 1;

    let combined: any[] = [];
    let totalServer = 0;

    const MAX_FETCH_ITEMS = 5000;

    while (true) {
      const res = await fetchExpertActivations(token, {
        from: fromYmd,
        to: toYmd,
        page: p,
        pageSize: pageSizeFetch,
        q: undefined,
        sortBy: 'date',
        sortDir: 'asc',
        fresh: true,
      });

      const items = (res as any)?.items ?? [];
      totalServer = Number((res as any)?.total ?? totalServer ?? 0);

      combined = combined.concat(items);

      if (combined.length >= MAX_FETCH_ITEMS) {
        combined = combined.slice(0, MAX_FETCH_ITEMS);
        break;
      }

      if (combined.length >= totalServer) break;
      if (!items.length) break;

      p += 1;
    }

    return combined;
  }, []);

  /* ---------------------- refresh: appointments + activations ---------------------- */

  const refresh = useCallback(
    async (fromIso: string, toIso: string) => {
      const t = tokenRef.current ?? getToken();
      if (!t) return;

      setErrorMsg(null);
      setLoading(true);

      try {
        const fromDate = new Date(fromIso);
        const toDate = new Date(toIso);

        // Ativações aceitam yyyy-mm-dd (como sua página)
        const fromYmd = `${fromDate.getFullYear()}-${pad2(fromDate.getMonth() + 1)}-${pad2(fromDate.getDate())}`;
        const toYmd = `${toDate.getFullYear()}-${pad2(toDate.getMonth() + 1)}-${pad2(toDate.getDate())}`;

        const [apps, actsRaw] = await Promise.all([
          listAppointments({ from: fromIso, to: toIso }, t),
          fetchActivationsAll(t, fromYmd, toYmd),
        ]);

        const a1 = Array.isArray(apps) ? (apps as Appointment[]).map(appointmentToEntry) : [];
        const a2 = Array.isArray(actsRaw)
          ? (actsRaw as any[]).map((it, idx) => activationItemToEntry(it, `act-${idx + 1}`))
          : [];

        const merged = [...a1, ...a2].sort((x, y) => parseEntryStartDate(x).getTime() - parseEntryStartDate(y).getTime());
        setEntries(merged);
      } catch (e: any) {
        setErrorMsg(typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar cronograma');
      } finally {
        setLoading(false);
      }
    },
    [fetchActivationsAll],
  );

  const onDatesSet = useCallback(
    async (arg: DatesSetArg) => {
      const fromIso = arg.start.toISOString();
      const toIso = arg.end.toISOString();
      setRange({ from: fromIso, to: toIso });
      setViewTitle(arg.view?.title ? String(arg.view.title) : '—');
      await refresh(fromIso, toIso);
    },
    [refresh],
  );

  /* ---------------------- ✅ lembretes/notificações (perto do horário) ---------------------- */

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Só compromissos com horário (não allDay) — evita spam em "Dia todo"
    const appts = entries
      .filter((e) => e.kind === 'appointment' && !e.allDay)
      .map((e) => ({
        id: e.id,
        title: e.title,
        startAt: e.startAt,
        allDay: e.allDay,
      }));

    const cancel = scheduleLocalAppointmentReminders(
      appts,
      (n) => emitExpertNotification(n),
      {
        minutesBefore: [60, 15, 5],
        allowBrowserNotification: true,
        titlePrefix: 'Lembrete',
      },
    );

    return () => cancel();
  }, [entries]);

  /* ---------------------- create/edit (apenas compromissos) ---------------------- */

  const openCreateModal = useCallback(
    (start: Date, end?: Date, allDay?: boolean) => {
      const startLocal = toLocalInputValue(start);
      const endLocal = toLocalInputValue(end ?? new Date(start.getTime() + 60 * 60 * 1000));

      setForm((prev) => ({
        ...prev,
        id: undefined,
        title: '',
        description: '',
        location: '',
        startAt: startLocal,
        endAt: endLocal,
        allDay: Boolean(allDay),
        color: '#6A5CFF',

        recurrenceEnabled: false,
        recurrenceFreq: 'weekly',
        recurrenceInterval: 1,
        recurrenceMode: 'count',
        recurrenceCount: 4,
        recurrenceUntil: toLocalInputValue(addMonthsLocal(new Date(), 1)),
        recurrenceWeekdays: [1, 3, 5],
      }));

      setModalOpen(true);
      setErrorMsg(null);
    },
    [addMonthsLocal],
  );

  const openEditModal = useCallback((a: Appointment) => {
    const start = new Date(a.startAt);
    const end = a.endAt ? new Date(a.endAt) : new Date(start.getTime() + 60 * 60 * 1000);

    setForm((prev) => ({
      ...prev,
      id: a.id,
      title: a.title ?? '',
      description: a.description ?? '',
      location: a.location ?? '',
      startAt: toLocalInputValue(start),
      endAt: toLocalInputValue(end),
      allDay: Boolean(a.allDay),
      color: safeHex(pickColorOrDefault(a.color)),
      recurrenceEnabled: false,
    }));

    setModalOpen(true);
    setErrorMsg(null);
  }, []);

  const onSelect = useCallback(
    (arg: DateSelectArg) => {
      setSelectedDay(arg.start);
      openCreateModal(arg.start, arg.end, arg.allDay);
    },
    [openCreateModal],
  );

  const onDateClick = useCallback((arg: DateClickArg) => {
    setSelectedDay(arg.date);
  }, []);

  const closeDetails = useCallback(() => {
    setDetailsOpen(false);
    setDetailsKey(null);
  }, []);

  const onEventClick = useCallback((arg: EventClickArg) => {
    const id = String(arg.event.id || '');
    if (!id) return;

    setSelectedKey(id);
    setDetailsKey(id);
    setDetailsOpen(true);

    const start = arg.event.start ? new Date(arg.event.start) : null;
    if (start) setSelectedDay(start);

    setHover(null);
    hoverOpenRef.current = false;
    if (hoverBoxRef.current) hoverBoxRef.current.style.transform = `translate3d(-9999px,-9999px,0)`;
  }, []);

  const onEventMouseEnter = useCallback(
    (arg: EventMouseEnterArg) => {
      if (modalOpen || detailsOpen) return;
      const preview = buildHoverFromEvent(arg);
      setHover(preview);
      hoverOpenRef.current = true;

      requestAnimationFrame(() => {
        if (!hoverBoxRef.current) return;
        hoverBoxRef.current.style.position = 'fixed';
        hoverBoxRef.current.style.left = '0px';
        hoverBoxRef.current.style.top = '0px';
        hoverBoxRef.current.style.transform = `translate3d(${preview.x}px, ${preview.y}px, 0)`;
      });
    },
    [modalOpen, detailsOpen],
  );

  const onEventMouseLeave = useCallback((_arg: EventMouseLeaveArg) => {
    setHover(null);
    hoverOpenRef.current = false;
    if (hoverBoxRef.current) hoverBoxRef.current.style.transform = `translate3d(-9999px,-9999px,0)`;
  }, []);

  // ✅ drag/resize: só persiste para compromissos
  const patchFromEvent = useCallback(
    async (event: EventApi) => {
      const id = String(event.id || '');
      if (!id) return;

      const ep: any = (event as any).extendedProps ?? {};
      const kind: EntryKind = (ep.kind as EntryKind) || 'appointment';
      if (kind !== 'appointment') {
        // ativação é somente leitura
        if (range) await refresh(range.from, range.to);
        return;
      }

      const entryId = String(ep.entryId ?? '').trim();
      if (!entryId) return;

      const { startAt, endAt, allDay } = startEndFromEvent(event);

      setEntries((prev) =>
        prev.map((e) => {
          if (e.kind === 'appointment' && e.id === entryId) return { ...e, startAt, endAt, allDay };
          return e;
        }),
      );

      try {
        await updateAppointment(entryId, { startAt, endAt, allDay }, tokenRef.current);
      } catch {
        if (range) await refresh(range.from, range.to);
      }
    },
    [range, refresh],
  );

  const onEventDrop = useCallback(async (arg: EventDropArg) => patchFromEvent(arg.event), [patchFromEvent]);
  const onEventResize = useCallback(async (arg: EventResizeDoneArg) => patchFromEvent(arg.event), [patchFromEvent]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setErrorMsg(null);
  }, []);

  const submit = useCallback(async () => {
    const t = tokenRef.current ?? getToken();
    if (!t) return;

    const title = String(form.title || '').trim();
    if (!title) {
      setErrorMsg('Informe um título');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const startIso = isoFromLocalInput(form.startAt);
      const endIso = safeEndIsoFromLocalInput(form.endAt, startIso, Boolean(form.allDay));

      const basePayload: CreateAppointmentInput = {
        title,
        description: form.description?.trim() ? form.description.trim() : null,
        location: form.location?.trim() ? form.location.trim() : null,
        startAt: startIso,
        endAt: endIso,
        allDay: Boolean(form.allDay),
        color: form.color?.trim() ? form.color.trim() : null,
      };

      if (form.id) {
        const updated = await updateAppointment(form.id, basePayload as UpdateAppointmentInput, t);

        setEntries((prev) => prev.map((e) => (e.kind === 'appointment' && e.id === updated.id ? appointmentToEntry(updated) : e)));
        setSelectedKey(`appointment:${updated.id}`);

        setModalOpen(false);
        if (range) await refresh(range.from, range.to);
        return;
      }

      if (!form.recurrenceEnabled) {
        const created = await createAppointment(basePayload, t);
        setEntries((prev) => [appointmentToEntry(created), ...prev]);
        setSelectedKey(`appointment:${created.id}`);

        setModalOpen(false);
        if (range) await refresh(range.from, range.to);
        return;
      }

      const interval = Math.max(1, Math.floor(num(form.recurrenceInterval) || 1));
      const safeCount = clamp(Math.floor(num(form.recurrenceCount) || 1), 1, 365);

      const rule =
        form.recurrenceMode === 'count'
          ? {
              freq: form.recurrenceFreq,
              interval,
              count: safeCount,
              byWeekday: form.recurrenceFreq === 'weekly' ? form.recurrenceWeekdays : undefined,
            }
          : {
              freq: form.recurrenceFreq,
              interval,
              until: isoFromLocalInput(form.recurrenceUntil),
              byWeekday: form.recurrenceFreq === 'weekly' ? form.recurrenceWeekdays : undefined,
            };

      const payloads = buildRecurringAppointments(basePayload, rule).slice(0, 365);
      const tasks = payloads.map((p) => () => createAppointment(p, t));
      const createdMany = await createInChunks(tasks, 8);

      setEntries((prev) => [...createdMany.map(appointmentToEntry), ...prev]);
      if (createdMany[0]?.id) setSelectedKey(`appointment:${createdMany[0].id}`);

      setModalOpen(false);
      if (range) await refresh(range.from, range.to);
    } catch (e: any) {
      setErrorMsg(typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }, [form, range, refresh]);

  const remove = useCallback(async () => {
    const t = tokenRef.current ?? getToken();
    if (!t) return;
    if (!form.id) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      await deleteAppointment(form.id, t);
      setEntries((prev) => prev.filter((e) => !(e.kind === 'appointment' && e.id === form.id)));
      setSelectedKey((cur) => (cur === `appointment:${form.id}` ? null : cur));

      setModalOpen(false);
      if (range) await refresh(range.from, range.to);
    } catch (e: any) {
      setErrorMsg(typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao excluir');
    } finally {
      setSaving(false);
    }
  }, [form.id, range, refresh]);

  const deleteFromDetails = useCallback(async () => {
    const t = tokenRef.current ?? getToken();
    if (!t) return;

    if (!detailsItem) return;
    if (detailsItem.kind !== 'appointment') return;

    setSaving(true);
    setErrorMsg(null);

    try {
      await deleteAppointment(detailsItem.id, t);
      setEntries((prev) => prev.filter((e) => !(e.kind === 'appointment' && e.id === detailsItem.id)));
      setSelectedKey((cur) => (cur === `appointment:${detailsItem.id}` ? null : cur));
      closeDetails();
      if (range) await refresh(range.from, range.to);
    } catch (e: any) {
      setErrorMsg(typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao excluir');
    } finally {
      setSaving(false);
    }
  }, [detailsItem, range, refresh, closeDetails]);

  const navPrev = useCallback(() => runOnApi((api) => api.prev()), [runOnApi]);
  const navNext = useCallback(() => runOnApi((api) => api.next()), [runOnApi]);

  const changeView = useCallback(
    (v: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => {
      runOnApi((api) => {
        api.changeView(v);
        setViewTitle(api.view?.title ? String(api.view.title) : '—');
        try {
          api.updateSize();
        } catch {}
      });
    },
    [runOnApi],
  );

  const doQuickAdd = useCallback(async () => {
    const t = tokenRef.current ?? getToken();
    if (!t) return;

    const title = String(quickTitle || '').trim();
    if (!title) {
      setErrorMsg('Digite um título no “Criar rápido”');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const start = new Date(selectedDay);
      const now = new Date();
      if (sameDay(start, now)) {
        const s = nowPlusMinutes(10);
        start.setHours(s.getHours(), s.getMinutes(), 0, 0);
      } else {
        start.setHours(9, 0, 0, 0);
      }

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + Math.max(15, num(quickMinutes)));

      const payload: CreateAppointmentInput = {
        title,
        description: null,
        location: null,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay: false,
        color: '#6A5CFF',
      };

      const created = await createAppointment(payload, t);
      setEntries((prev) => [appointmentToEntry(created), ...prev]);
      setSelectedKey(`appointment:${created.id}`);
      setQuickTitle('');

      if (range) await refresh(range.from, range.to);

      runOnApi((api) => api.gotoDate(new Date(created.startAt)));
    } catch (e: any) {
      setErrorMsg(typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao criar');
    } finally {
      setSaving(false);
    }
  }, [quickTitle, quickMinutes, selectedDay, range, refresh, runOnApi]);

  const onCalendarRef = useCallback((r: FullCalendar | null) => {
    calendarRef.current = r;
    const inst: any = r as any;
    const api: CalendarApi | null = inst?.getApi?.() ?? null;
    if (api) apiRef.current = api;
    if (api?.view?.title) setViewTitle(String(api.view.title));
  }, []);

  const weekdayLabels: Array<{ d: number; label: string }> = useMemo(
    () => [
      { d: 0, label: 'Dom' },
      { d: 1, label: 'Seg' },
      { d: 2, label: 'Ter' },
      { d: 3, label: 'Qua' },
      { d: 4, label: 'Qui' },
      { d: 5, label: 'Sex' },
      { d: 6, label: 'Sáb' },
    ],
    [],
  );

  const viewTitlePill = (
    <div className="h-10 px-4 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center">
      <span className="text-white/80 text-sm font-semibold truncate max-w-[240px]">{viewTitle}</span>
    </div>
  );

  const calendarNode = useMemo(() => {
    return (
      <div ref={calendarWrapRef} className="w-full">
        <FullCalendar
          ref={onCalendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={false}
          locale={ptBrLocale}
          firstDay={0}
          weekends
          nowIndicator
          selectable
          selectMirror
          editable
          eventResizableFromStart
          height={panorama ? 860 : 720}
          expandRows
          stickyHeaderDates
          handleWindowResize={false}
          eventDisplay="block"
          dayMaxEventRows={4}
          events={events}
          datesSet={onDatesSet}
          select={onSelect}
          dateClick={onDateClick}
          eventClick={onEventClick}
          eventDrop={onEventDrop}
          eventResize={onEventResize}
          eventMouseEnter={onEventMouseEnter}
          eventMouseLeave={onEventMouseLeave}
          eventContent={renderPremiumEventContent}
          slotMinTime="06:00:00"
          slotMaxTime="23:30:00"
        />
      </div>
    );
  }, [
    onCalendarRef,
    panorama,
    events,
    onDatesSet,
    onSelect,
    onDateClick,
    onEventClick,
    onEventDrop,
    onEventResize,
    onEventMouseEnter,
    onEventMouseLeave,
  ]);

  /* ---------------------- render ---------------------- */

  return (
    <div className="ziCalendarApp space-y-4">
      {/* Hover preview */}
      {hover ? (
        <div
          ref={hoverBoxRef}
          className="zi-fcHover"
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            transform: `translate3d(${hover.x}px, ${hover.y}px, 0)`,
            pointerEvents: 'none',
            zIndex: 999999,
          }}
        >
          <div className="zi-fcHover__bar" style={{ background: hover.color }} />
          <div className="zi-fcHover__body">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="zi-fcHover__title">{hover.title}</p>
                <div className="zi-fcHover__meta">
                  <div className="zi-fcHover__row">
                    <span className="zi-fcHover__icon">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <span className="capitalize">{hover.dateLine}</span>
                  </div>
                  <div className="zi-fcHover__row">
                    <span className="zi-fcHover__icon">
                      <Clock className="h-4 w-4" />
                    </span>
                    <span>{hover.timeLine}</span>
                  </div>
                  {hover.location ? (
                    <div className="zi-fcHover__row">
                      <span className="zi-fcHover__icon">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <span className="truncate">{hover.location}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/[0.03] grid place-items-center">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: hover.color }} />
              </div>
            </div>

            {hover.description ? <div className="zi-fcHover__desc">{hover.description}</div> : null}
          </div>
        </div>
      ) : null}

      {/* Top actions bar */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1022]/65 overflow-hidden shadow-[0_30px_140px_rgba(0,0,0,0.65)]">
        <div className="p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.02] grid place-items-center shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
                <Sparkles className="h-5 w-5 text-white/85" />
              </div>
              <div className="min-w-0">
                <div className="text-white/92 font-semibold tracking-tight text-[16px]">
                  Agenda <span className="text-white/60">Premium</span>
                </div>
                <div className="text-white/45 text-xs mt-1">
                  Selecione para criar • clique no evento para abrir detalhes • compromissos e ativações
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => setMode('calendar')}
                className={cx(
                  'h-9 px-3 rounded-2xl text-sm font-medium transition flex items-center gap-2',
                  mode === 'calendar'
                    ? 'bg-white/[0.08] text-white shadow-[0_16px_60px_rgba(0,0,0,0.35)]'
                    : 'text-white/70 hover:text-white',
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Calendário
              </button>
              <button
                type="button"
                onClick={() => setMode('list')}
                className={cx(
                  'h-9 px-3 rounded-2xl text-sm font-medium transition flex items-center gap-2',
                  mode === 'list'
                    ? 'bg-white/[0.08] text-white shadow-[0_16px_60px_rgba(0,0,0,0.35)]'
                    : 'text-white/70 hover:text-white',
                )}
              >
                <ListIcon className="h-4 w-4" />
                Lista
              </button>
            </div>

            {mode === 'calendar' ? viewTitlePill : null}

            <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => {
                  setPanorama((v) => {
                    const next = !v;
                    if (next) {
                      setMode('calendar');
                      setLeftOpen(false);
                      setRightOpen(false);
                    } else {
                      setLeftOpen(true);
                      setRightOpen(false);
                    }
                    return next;
                  });
                }}
                className={cx(
                  'h-9 px-3 rounded-2xl text-sm font-medium transition flex items-center gap-2',
                  panorama
                    ? 'bg-white/[0.08] text-white shadow-[0_16px_60px_rgba(0,0,0,0.35)]'
                    : 'text-white/70 hover:text-white',
                )}
                title="Modo panorâmico"
              >
                {panorama ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                Panorama
              </button>

              <button
                type="button"
                onClick={() => {
                  setPanorama(false);
                  setLeftOpen((v) => !v);
                }}
                className={cx('h-9 px-3 rounded-2xl text-sm font-medium transition flex items-center gap-2', 'text-white/70 hover:text-white')}
                title={leftOpen ? 'Fechar painel esquerdo' : 'Abrir painel esquerdo'}
              >
                {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPanorama(false);
                  setRightOpen((v) => !v);
                }}
                className={cx('h-9 px-3 rounded-2xl text-sm font-medium transition flex items-center gap-2', 'text-white/70 hover:text-white')}
                title={rightOpen ? 'Fechar painel direito' : 'Abrir painel direito'}
              >
                {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={navPrev}
              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center"
              title="Anterior"
            >
              <ChevronLeft className="h-5 w-5 text-white/85" />
            </button>

            <button
              type="button"
              onClick={navNext}
              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center"
              title="Próximo"
            >
              <ChevronRight className="h-5 w-5 text-white/85" />
            </button>

            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeView('dayGridMonth')}
                className="h-10 px-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm font-medium"
              >
                Mês
              </button>
              <button
                type="button"
                onClick={() => changeView('timeGridWeek')}
                className="h-10 px-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm font-medium"
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => changeView('timeGridDay')}
                className="h-10 px-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm font-medium"
              >
                Dia
              </button>
            </div>

            <button
              type="button"
              onClick={() => openCreateModal(nowPlusMinutes(10), new Date(nowPlusMinutes(70).getTime()), false)}
              className={cx(
                'h-10 px-4 rounded-2xl border border-white/10',
                'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                'shadow-[0_22px_90px_rgba(62,120,255,0.22)] hover:opacity-95 transition',
                'text-sm font-semibold flex items-center gap-2',
              )}
            >
              <Plus className="h-4 w-4" />
              Novo
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div className="px-5 pb-5">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 relative">
                <Search className="h-4 w-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar (título, local, descrição)…"
                  className={cx(
                    'h-11 w-full pl-9 pr-3 rounded-2xl border border-white/10 bg-white/[0.03]',
                    'text-white/85 placeholder:text-white/30',
                    'focus:border-white/20 outline-none',
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyAllDay((v) => !v)}
                  className={cx(
                    'h-11 px-4 rounded-2xl border border-white/10 transition text-sm font-medium flex items-center gap-2',
                    onlyAllDay ? 'bg-[#6A5CFF]/18 border-[#6A5CFF]/35 text-white' : 'bg-white/[0.02] hover:bg-white/[0.06] text-white/75 hover:text-white',
                  )}
                >
                  <Filter className="h-4 w-4" />
                  Dia todo
                  {onlyAllDay ? <Check className="h-4 w-4" /> : null}
                </button>

                <button
                  type="button"
                  onClick={() => setOnlyWithLocation((v) => !v)}
                  className={cx(
                    'h-11 px-4 rounded-2xl border border-white/10 transition text-sm font-medium flex items-center gap-2',
                    onlyWithLocation ? 'bg-[#3E78FF]/16 border-[#3E78FF]/32 text-white' : 'bg-white/[0.02] hover:bg-white/[0.06] text-white/75 hover:text-white',
                  )}
                >
                  <MapPin className="h-4 w-4" />
                  Com local
                  {onlyWithLocation ? <Check className="h-4 w-4" /> : null}
                </button>

                {/* ✅ toggle ativações */}
                <button
                  type="button"
                  onClick={() => setShowActivations((v) => !v)}
                  className={cx(
                    'h-11 px-4 rounded-2xl border border-white/10 transition text-sm font-medium flex items-center gap-2',
                    showActivations ? 'bg-[#22C55E]/16 border-[#22C55E]/32 text-white' : 'bg-white/[0.02] hover:bg-white/[0.06] text-white/75 hover:text-white',
                  )}
                  title="Mostrar/ocultar ativações"
                >
                  <Zap className="h-4 w-4" />
                  Ativações
                  {showActivations ? <Check className="h-4 w-4" /> : null}
                </button>

                <button
                  type="button"
                  onClick={() => setSortAsc((v) => !v)}
                  className={cx(
                    'h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] transition',
                    'text-white/75 hover:text-white text-sm font-medium',
                  )}
                >
                  {sortAsc ? 'Mais cedo → mais tarde' : 'Mais tarde → mais cedo'}
                </button>
              </div>
            </div>

            {/* Stats (sem escrever "Hoje") */}
            <div className="flex flex-wrap items-center gap-2 justify-start xl:justify-end">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2">
                <div className="text-white/45 text-[11px]">No dia</div>
                <div className="text-white/92 font-semibold">{stats.today}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2">
                <div className="text-white/45 text-[11px]">Próx. 7 dias</div>
                <div className="text-white/92 font-semibold">{stats.next7}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2">
                <div className="text-white/45 text-[11px]">Próx. 30 dias</div>
                <div className="text-white/92 font-semibold">{stats.next30}</div>
              </div>
            </div>
          </div>

          {loading ? <div className="mt-3 text-white/55 text-sm">Carregando…</div> : null}
          {errorMsg ? (
            <div className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-red-200 text-sm">{errorMsg}</div>
          ) : null}
        </div>
      </div>

      {/* Main content */}
      <div
        className={cx(
          'grid grid-cols-1 gap-4',
          panorama
            ? '2xl:grid-cols-[1fr]'
            : leftOpen && rightOpen
              ? '2xl:grid-cols-[260px_1fr_320px]'
              : leftOpen && !rightOpen
                ? '2xl:grid-cols-[260px_1fr]'
                : !leftOpen && rightOpen
                  ? '2xl:grid-cols-[1fr_320px]'
                  : '2xl:grid-cols-[1fr]',
        )}
      >
        {/* Left */}
        {!panorama && leftOpen ? (
          <div className="space-y-4">
            {/* Quick add */}
            <div className="rounded-2xl border border-white/10 bg-[#0B1022]/60 overflow-hidden shadow-[0_28px_120px_rgba(0,0,0,0.60)]">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-white/92 font-semibold">Criar rápido</div>
                  <div className="text-white/45 text-xs mt-1">Cria no dia selecionado ({fmtDateShort(selectedDay)})</div>
                </div>
                <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] grid place-items-center">
                  <Wand2 className="h-5 w-5 text-white/85" />
                </div>
              </div>

              <div className="p-5 space-y-3">
                <input
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Título…"
                  className={cx(
                    'h-11 w-full px-4 rounded-2xl border border-white/10 bg-white/[0.03]',
                    'text-white/85 placeholder:text-white/30',
                    'focus:border-white/20 outline-none',
                  )}
                />

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="text-white/45 text-xs mb-2">Duração (min)</div>
                    <input
                      type="number"
                      min={15}
                      step={15}
                      value={quickMinutes}
                      onChange={(e) => setQuickMinutes(Number(e.target.value))}
                      className={cx(
                        'h-11 w-full px-4 rounded-2xl border border-white/10 bg-white/[0.03]',
                        'text-white/85',
                        'focus:border-white/20 outline-none',
                      )}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={doQuickAdd}
                    disabled={saving}
                    className={cx(
                      'h-11 px-4 rounded-2xl border border-white/10',
                      'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                      'shadow-[0_22px_90px_rgba(62,120,255,0.22)] hover:opacity-95 transition',
                      'text-sm font-semibold flex items-center gap-2 mt-[22px]',
                      saving && 'opacity-60 pointer-events-none',
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    Criar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => openCreateModal(nowPlusMinutes(10), new Date(nowPlusMinutes(70).getTime()), false)}
                  className={cx(
                    'h-11 w-full px-4 rounded-2xl border border-white/10',
                    'bg-white/[0.02] hover:bg-white/[0.06] transition',
                    'text-white/85 text-sm font-semibold flex items-center justify-between',
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Criar com detalhes
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/55" />
                </button>
              </div>
            </div>

            {/* Upcoming */}
            <div className="rounded-2xl border border-white/10 bg-[#0B1022]/60 overflow-hidden shadow-[0_28px_120px_rgba(0,0,0,0.60)]">
              <div className="px-5 py-4 border-b border-white/10">
                <div className="text-white/92 font-semibold">Próximos</div>
                <div className="text-white/45 text-xs mt-1">Inclui compromissos e ativações</div>
              </div>

              <div className="p-5 space-y-2">
                {upcoming.length ? (
                  upcoming.map((e) => {
                    const s = parseEntryStartDate(e);
                    const end = parseEntryEndDate(e);
                    const color = safeHex(pickColorOrDefault(e.color ?? null));
                    const key = `${e.kind}:${e.id}`;
                    const isSel = selectedKey === key;

                    const timeLabel = e.allDay ? 'Dia todo' : `${fmtTime(s)}${end ? ` • ${fmtTime(end)}` : ''}`;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedKey(key);
                          setSelectedDay(s);
                          runOnApi((api) => api.gotoDate(s));
                        }}
                        className={cx(
                          'w-full text-left rounded-2xl border px-4 py-3 transition',
                          isSel ? 'border-white/18 bg-white/[0.06]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                              <div className="text-white/90 font-semibold truncate">{e.title}</div>
                              {e.kind === 'activation' ? (
                                <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-white/60 inline-flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  Ativação
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <TimePill color={color}>{timeLabel}</TimePill>
                              <span className="text-white/35 text-xs">{s.toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>

                          <span className="text-white/35 text-xs whitespace-nowrap">abrir</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-white/55 text-sm">Sem itens próximos.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Center */}
        <div className="rounded-2xl border border-white/10 bg-[#0B1022]/60 overflow-hidden shadow-[0_34px_140px_rgba(0,0,0,0.70)]">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-white/92 font-semibold">{mode === 'calendar' ? 'Calendário' : 'Lista (agrupada por dia)'}</div>
              <div className="text-white/45 text-xs mt-1 truncate">
                {mode === 'calendar'
                  ? `${viewTitle} • ${panorama ? 'Panorama ativo' : 'Normal'} • compromissos + ativações`
                  : `Mostrando ${filteredEntries.length} item(ns)`}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setOnlyAllDay(false);
                  setOnlyWithLocation(false);
                  setShowActivations(true);
                }}
                className={cx(
                  'h-10 px-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] transition',
                  'text-white/75 hover:text-white text-sm font-medium',
                )}
              >
                Limpar
              </button>

              {selected && selected.kind === 'appointment' ? (
                <button
                  type="button"
                  onClick={() => openEditModal(selected.raw as Appointment)}
                  className={cx(
                    'h-10 px-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] transition',
                    'text-white/88 text-sm font-semibold',
                  )}
                >
                  Editar
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-4">
            {mode === 'calendar' ? (
              calendarNode
            ) : (
              <ListView
                groupedList={groupedList}
                nowTick={nowTick}
                selectedKey={selectedKey}
                setSelectedKey={setSelectedKey}
                setSelectedDay={setSelectedDay}
              />
            )}
          </div>
        </div>

        {/* Right (opcional) */}
        {!panorama && rightOpen ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#0B1022]/60 overflow-hidden shadow-[0_28px_120px_rgba(0,0,0,0.60)]">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-white/92 font-semibold">Agenda do dia</div>
                  <div className="text-white/45 text-xs mt-1 capitalize truncate">{fmtDateLong(selectedDay)}</div>
                </div>
                <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] grid place-items-center">
                  <CalendarDays className="h-5 w-5 text-white/85" />
                </div>
              </div>

              <div className="p-5 space-y-2">
                {dayItems.length ? (
                  dayItems.map((e) => {
                    const s = parseEntryStartDate(e);
                    const end = parseEntryEndDate(e);
                    const color = safeHex(pickColorOrDefault(e.color ?? null));
                    const key = `${e.kind}:${e.id}`;
                    const isSel = selectedKey === key;
                    const past = isEntryPast(e, nowTick);

                    const timeLabel = e.allDay ? 'Dia todo' : `${fmtTime(s)}${end ? ` • ${fmtTime(end)}` : ''}`;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={cx(
                          'w-full text-left rounded-2xl border px-4 py-3 transition',
                          isSel ? 'border-white/20 bg-white/[0.06]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]',
                          past && 'opacity-60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full mt-1" style={{ background: color }} />
                              <div className={cx('text-white/90 font-semibold truncate', past && 'line-through')}>{e.title}</div>
                              {e.kind === 'activation' ? (
                                <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-white/60 inline-flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  Ativação
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <TimePill color={color}>{timeLabel}</TimePill>
                            </div>
                          </div>

                          <span className="text-white/35 text-xs whitespace-nowrap">{isSel ? 'Focado' : ' '}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-white/55 text-sm">Nenhum item nesse dia.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ✅ Modal de detalhes ao clicar no evento */}
      {detailsOpen ? (
        <DetailsModal
          detailsItem={detailsItem}
          nowTick={nowTick}
          closeDetails={closeDetails}
          openEditModal={openEditModal}
          deleteFromDetails={deleteFromDetails}
          saving={saving}
        />
      ) : null}

      {/* Modal create/edit (compromissos) */}
      {modalOpen ? (
        <EditModal
          form={form}
          setForm={setForm}
          weekdayLabels={weekdayLabels}
          closeModal={closeModal}
          submit={submit}
          remove={remove}
          saving={saving}
          errorMsg={errorMsg}
        />
      ) : null}
    </div>
  );
}

/* ---------------------- subcomponents ---------------------- */

function formatBRL(n: number) {
  const v = Number(n || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ListView({
  groupedList,
  nowTick,
  selectedKey,
  setSelectedKey,
  setSelectedDay,
}: {
  groupedList: Array<{ key: string; date: Date; items: Entry[] }>;
  nowTick: number;
  selectedKey: string | null;
  setSelectedKey: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedDay: React.Dispatch<React.SetStateAction<Date>>;
}) {
  return (
    <div className="space-y-3">
      {groupedList.length ? (
        groupedList.map((g) => (
          <div key={g.key} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-white/90 font-semibold capitalize">{fmtDateLong(g.date)}</div>
              <div className="text-white/45 text-xs">{g.items.length} item(ns)</div>
            </div>

            <div className="p-3 space-y-2">
              {g.items.map((e) => {
                const s = parseEntryStartDate(e);
                const end = parseEntryEndDate(e);
                const color = safeHex(pickColorOrDefault(e.color ?? null));
                const key = `${e.kind}:${e.id}`;
                const isSel = selectedKey === key;
                const past = isEntryPast(e, nowTick);

                const timeLabel = e.allDay ? 'Dia todo' : `${fmtTime(s)}${end ? ` • ${fmtTime(end)}` : ''}`;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedKey(key);
                      setSelectedDay(s);
                    }}
                    className={cx(
                      'w-full text-left rounded-2xl border px-4 py-3 transition',
                      isSel ? 'border-white/20 bg-white/[0.06]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]',
                      past && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full mt-1" style={{ background: color }} />
                          <div className={cx('text-white/92 font-semibold truncate', past && 'line-through')}>{e.title}</div>

                          {e.kind === 'activation' ? (
                            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-white/60 inline-flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              Ativação
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <TimePill color={color}>{timeLabel}</TimePill>
                        </div>

                        {e.description ? <div className="mt-2 text-white/60 text-sm line-clamp-2">{e.description}</div> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-white/55 text-sm">
          Nenhum item nesse intervalo (ou filtros muito restritos).
        </div>
      )}
    </div>
  );
}

function DetailsModal({
  detailsItem,
  nowTick,
  closeDetails,
  openEditModal,
  deleteFromDetails,
  saving,
}: {
  detailsItem: Entry | null;
  nowTick: number;
  closeDetails: () => void;
  openEditModal: (a: Appointment) => void;
  deleteFromDetails: () => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[99999]">
      <div
        className="absolute inset-0 bg-black/70"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeDetails();
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[720px] max-w-[96vw] rounded-2xl border border-white/10 overflow-hidden bg-[#0B1022]/95 shadow-[0_50px_190px_rgba(0,0,0,0.80)]">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-white/92 font-semibold leading-tight">
                {detailsItem?.kind === 'activation' ? 'Detalhes da ativação' : 'Detalhes do compromisso'}
              </div>
              <div className="text-white/45 text-xs mt-0.5">{detailsItem?.kind === 'activation' ? 'Somente leitura' : 'Editar ou excluir por aqui'}</div>
            </div>

            <button
              type="button"
              onClick={closeDetails}
              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center"
            >
              <X className="h-5 w-5 text-white/80" />
            </button>
          </div>

          <div className="p-5">
            {detailsItem ? (
              (() => {
                const s = parseEntryStartDate(detailsItem);
                const e = parseEntryEndDate(detailsItem);
                const color = safeHex(pickColorOrDefault(detailsItem.color ?? null));
                const textColor = pickTextColorForBg(color);
                const past = isEntryPast(detailsItem, nowTick);
                const timeLabel = detailsItem.allDay ? 'Dia todo' : `${fmtTime(s)}${e ? ` • ${fmtTime(e)}` : ''}`;

                const raw = detailsItem.raw || {};
                const ftd = num(raw?.ftd);
                const deposit = num(raw?.deposit);
                const rev = num(raw?.rev);

                return (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full" style={{ background: color }} />
                          <div className={cx('text-white/95 font-semibold text-lg leading-snug truncate', past && 'line-through')}>{detailsItem.title}</div>

                          {detailsItem.kind === 'activation' ? (
                            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-white/60 inline-flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              Ativação
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                          <div className="flex items-center gap-2 text-white/75 text-sm">
                            <CalendarDays className="h-4 w-4 text-white/45" />
                            <span className="capitalize">{fmtDateLong(s)}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <TimePill color={color}>{timeLabel}</TimePill>
                          </div>

                          <div className="pt-1">
                            <span className="text-white/45 text-xs">Etiqueta</span>
                            <div
                              className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/10"
                              style={{ background: color }}
                            >
                              <span className="text-sm font-extrabold tracking-wide" style={{ color: textColor }}>
                                {color.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {detailsItem.description ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-white/70 text-sm whitespace-pre-wrap">
                            {detailsItem.description}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-white/50 text-sm">Sem descrição.</div>
                        )}

                        {detailsItem.kind === 'activation' ? (
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                              <div className="text-white/45 text-xs">FTD</div>
                              <div className="text-white/92 font-semibold mt-1">{ftd}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                              <div className="text-white/45 text-xs">Depósito</div>
                              <div className="text-white/92 font-semibold mt-1">{formatBRL(deposit)}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                              <div className="text-white/45 text-xs">REV</div>
                              <div className={cx('font-semibold mt-1', rev > 0 ? 'text-emerald-200' : rev < 0 ? 'text-red-200' : 'text-white/92')}>
                                {formatBRL(rev)}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                      {detailsItem.kind === 'appointment' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              closeDetails();
                              openEditModal(detailsItem.raw as Appointment);
                            }}
                            className={cx(
                              'h-11 px-4 rounded-2xl border border-white/10',
                              'bg-white/[0.02] hover:bg-white/[0.06] transition',
                              'text-white/90 text-sm font-semibold flex items-center gap-2',
                              saving && 'opacity-60 pointer-events-none',
                            )}
                            disabled={saving}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={deleteFromDetails}
                            className={cx(
                              'h-11 px-4 rounded-2xl border border-red-500/25',
                              'bg-red-500/10 hover:bg-red-500/16 transition',
                              'text-red-100 text-sm font-semibold flex items-center gap-2',
                              saving && 'opacity-60 pointer-events-none',
                            )}
                            disabled={saving}
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={closeDetails}
                          className={cx(
                            'h-11 px-4 rounded-2xl border border-white/10',
                            'bg-white/[0.02] hover:bg-white/[0.06] transition',
                            'text-white/85 text-sm font-semibold',
                          )}
                        >
                          Fechar
                        </button>
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-white/55 text-sm">Não foi possível carregar esse item.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  form,
  setForm,
  weekdayLabels,
  closeModal,
  submit,
  remove,
  saving,
  errorMsg,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  weekdayLabels: Array<{ d: number; label: string }>;
  closeModal: () => void;
  submit: () => Promise<void>;
  remove: () => Promise<void>;
  saving: boolean;
  errorMsg: string | null;
}) {
  return (
    <div className="fixed inset-0 z-[99999]">
      <div
        className="absolute inset-0 bg-black/70"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[760px] max-w-[96vw] rounded-2xl border border-white/10 overflow-hidden bg-[#0B1022]/95 shadow-[0_50px_190px_rgba(0,0,0,0.80)]">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-white/92 font-semibold leading-tight">{form.id ? 'Editar compromisso' : 'Novo compromisso'}</div>
              <div className="text-white/45 text-xs mt-0.5">Campos completos • presets • validação • recorrência</div>
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center"
            >
              <X className="h-5 w-5 text-white/80" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {errorMsg ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm">{errorMsg}</div>
            ) : null}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-white/70 text-xs font-semibold">Título</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Ex: Reunião / Conteúdo / Call"
                  className={cx(
                    'h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.03]',
                    'text-white/85 placeholder:text-white/30',
                    'focus:border-white/20 outline-none',
                  )}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-white/70 text-xs font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-white/55" />
                  Local (opcional)
                </label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
                  placeholder="Ex: Google Meet / Escritório"
                  className={cx(
                    'h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.03]',
                    'text-white/85 placeholder:text-white/30',
                    'focus:border-white/20 outline-none',
                  )}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-white/70 text-xs font-semibold">Descrição (opcional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                placeholder="Notas, objetivo, link, checklist…"
                className={cx(
                  'min-h-[110px] px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.03]',
                  'text-white/85 placeholder:text-white/30',
                  'focus:border-white/20 outline-none',
                )}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-white/70 text-xs font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-white/55" />
                  Início
                </label>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm((s) => ({ ...s, startAt: e.target.value }))}
                  className={cx('h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.03]', 'text-white/85', 'focus:border-white/20 outline-none')}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-white/70 text-xs font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-white/55" />
                  Fim
                </label>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm((s) => ({ ...s, endAt: e.target.value }))}
                  disabled={form.allDay}
                  className={cx(
                    'h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.03]',
                    'text-white/85',
                    'focus:border-white/20 outline-none',
                    form.allDay && 'opacity-50 cursor-not-allowed',
                  )}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 items-end">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white/85 text-sm font-semibold">Dia todo</div>
                  <div className="text-white/45 text-xs mt-0.5">Sem horário específico</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, allDay: !s.allDay }))}
                  className={cx(
                    'h-9 w-16 rounded-full border transition relative',
                    form.allDay ? 'border-[#6A5CFF]/40 bg-[#6A5CFF]/25' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                  )}
                  aria-label="Alternar dia todo"
                >
                  <span className={cx('absolute top-1/2 -translate-y-1/2 h-7 w-7 rounded-full transition', form.allDay ? 'right-1 bg-[#6A5CFF]' : 'left-1 bg-white/25')} />
                </button>
              </div>

              <div className="grid gap-2">
                <label className="text-white/70 text-xs font-semibold">Cor</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((c) => {
                    const active = form.color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm((s) => ({ ...s, color: c }))}
                        className={cx(
                          'h-10 w-10 rounded-2xl border transition grid place-items-center',
                          active ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15',
                        )}
                        title={c}
                      >
                        <span className="h-5 w-5 rounded-full" style={{ background: c }} />
                      </button>
                    );
                  })}

                  <div className="ml-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))}
                      className="h-10 w-14 rounded-2xl border border-white/10 bg-white/[0.03]"
                      title="Cor custom"
                    />
                    <span className="text-white/45 text-xs">custom</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RECORRÊNCIA (apenas criação) */}
            {!form.id ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-white/55" />
                    <div>
                      <div className="text-white/85 text-sm font-semibold">Recorrência</div>
                      <div className="text-white/45 text-xs">Cria várias ocorrências automaticamente</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, recurrenceEnabled: !s.recurrenceEnabled }))}
                    className={cx(
                      'h-9 w-16 rounded-full border transition relative',
                      form.recurrenceEnabled ? 'border-[#6A5CFF]/40 bg-[#6A5CFF]/25' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                    )}
                    aria-label="Alternar recorrência"
                  >
                    <span
                      className={cx(
                        'absolute top-1/2 -translate-y-1/2 h-7 w-7 rounded-full transition',
                        form.recurrenceEnabled ? 'right-1 bg-[#6A5CFF]' : 'left-1 bg-white/25',
                      )}
                    />
                  </button>
                </div>

                {form.recurrenceEnabled ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label className="text-white/70 text-xs font-semibold">Frequência</label>
                      <select
                        value={form.recurrenceFreq}
                        onChange={(e) => setForm((s) => ({ ...s, recurrenceFreq: e.target.value as RecurrenceFreq }))}
                        className={cx('h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.03]', 'text-white/85', 'focus:border-white/20 outline-none')}
                      >
                        <option value="daily">Diária</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-white/70 text-xs font-semibold">Intervalo</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={form.recurrenceInterval}
                        onChange={(e) => setForm((s) => ({ ...s, recurrenceInterval: Number(e.target.value) }))}
                        className={cx('h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.03]', 'text-white/85', 'focus:border-white/20 outline-none')}
                      />
                    </div>

                    {form.recurrenceFreq === 'weekly' ? (
                      <div className="md:col-span-2 grid gap-2">
                        <label className="text-white/70 text-xs font-semibold">Dias da semana</label>
                        <div className="flex flex-wrap gap-2">
                          {weekdayLabels.map((w) => {
                            const active = form.recurrenceWeekdays.includes(w.d);
                            return (
                              <button
                                key={w.d}
                                type="button"
                                onClick={() =>
                                  setForm((s) => {
                                    const set = new Set(s.recurrenceWeekdays);
                                    if (set.has(w.d)) set.delete(w.d);
                                    else set.add(w.d);
                                    const arr = Array.from(set).sort((a, b) => a - b);
                                    return { ...s, recurrenceWeekdays: arr.length ? arr : [1] };
                                  })
                                }
                                className={cx(
                                  'h-10 px-3 rounded-2xl border text-sm font-semibold transition',
                                  active ? 'border-[#6A5CFF]/40 bg-[#6A5CFF]/20 text-white' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-white/75 hover:text-white',
                                )}
                              >
                                {w.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-white/40 text-xs">Dica: limite de segurança: máximo 365 ocorrências.</div>
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <label className="text-white/70 text-xs font-semibold">Parar por</label>
                      <select
                        value={form.recurrenceMode}
                        onChange={(e) => setForm((s) => ({ ...s, recurrenceMode: e.target.value as any }))}
                        className={cx('h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.03]', 'text-white/85', 'focus:border-white/20 outline-none')}
                      >
                        <option value="count">Quantidade</option>
                        <option value="until">Data</option>
                      </select>
                    </div>

                    {form.recurrenceMode === 'count' ? (
                      <div className="grid gap-2">
                        <label className="text-white/70 text-xs font-semibold">Ocorrências</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={form.recurrenceCount}
                          onChange={(e) => setForm((s) => ({ ...s, recurrenceCount: Number(e.target.value) }))}
                          className={cx('h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.03]', 'text-white/85', 'focus:border-white/20 outline-none')}
                        />
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <label className="text-white/70 text-xs font-semibold">Até</label>
                        <input
                          type="datetime-local"
                          value={form.recurrenceUntil}
                          onChange={(e) => setForm((s) => ({ ...s, recurrenceUntil: e.target.value }))}
                          className={cx('h-11 px-4 rounded-2xl border border-white/10 bg-white/[0.03]', 'text-white/85', 'focus:border-white/20 outline-none')}
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              {form.id ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={saving}
                  className={cx(
                    'h-11 px-4 rounded-2xl border border-red-500/25',
                    'bg-red-500/10 hover:bg-red-500/16 transition',
                    'text-red-100 text-sm font-semibold flex items-center gap-2',
                    saving && 'opacity-60 pointer-events-none',
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              ) : null}

              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className={cx(
                  'h-11 px-6 rounded-2xl border border-white/10',
                  'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                  'shadow-[0_22px_90px_rgba(62,120,255,0.22)] hover:opacity-95 transition',
                  'text-sm font-semibold',
                  saving && 'opacity-60 pointer-events-none',
                )}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>

            <div className="text-white/35 text-xs">
              Dica: você pode <span className="text-white/55 font-semibold">arrastar</span> e{' '}
              <span className="text-white/55 font-semibold">redimensionar</span> compromissos. (Ativações ficam somente leitura.)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
