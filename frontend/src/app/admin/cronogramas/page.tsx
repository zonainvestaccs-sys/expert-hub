'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Sensitive } from '@/components/SensitiveMode';

type Expert = {
  id: string;
  email: string;
  role: 'ADMIN' | 'EXPERT';
  isActive: boolean;
  createdAt: string;
  photoUrl?: string | null;
};

type AdminAppointment = {
  id: string;
  expertId: string;
  expertEmail: string;
  expertPhotoUrl: string | null;
  expertIsActive: boolean;

  title: string;
  description: string | null;
  location: string | null;

  startAt: string; // Date ISO
  endAt: string | null; // Date ISO
  allDay: boolean;
  color: string | null;

  seriesId: string | null;
  occurrenceIndex: number | null;
  isException: boolean;
};

type RecurrenceUi = {
  enabled: boolean;
  freq: 'daily' | 'weekly' | 'monthly';
  interval: number;
  mode: 'count' | 'until';
  count: number;
  until: string; // YYYY-MM-DD
  weekdays: number[]; // 0..6 (Dom..Sab)
};

/**
 * ✅ Ativações para o calendário do Admin
 * Esperado (exemplos):
 * - { id, date:'YYYY-MM-DD', activation, description, experts:[{id,email,photoUrl,isActive}] }
 */
type AdminActivation = {
  id: string;
  date: string; // YYYY-MM-DD
  activation: string;
  description: string | null;
  color: string | null;
  experts: Array<{
    id: string;
    email: string;
    photoUrl: string | null;
    isActive: boolean;
  }>;
  _raw: any;
};

type CalendarItem =
  | { kind: 'appointment'; dayKey: string; startMs: number; appointment: AdminAppointment }
  | { kind: 'activation'; dayKey: string; startMs: number; activation: AdminActivation };

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

/* -------------------- date helpers -------------------- */

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfGridMonth(d: Date) {
  // grid começa no domingo
  const first = startOfMonth(d);
  const dow = first.getDay(); // 0 domingo
  return addDays(first, -dow);
}

function endOfGridMonth(d: Date) {
  const last = endOfMonth(d);
  const dow = last.getDay();
  return addDays(last, 6 - dow);
}

function yyyyMmDd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function monthTitle(d: Date) {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function initials(email: string) {
  const s = (email || '').split('@')[0] || 'EX';
  const parts = s.split(/[.\-_]/).filter(Boolean);
  const a = (parts[0] || 'E')[0];
  const b = (parts[1] || parts[0] || 'X')[0];
  return (a + b).toUpperCase();
}

/* -------------------- color helpers (contraste premium) -------------------- */

function safeHex(v: string | null | undefined) {
  const s = String(v ?? '').trim();
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* -------------------- media helpers -------------------- */

// ✅ Resolve foto quando vier relativa (ex: "/uploads/...")
function resolvePhotoUrl(photoUrl: string | null | undefined) {
  const raw = typeof photoUrl === 'string' ? photoUrl.trim() : '';
  if (!raw) return null;

  // já é absoluta
  if (/^https?:\/\//i.test(raw)) return raw;

  // tenta prefixar com NEXT_PUBLIC_API_URL
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!base) return raw; // fallback
  if (raw.startsWith('/')) return `${base}${raw}`;
  return `${base}/${raw}`;
}

function Avatar({ photoUrl, email }: { photoUrl?: string | null; email: string }) {
  const safeUrl = resolvePhotoUrl(photoUrl ?? null);

  if (safeUrl) {
    return (
      <img
        src={safeUrl}
        alt={email}
        className="w-6 h-6 rounded-full object-cover border border-white/15"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="w-6 h-6 rounded-full border border-white/15 bg-white/[0.06] grid place-items-center text-[10px] text-white/80">
      {initials(email)}
    </div>
  );
}

function AvatarStack({
  people,
  max = 3,
}: {
  people: Array<{ email: string; photoUrl: string | null }>;
  max?: number;
}) {
  const shown = (people || []).slice(0, max);
  const more = Math.max(0, (people || []).length - shown.length);

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p, idx) => (
        <div key={`${p.email}-${idx}`} className="relative">
          <Avatar photoUrl={p.photoUrl} email={p.email} />
        </div>
      ))}
      {more > 0 ? (
        <div className="w-6 h-6 rounded-full border border-white/15 bg-white/[0.06] grid place-items-center text-[10px] text-white/80">
          +{more}
        </div>
      ) : null}
    </div>
  );
}

/** Popover simples */
function Popover({
  open,
  onClose,
  anchorRef,
  children,
  widthClass = 'w-[420px]',
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement;
      const anchor = anchorRef.current as HTMLElement | null;
      if (!anchor) return;
      const pop = document.querySelector('[data-popover-root="1"]') as HTMLElement | null;
      if (!pop) return;

      if (!anchor.contains(el) && !pop.contains(el)) onClose();
    }

    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      data-popover-root="1"
      className={cx(
        'absolute z-[60] mt-2',
        widthClass,
        'rounded-2xl border border-white/10',
        'bg-[#0B1022]/95 backdrop-blur-xl',
        'shadow-[0_30px_120px_rgba(0,0,0,0.65)] overflow-hidden',
      )}
      style={{ right: 0 }}
    >
      {children}
    </div>
  );
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-[860px] rounded-2xl border border-white/10 bg-[#0B1022]/96 shadow-[0_35px_160px_rgba(0,0,0,0.7)] overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

function toLocalDateInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalTimeInput(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildIsoFromLocal(dateYmd: string, timeHm: string) {
  const isoLike = `${dateYmd}T${timeHm}:00`;
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function endOfDayLocalFromIso(startIso: string) {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function isFinishedEvent(it: AdminAppointment) {
  const now = Date.now();

  if (it.allDay) {
    const eod = endOfDayLocalFromIso(it.startAt);
    if (!eod) return false;
    return eod.getTime() < now;
  }

  if (it.endAt) {
    const end = new Date(it.endAt);
    if (!Number.isNaN(end.getTime())) return end.getTime() < now;
  }

  const start = new Date(it.startAt);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() < now;
}

/* -------------------- normalizers -------------------- */

function strLoose(v: any) {
  return String(v ?? '').trim();
}

function normalizeAppointments(raw: any[], expertsList: Expert[]) {
  const byId = new Map<string, Expert>();
  const byEmail = new Map<string, Expert>();
  for (const ex of expertsList || []) {
    if (ex?.id) byId.set(ex.id, ex);
    if (ex?.email) byEmail.set(ex.email.toLowerCase(), ex);
  }

  const normalized: AdminAppointment[] = (raw || []).map((it: any) => {
    const expertFromNested = it?.expert ?? it?.Expert ?? null;

    const id = String(it?.id ?? '');
    const expertIdValue = String(it?.expertId ?? expertFromNested?.id ?? '');
    const emailValue = String(it?.expertEmail ?? expertFromNested?.email ?? '');
    const activeValue = Boolean(it?.expertIsActive ?? expertFromNested?.isActive ?? true);

    const fromMap =
      (expertIdValue && byId.get(expertIdValue)) ||
      (emailValue && byEmail.get(emailValue.toLowerCase())) ||
      null;

    const photo =
      (typeof it?.expertPhotoUrl === 'string' ? it.expertPhotoUrl : null) ??
      (typeof expertFromNested?.photoUrl === 'string' ? expertFromNested.photoUrl : null) ??
      (typeof fromMap?.photoUrl === 'string' ? fromMap.photoUrl : null) ??
      null;

    const safePhoto = typeof photo === 'string' && photo.trim().length > 0 ? photo.trim() : null;

    return {
      id,
      expertId: expertIdValue,
      expertEmail: emailValue || (fromMap?.email ?? ''),
      expertPhotoUrl: safePhoto,
      expertIsActive: activeValue,

      title: it?.title ?? '',
      description: it?.description ?? null,
      location: it?.location ?? null,

      startAt: it?.startAt,
      endAt: it?.endAt ?? null,
      allDay: Boolean(it?.allDay),
      color: it?.color ?? null,

      seriesId: it?.seriesId ?? null,
      occurrenceIndex: it?.occurrenceIndex ?? null,
      isException: Boolean(it?.isException),
    } as AdminAppointment;
  });

  return normalized.filter((x) => x?.id && x?.startAt);
}

function normalizeActivations(raw: any[], expertsList: Expert[]): AdminActivation[] {
  const byId = new Map<string, Expert>();
  const byEmail = new Map<string, Expert>();
  for (const ex of expertsList || []) {
    if (ex?.id) byId.set(ex.id, ex);
    if (ex?.email) byEmail.set(ex.email.toLowerCase(), ex);
  }

  const arr = Array.isArray(raw) ? raw : [];
  const out: AdminActivation[] = [];

  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];

    const id = strLoose(it?.id) || `act-${i + 1}`;
    const date = strLoose(it?.date) || strLoose(it?.dateIso) || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const activation = strLoose(it?.activation) || strLoose(it?.title) || 'Ativação';
    const description = strLoose(it?.description) || null;

    const color = strLoose(it?.color) || '#22C55E';

    const expertsFromPayload = Array.isArray(it?.experts) ? it.experts : Array.isArray(it?.Experts) ? it.Experts : null;

    let experts: AdminActivation['experts'] = [];

    if (expertsFromPayload) {
      experts = expertsFromPayload
        .map((e: any) => {
          const idv = strLoose(e?.id);
          const email = strLoose(e?.email);
          const photoUrl = strLoose(e?.photoUrl) || strLoose(e?.expertPhotoUrl) || null;
          const isActive = Boolean(e?.isActive ?? e?.expertIsActive ?? true);

          const fromMap = (idv && byId.get(idv)) || (email && byEmail.get(email.toLowerCase())) || null;

          return {
            id: idv || (fromMap?.id ?? ''),
            email: email || (fromMap?.email ?? ''),
            photoUrl: (photoUrl && photoUrl.trim()) || (fromMap?.photoUrl ?? null) || null,
            isActive: isActive ?? (fromMap?.isActive ?? true),
          };
        })
        .filter((x: any) => x?.email);
    } else {
      const expertIds: string[] = Array.isArray(it?.expertIds) ? it.expertIds.map((x: any) => strLoose(x)).filter(Boolean) : [];
      const expertEmails: string[] = Array.isArray(it?.expertEmails)
        ? it.expertEmails.map((x: any) => strLoose(x)).filter(Boolean)
        : [];

      const merged: Array<{ id: string; email: string }> = [];

      for (const idv of expertIds) {
        const ex = byId.get(idv);
        if (ex) merged.push({ id: ex.id, email: ex.email });
      }

      for (const em of expertEmails) {
        const ex = byEmail.get(em.toLowerCase());
        merged.push({ id: ex?.id ?? '', email: ex?.email ?? em });
      }

      const seen = new Set<string>();
      experts = merged
        .map((m) => {
          const ex = (m.id && byId.get(m.id)) || (m.email && byEmail.get(m.email.toLowerCase())) || null;
          return {
            id: m.id || (ex?.id ?? ''),
            email: m.email || (ex?.email ?? ''),
            photoUrl: ex?.photoUrl ?? null,
            isActive: ex?.isActive ?? true,
          };
        })
        .filter((x) => {
          const key = (x.email || '').toLowerCase();
          if (!key) return false;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }

    out.push({
      id,
      date,
      activation,
      description,
      color,
      experts,
      _raw: it,
    });
  }

  return out;
}

/* -------------------- PAGE -------------------- */

export default function AdminCronogramasPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [experts, setExperts] = useState<Expert[]>([]);
  const [expertId, setExpertId] = useState<string>('ALL');
  const [expertDraft, setExpertDraft] = useState<string>('ALL');
  const [expertSearch, setExpertSearch] = useState('');
  const [openExpert, setOpenExpert] = useState(false);
  const expertBtnRef = useRef<HTMLButtonElement>(null);

  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [items, setItems] = useState<AdminAppointment[]>([]);
  const [activations, setActivations] = useState<AdminActivation[]>([]);
  const [showActivations, setShowActivations] = useState(true);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [hover, setHover] = useState<{ x: number; y: number; item: CalendarItem } | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);

  // ✅ criação pelo admin
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState('');

  const [cExpertId, setCExpertId] = useState<string>(''); // obrigatório
  const [cTitle, setCTitle] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cLocation, setCLocation] = useState('');
  const [cAllDay, setCAllDay] = useState(false);
  const [cColor, setCColor] = useState<string>('#6A5CFF');

  const [cStartDate, setCStartDate] = useState<string>(() => toLocalDateInput(new Date()));
  const [cStartTime, setCStartTime] = useState<string>(() => toLocalTimeInput(new Date()));
  const [cEndDate, setCEndDate] = useState<string>(() => toLocalDateInput(new Date()));
  const [cEndTime, setCEndTime] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    return toLocalTimeInput(d);
  });

  const [cRec, setCRec] = useState<RecurrenceUi>({
    enabled: false,
    freq: 'weekly',
    interval: 1,
    mode: 'count',
    count: 8,
    until: toLocalDateInput(new Date()),
    weekdays: [new Date().getDay()],
  });

  useEffect(() => {
    const t = getToken();
    if (!t) {
      clearToken();
      router.replace('/login');
      return;
    }
    setToken(t);
    setReady(true);
  }, [router]);

  const gridFrom = useMemo(() => startOfGridMonth(cursor), [cursor]);
  const gridTo = useMemo(() => endOfGridMonth(cursor), [cursor]);

  const filteredExperts = useMemo(() => {
    const q = expertSearch.trim().toLowerCase();
    const list = experts || [];
    if (!q) return list;
    return list.filter((e) => e.email.toLowerCase().includes(q));
  }, [experts, expertSearch]);

  const expertLabel = useMemo(() => {
    if (expertId === 'ALL') return 'Todos os experts';
    return experts.find((e) => e.id === expertId)?.email ?? 'Expert';
  }, [expertId, experts]);

  const days = useMemo(() => {
    const out: Date[] = [];
    const start = startOfDay(gridFrom);
    const end = startOfDay(gridTo);
    const total = Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1;
    for (let i = 0; i < total; i++) out.push(addDays(start, i));
    return out;
  }, [gridFrom, gridTo]);

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const out: CalendarItem[] = [];

    for (const it of items) {
      const d = new Date(it.startAt);
      const dayKey = yyyyMmDd(Number.isNaN(d.getTime()) ? new Date() : d);
      const startMs = Number.isNaN(d.getTime()) ? 0 : d.getTime();
      out.push({ kind: 'appointment', dayKey, startMs, appointment: it });
    }

    if (showActivations) {
      for (const a of activations) {
        out.push({ kind: 'activation', dayKey: a.date, startMs: 0, activation: a });
      }
    }

    return out;
  }, [items, activations, showActivations]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    for (const it of calendarItems) {
      const key = it.dayKey;
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'activation' ? -1 : 1;
        return a.startMs - b.startMs;
      });
      map.set(k, arr);
    }

    return map;
  }, [calendarItems]);

  const load = useCallback(async () => {
    if (!token) return;
    setErr('');
    setLoading(true);

    try {
      const users = await apiFetch<Expert[]>('/users', { token });
      const onlyExperts = (users || []).filter((u) => u.role === 'EXPERT');
      setExperts(onlyExperts);

      const fromIso = gridFrom.toISOString();
      const toIso = addDays(gridTo, 1).toISOString(); // exclusivo

      // agendamentos
      const url =
        `/admin/cronogramas?from=${encodeURIComponent(fromIso)}` +
        `&to=${encodeURIComponent(toIso)}` +
        `&expertId=${encodeURIComponent(expertId)}`;

      const data = await apiFetch<any[]>(url, { token });
      const normalized = normalizeAppointments(data as any[], onlyExperts);
      setItems(normalized || []);

      // ✅ ativações do admin (troque a rota se necessário)
      const actUrl =
        `/admin/ativacoes?from=${encodeURIComponent(fromIso)}` +
        `&to=${encodeURIComponent(toIso)}` +
        `&expertId=${encodeURIComponent(expertId)}`;

      let actsRaw: any[] = [];
      try {
        actsRaw = await apiFetch<any[]>(actUrl, { token });
      } catch {
        actsRaw = [];
      }

      const acts = normalizeActivations(actsRaw, onlyExperts);
      setActivations(acts);
    } catch (e: any) {
      const msg =
        (Array.isArray(e?.message) ? e.message.join(' • ') : e?.message) ||
        e?.error ||
        'Falha ao carregar cronogramas';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [token, gridFrom, gridTo, expertId]);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  function prevMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function goToday() {
    setCursor(new Date());
  }

  function openExpertPopover() {
    setExpertDraft(expertId);
    setExpertSearch('');
    setOpenExpert(true);
  }

  function applyExpert() {
    setExpertId(expertDraft);
    setOpenExpert(false);
  }

  function openCreate() {
    setCreateErr('');
    setCTitle('');
    setCDescription('');
    setCLocation('');
    setCAllDay(false);
    setCColor('#6A5CFF');

    const base = new Date();
    setCStartDate(toLocalDateInput(base));
    setCStartTime(toLocalTimeInput(base));
    const end = new Date(base);
    end.setHours(end.getHours() + 1);
    setCEndDate(toLocalDateInput(end));
    setCEndTime(toLocalTimeInput(end));

    const preExpert = expertId !== 'ALL' ? expertId : '';
    setCExpertId(preExpert);

    setCRec((prev) => ({
      ...prev,
      enabled: false,
      freq: 'weekly',
      interval: 1,
      mode: 'count',
      count: 8,
      until: toLocalDateInput(new Date()),
      weekdays: [new Date().getDay()],
    }));

    setCreateOpen(true);
  }

  async function submitCreate() {
    if (!token) return;
    setCreateErr('');

    const expertChosen = String(cExpertId || '').trim();
    if (!expertChosen) {
      setCreateErr('Selecione um expert para criar o agendamento.');
      return;
    }

    const title = String(cTitle || '').trim();
    if (!title) {
      setCreateErr('Informe um título.');
      return;
    }

    const startIso = buildIsoFromLocal(cStartDate, cStartTime);
    if (!startIso) {
      setCreateErr('Data/hora inicial inválida.');
      return;
    }

    let endIso: string | undefined = undefined;
    if (!cAllDay) {
      const eIso = buildIsoFromLocal(cEndDate, cEndTime);
      if (!eIso) {
        setCreateErr('Data/hora final inválida.');
        return;
      }
      if (new Date(eIso).getTime() <= new Date(startIso).getTime()) {
        setCreateErr('O fim precisa ser maior que o início.');
        return;
      }
      endIso = eIso;
    }

    const payload: any = {
      expertId: expertChosen,
      title,
      startAt: startIso,
      allDay: Boolean(cAllDay),
    };

    if (!cAllDay && endIso) payload.endAt = endIso;

    const desc = String(cDescription || '').trim();
    if (desc) payload.description = desc;

    const loc = String(cLocation || '').trim();
    if (loc) payload.location = loc;

    const col = String(cColor || '').trim();
    if (col) payload.color = col;

    if (cRec.enabled) {
      const interval = Math.max(1, Math.floor(Number(cRec.interval || 1)));

      if (cRec.mode === 'count') {
        const count = Math.max(1, Math.floor(Number(cRec.count || 1)));
        payload.recurrence = {
          enabled: true,
          freq: cRec.freq,
          interval,
          mode: 'count',
          count,
          ...(cRec.freq === 'weekly' ? { weekdays: cRec.weekdays || [] } : {}),
        };
      } else {
        if (!cRec.until) {
          setCreateErr('Informe a data "até" da recorrência.');
          return;
        }
        const untilIso = buildIsoFromLocal(cRec.until, '00:00');
        if (!untilIso) {
          setCreateErr('Data "até" inválida.');
          return;
        }
        payload.recurrence = {
          enabled: true,
          freq: cRec.freq,
          interval,
          mode: 'until',
          until: untilIso,
          ...(cRec.freq === 'weekly' ? { weekdays: cRec.weekdays || [] } : {}),
        };
      }
    }

    setCreateBusy(true);
    try {
      await apiFetch('/admin/cronogramas', {
        token,
        method: 'POST',
        body: payload,
      } as any);

      setCreateOpen(false);
      await load();
    } catch (e: any) {
      const msg =
        (Array.isArray(e?.message) ? e.message.join(' • ') : e?.message) ||
        e?.error ||
        'Falha ao criar agendamento';
      setCreateErr(msg);
    } finally {
      setCreateBusy(false);
    }
  }

  const weekdaysLabels = useMemo(
    () => [
      { n: 0, l: 'Dom' },
      { n: 1, l: 'Seg' },
      { n: 2, l: 'Ter' },
      { n: 3, l: 'Qua' },
      { n: 4, l: 'Qui' },
      { n: 5, l: 'Sex' },
      { n: 6, l: 'Sáb' },
    ],
    [],
  );

  function openItemModal(it: CalendarItem) {
    setSelected(it);
  }

  function buildHoverPos(e: React.MouseEvent<HTMLElement, MouseEvent>) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = clamp(e.clientX, 160, vw - 160);
    const y = clamp(e.clientY - 10, 90, vh - 20);
    return { x, y };
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden relative">
      {/* Glow topo */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-70"
        style={{
          background:
            'radial-gradient(700px 200px at 60% 30%, rgba(90,120,255,0.22), transparent 60%), radial-gradient(600px 220px at 25% 20%, rgba(90,200,255,0.16), transparent 60%)',
        }}
      />

      {/* Header */}
      <div className="relative px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4">
        <div>
          <div className="text-white/92 font-semibold tracking-tight text-[18px]">Cronogramas</div>
          <div className="text-white/45 text-sm mt-1">
            Visualização centralizada •{' '}
            <span className="text-white/70">
              <Sensitive placeholder="••••••@••••">{expertLabel}</Sensitive>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 relative">
          {/* ✅ Criar */}
          <button
            onClick={openCreate}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
              'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
              'text-sm font-medium',
            )}
            type="button"
          >
            + Novo agendamento
          </button>

          {/* ✅ Toggle Ativações */}
          <button
            onClick={() => setShowActivations((v) => !v)}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              showActivations ? 'bg-emerald-500/12 hover:bg-emerald-500/16' : 'bg-white/[0.03] hover:bg-white/[0.06]',
              'transition text-sm font-medium',
              showActivations ? 'text-emerald-100' : 'text-white/85',
            )}
            type="button"
            title="Mostrar/ocultar ativações"
          >
            {showActivations ? 'Ativações: ON' : 'Ativações: OFF'}
          </button>

          {/* Expert filter */}
          <div className="relative">
            <button
              ref={expertBtnRef}
              type="button"
              onClick={() => (openExpert ? setOpenExpert(false) : openExpertPopover())}
              className={cx(
                'h-10 px-3 rounded-xl border border-white/10',
                'bg-white/[0.03] hover:bg-white/[0.05] transition',
                'text-white/85 text-sm flex items-center gap-2',
                'min-w-[240px] justify-between',
              )}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-6 h-6 rounded-full border border-white/10 bg-white/[0.04] grid place-items-center text-white/70">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 20c1.8-3 5-5 8-5s6.2 2 8 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="font-medium truncate max-w-[160px]">
                  <Sensitive placeholder="••••••@••••">{expertLabel}</Sensitive>
                </span>
              </span>

              <span className="text-white/55">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8.5 10l3.5 3.8L15.5 10"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>

            <Popover open={openExpert} onClose={() => setOpenExpert(false)} anchorRef={expertBtnRef as any} widthClass="w-[420px]">
              <div className="p-4 border-b border-white/10">
                <div className="text-white/85 font-semibold">Filtrar por expert</div>
                <div className="text-white/50 text-sm mt-1">Busque por e-mail e selecione.</div>
              </div>

              <div className="p-4 space-y-3">
                <input
                  value={expertSearch}
                  onChange={(e) => setExpertSearch(e.target.value)}
                  placeholder="Buscar por e-mail..."
                  className={cx(
                    'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                    'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                  )}
                />

                <div className="max-h-[280px] overflow-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setExpertDraft('ALL')}
                    className={cx(
                      'w-full text-left px-3 py-2 rounded-xl border border-white/10',
                      expertDraft === 'ALL' ? 'bg-white/[0.08]' : 'bg-white/[0.03] hover:bg-white/[0.06]',
                      'transition',
                    )}
                  >
                    <div className="text-white/90 text-sm font-medium">Todos os experts</div>
                    <div className="text-white/45 text-xs mt-0.5">Calendário consolidado</div>
                  </button>

                  <div className="mt-2 space-y-2">
                    {filteredExperts.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setExpertDraft(e.id)}
                        className={cx(
                          'w-full text-left px-3 py-2 rounded-xl border border-white/10',
                          expertDraft === e.id ? 'bg-white/[0.08]' : 'bg-white/[0.03] hover:bg-white/[0.06]',
                          'transition',
                          'flex items-center gap-3',
                        )}
                      >
                        <Avatar photoUrl={e.photoUrl ?? null} email={e.email} />
                        <div className="min-w-0">
                          <div className="text-white/90 text-sm font-medium truncate">
                            <Sensitive placeholder="••••••@••••">{e.email}</Sensitive>
                          </div>
                          <div className="text-white/45 text-xs mt-0.5">
                            ID: <Sensitive placeholder="••••••">{e.id}</Sensitive>
                          </div>
                        </div>
                      </button>
                    ))}

                    {filteredExperts.length === 0 ? (
                      <div className="text-white/50 text-sm px-2 py-6 text-center">Nenhum expert encontrado.</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenExpert(false)}
                  className={cx(
                    'h-10 px-3 rounded-xl border border-white/10',
                    'bg-white/[0.02] hover:bg-white/[0.05] transition',
                    'text-white/75 text-sm',
                  )}
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    applyExpert();
                  }}
                  className={cx(
                    'h-10 px-4 rounded-xl border border-white/10',
                    'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                    'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                    'text-sm font-medium',
                  )}
                >
                  Aplicar
                </button>
              </div>
            </Popover>
          </div>

          {/* month controls */}
          <button
            onClick={prevMonth}
            className={cx(
              'h-10 px-3 rounded-xl border border-white/10',
              'bg-white/[0.03] hover:bg-white/[0.06] transition',
              'text-white/85 text-sm',
            )}
            type="button"
          >
            ←
          </button>

          <button
            onClick={goToday}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              'bg-white/[0.03] hover:bg-white/[0.06] transition',
              'text-white/85 text-sm font-medium',
            )}
            type="button"
          >
            Hoje
          </button>

          <button
            onClick={nextMonth}
            className={cx(
              'h-10 px-3 rounded-xl border border-white/10',
              'bg-white/[0.03] hover:bg-white/[0.06] transition',
              'text-white/85 text-sm',
            )}
            type="button"
          >
            →
          </button>

          <button
            onClick={load}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              'bg-white/[0.03] hover:bg-white/[0.06] transition',
              'text-white/85 text-sm font-medium',
            )}
            type="button"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-white/90 font-semibold tracking-tight text-[20px] capitalize">{monthTitle(cursor)}</div>
          <div className="text-white/45 text-sm">
            Intervalo: <span className="text-white/70">{yyyyMmDd(gridFrom)} → {yyyyMmDd(gridTo)}</span>
          </div>
        </div>

        {err ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
        ) : null}

        {/* Calendar */}
        <div
          className={cx(
            'rounded-2xl border border-white/10 overflow-hidden',
            'bg-gradient-to-b from-white/[0.05] to-white/[0.02]',
            'shadow-[0_18px_70px_rgba(0,0,0,0.45)]',
          )}
        >
          {/* Week header */}
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.03]">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((w) => (
              <div key={w} className="px-3 py-3 text-white/55 text-xs font-medium uppercase tracking-wider">
                {w}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = yyyyMmDd(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const arr = eventsByDay.get(key) ?? [];
              const today = yyyyMmDd(d) === yyyyMmDd(new Date());

              const maxShow = 3;
              const shown = arr.slice(0, maxShow);
              const more = arr.length - shown.length;

              return (
                <div
                  key={key}
                  className={cx(
                    'min-h-[140px] border-b border-white/10 border-r border-white/10 last:border-r-0',
                    'p-2.5',
                    inMonth ? 'bg-white/[0.00]' : 'bg-white/[0.015]',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className={cx('text-xs font-medium', inMonth ? 'text-white/80' : 'text-white/35')}>
                      <span
                        className={cx(
                          'inline-flex items-center justify-center w-7 h-7 rounded-xl',
                          today ? 'bg-[#3E78FF]/25 border border-[#3E78FF]/30 text-white' : 'border border-transparent',
                        )}
                      >
                        {d.getDate()}
                      </span>
                    </div>

                    {arr.length ? <div className="text-[11px] text-white/45">{arr.length} item(s)</div> : null}
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {loading ? <div className="h-10 rounded-xl bg-white/[0.03] border border-white/10 animate-pulse" /> : null}

                    {!loading &&
                      shown.map((it) => {
                        if (it.kind === 'activation') {
                          const a = it.activation;
                          const pillColor = safeHex(a.color || '#22C55E');
                          const tc = pickTextColorForBg(pillColor);

                          return (
                            <div
                              key={`act:${a.id}`}
                              className={cx(
                                'group cursor-pointer select-none',
                                'rounded-xl border border-white/10 transition',
                                'px-2 py-2 flex items-center gap-2',
                              )}
                              style={{
                                background: `linear-gradient(180deg, ${pillColor}22, ${pillColor}14)`,
                              }}
                              onMouseEnter={(e) => {
                                const pos = buildHoverPos(e);
                                setHover({ x: pos.x, y: pos.y, item: it });
                              }}
                              onMouseLeave={() => setHover(null)}
                              onClick={() => openItemModal(it)}
                            >
                              <span className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ background: pillColor }} />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-xs font-extrabold tracking-tight truncate" style={{ color: tc }} title={a.activation}>
                                    {a.activation}
                                  </div>
                                  <span
                                    className="shrink-0 text-[10px] px-2 py-[2px] rounded-full border"
                                    style={{
                                      color: tc,
                                      borderColor: tc.includes('0,0,0') ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.22)',
                                      background: tc.includes('0,0,0') ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.18)',
                                    }}
                                  >
                                    ATIVAÇÃO
                                  </span>
                                </div>

                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <AvatarStack
                                      people={(a.experts || []).map((x) => ({ email: x.email, photoUrl: x.photoUrl }))}
                                      max={3}
                                    />
                                    <div className="text-[11px] truncate" style={{ color: tc, opacity: 0.88 }}>
                                      {(a.experts || []).length ? `${a.experts.length} expert(s)` : 'Sem experts'}
                                    </div>
                                  </div>

                                  <div className="text-[11px]" style={{ color: tc, opacity: 0.75 }}>
                                    Dia todo
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        const ap = it.appointment;
                        const start = ap.allDay ? 'Dia inteiro' : timeLabel(ap.startAt);
                        const end = ap.allDay ? '' : ap.endAt ? `– ${timeLabel(ap.endAt)}` : '';
                        const pillColor = safeHex(ap.color ? ap.color : '#6A5CFF');
                        const finished = isFinishedEvent(ap);
                        const tc = pickTextColorForBg(pillColor);

                        return (
                          <div
                            key={`app:${ap.id}`}
                            className={cx(
                              'group cursor-pointer select-none',
                              'rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition',
                              'px-2 py-2 flex items-center gap-2',
                              finished ? 'opacity-60' : '',
                            )}
                            onMouseEnter={(e) => {
                              const pos = buildHoverPos(e);
                              setHover({ x: pos.x, y: pos.y, item: it });
                            }}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => openItemModal(it)}
                            title={finished ? 'Finalizado' : undefined}
                          >
                            <span className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ background: pillColor }} />
                            <Avatar photoUrl={ap.expertPhotoUrl} email={ap.expertEmail} />
                            <div className="min-w-0">
                              <div className={cx('text-white/90 text-xs font-medium truncate', finished ? 'line-through text-white/70' : '')}>
                                {ap.title}
                              </div>
                              <div className="text-white/45 text-[11px] truncate flex items-center gap-2">
                                <span className="truncate">
                                  <Sensitive placeholder="••••••@••••">{ap.expertEmail}</Sensitive> •{' '}
                                  <span style={{ color: tc }}>{start} {end}</span>
                                </span>

                                {finished ? (
                                  <span className="shrink-0 px-2 py-[2px] rounded-full border border-white/10 bg-white/[0.04] text-white/70 text-[10px]">
                                    Finalizado
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {!loading && more > 0 ? <div className="text-white/50 text-[12px] px-2 py-1">+{more} mais</div> : null}

                    {!loading && arr.length === 0 ? <div className="text-white/30 text-[12px] px-2 py-3">Sem eventos</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hover ? (
        <div className="fixed z-[70] pointer-events-none" style={{ left: hover.x, top: hover.y, transform: 'translate(-50%, -100%)' }}>
          <div className="rounded-2xl border border-white/10 bg-[#0B1022]/95 backdrop-blur-xl shadow-[0_22px_110px_rgba(0,0,0,0.65)] px-3 py-2 w-[360px]">
            {hover.item.kind === 'activation' ? (
              (() => {
                const a = hover.item.activation;
                const color = safeHex(a.color || '#22C55E');
                const tc = pickTextColorForBg(color);

                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: tc }}>
                          {a.activation}
                        </div>
                        <div className="text-xs" style={{ color: tc, opacity: 0.85 }}>
                          Ativação • Dia todo
                        </div>
                      </div>
                      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <AvatarStack people={(a.experts || []).map((x) => ({ email: x.email, photoUrl: x.photoUrl }))} max={4} />
                      <div className="text-xs text-white/70 truncate">
                        {(a.experts || []).length ? `${a.experts.length} expert(s)` : 'Sem experts'}
                      </div>
                    </div>

                    {a.description ? <div className="mt-2 text-white/65 text-xs line-clamp-4 whitespace-pre-wrap">{a.description}</div> : null}
                  </>
                );
              })()
            ) : (
              (() => {
                const ap = hover.item.appointment;
                const finished = isFinishedEvent(ap);
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <Avatar photoUrl={ap.expertPhotoUrl} email={ap.expertEmail} />
                      <div className="min-w-0">
                        <div className={cx('text-white/90 text-sm font-semibold truncate', finished ? 'line-through text-white/75' : '')}>
                          {ap.title}
                        </div>
                        <div className="text-white/50 text-xs truncate">
                          <Sensitive placeholder="••••••@••••">{ap.expertEmail}</Sensitive>
                          {finished ? <span className="ml-2 text-white/60">• Finalizado</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-white/65 text-xs">
                      {ap.allDay ? (
                        <>Dia inteiro</>
                      ) : (
                        <>
                          {timeLabel(ap.startAt)}
                          {ap.endAt ? ` – ${timeLabel(ap.endAt)}` : ''}
                        </>
                      )}
                      {ap.location ? (
                        <>
                          {' '}
                          • <span className="text-white/55">{ap.location}</span>
                        </>
                      ) : null}
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      ) : null}

      {/* Modal details (agendamento OU ativação) */}
      <Modal open={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          selected.kind === 'activation' ? (
            (() => {
              const a = selected.activation;
              const color = safeHex(a.color || '#22C55E');
              const tc = pickTextColorForBg(color);

              return (
                <>
                  <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                        <div className="text-white/95 font-semibold tracking-tight text-[18px] truncate">{a.activation}</div>
                        <span className="text-[10px] px-2 py-[2px] rounded-full border border-white/10 bg-white/[0.03] text-white/70">
                          ATIVAÇÃO
                        </span>
                      </div>
                      <div className="text-white/55 text-sm mt-1">Dia: {a.date} • Experts vinculados: {(a.experts || []).length}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="p-5 grid grid-cols-12 gap-4">
                    <div className="col-span-12 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-white/70 text-xs uppercase tracking-wider">Etiqueta</div>
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10" style={{ background: color }}>
                        <span className="text-sm font-extrabold tracking-wide" style={{ color: tc }}>
                          {a.activation}
                        </span>
                        <span
                          className="text-[10px] px-2 py-[2px] rounded-full border"
                          style={{
                            color: tc,
                            borderColor: tc.includes('0,0,0') ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.22)',
                          }}
                        >
                          DIA TODO
                        </span>
                      </div>
                    </div>

                    <div className="col-span-12 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-white/70 text-xs uppercase tracking-wider">Experts</div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(a.experts || []).length ? (
                          a.experts.map((ex) => (
                            <div
                              key={ex.email}
                              className={cx('rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2', ex.isActive ? '' : 'opacity-70')}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar photoUrl={ex.photoUrl} email={ex.email} />
                                <div className="min-w-0">
                                  <div className="text-white/90 text-sm font-medium truncate">
                                    <Sensitive placeholder="••••••@••••">{ex.email}</Sensitive>
                                  </div>
                                  <div className="text-white/45 text-xs truncate">
                                    {ex.isActive ? 'Ativo' : 'Inativo'}
                                    {ex.id ? (
                                      <>
                                        {' '}
                                        • ID: <Sensitive placeholder="••••••">{ex.id}</Sensitive>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-white/55 text-sm">Nenhum expert associado a essa ativação.</div>
                        )}
                      </div>
                    </div>

                    <div className="col-span-12 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-white/70 text-xs uppercase tracking-wider">Descrição</div>
                      <div className="mt-2 text-white/85 text-sm whitespace-pre-wrap">{a.description || '—'}</div>
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            (() => {
              const ap = selected.appointment;
              const finished = isFinishedEvent(ap);

              return (
                <>
                  <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar photoUrl={ap.expertPhotoUrl} email={ap.expertEmail} />
                      <div className="min-w-0">
                        <div className={cx('text-white/95 font-semibold tracking-tight text-[18px] truncate', finished ? 'line-through text-white/75' : '')}>
                          {ap.title}
                        </div>
                        <div className="text-white/55 text-sm truncate">
                          Expert: <Sensitive placeholder="••••••@••••">{ap.expertEmail}</Sensitive>
                          {finished ? <span className="ml-2 text-white/60">• Finalizado</span> : null}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="p-5 grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-white/70 text-xs uppercase tracking-wider">Quando</div>
                      <div className="mt-2 text-white/90 text-sm">
                        {ap.allDay ? (
                          <>Dia inteiro</>
                        ) : (
                          <>
                            <span className="font-medium">{timeLabel(ap.startAt)}</span>
                            {ap.endAt ? (
                              <>
                                {' '}
                                – <span className="font-medium">{timeLabel(ap.endAt)}</span>
                              </>
                            ) : null}
                          </>
                        )}
                      </div>
                      <div className="mt-1 text-white/45 text-xs">
                        {new Date(ap.startAt).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      <div className="mt-2">
                        {finished ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-white/75 text-xs">
                            ✓ Finalizado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-white/75 text-xs">
                            • Ativo
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-white/70 text-xs uppercase tracking-wider">Local</div>
                      <div className="mt-2 text-white/90 text-sm">{ap.location || '—'}</div>
                      <div className="mt-2 text-white/70 text-xs uppercase tracking-wider">Série</div>
                      <div className="mt-1 text-white/85 text-sm">
                        {ap.seriesId ? (
                          <span className="text-white/70">
                            seriesId: <span className="text-white/90">{ap.seriesId}</span>
                          </span>
                        ) : (
                          'Evento único'
                        )}
                      </div>
                    </div>

                    <div className="col-span-12 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-white/70 text-xs uppercase tracking-wider">Descrição</div>
                      <div className="mt-2 text-white/85 text-sm whitespace-pre-wrap">{ap.description || '—'}</div>
                    </div>
                  </div>
                </>
              );
            })()
          )
        ) : null}
      </Modal>

      {/* ✅ Modal CREATE (mantive igual ao seu original, sem mexer no layout) */}
      <Modal open={createOpen} onClose={() => (createBusy ? null : setCreateOpen(false))}>
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white/95 font-semibold tracking-tight text-[18px] truncate">Novo agendamento</div>
            <div className="text-white/55 text-sm">Crie um evento para um expert — vai refletir no calendário do expert também.</div>
          </div>

          <button
            type="button"
            onClick={() => (createBusy ? null : setCreateOpen(false))}
            className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm"
          >
            Fechar
          </button>
        </div>

        <div className="p-5">
          {createErr ? (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{createErr}</div>
          ) : null}

          <div className="grid grid-cols-12 gap-4">
            {/* Expert */}
            <div className="col-span-12 md:col-span-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-white/70 text-xs uppercase tracking-wider">Expert</div>
              <div className="mt-2">
                <select
                  value={cExpertId}
                  onChange={(e) => setCExpertId(e.target.value)}
                  className={cx(
                    'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                    'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                  )}
                >
                  <option value="" className="bg-[#0B1022]">
                    Selecione um expert…
                  </option>
                  {experts.map((e) => (
                    <option key={e.id} value={e.id} className="bg-[#0B1022]">
                      {e.email}
                    </option>
                  ))}
                </select>

                {cExpertId ? (
                  <div className="mt-3 flex items-center gap-2 text-white/70 text-sm">
                    <Avatar
                      photoUrl={experts.find((x) => x.id === cExpertId)?.photoUrl ?? null}
                      email={experts.find((x) => x.id === cExpertId)?.email ?? 'expert'}
                    />
                    <span className="truncate">
                      <Sensitive placeholder="••••••@••••">{experts.find((x) => x.id === cExpertId)?.email ?? ''}</Sensitive>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Básico */}
            <div className="col-span-12 md:col-span-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-white/70 text-xs uppercase tracking-wider">Informações</div>

              <div className="mt-2 space-y-3">
                <div>
                  <div className="text-white/55 text-xs mb-1">Título</div>
                  <input
                    value={cTitle}
                    onChange={(e) => setCTitle(e.target.value)}
                    placeholder="Ex: Reunião com time"
                    className={cx(
                      'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                      'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                    )}
                  />
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-8">
                    <div className="text-white/55 text-xs mb-1">Local</div>
                    <input
                      value={cLocation}
                      onChange={(e) => setCLocation(e.target.value)}
                      placeholder="Ex: Zoom / Escritório"
                      className={cx(
                        'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                        'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                      )}
                    />
                  </div>
                  <div className="col-span-4">
                    <div className="text-white/55 text-xs mb-1">Cor</div>
                    <input
                      type="color"
                      value={cColor}
                      onChange={(e) => setCColor(e.target.value)}
                      className="w-full h-10 rounded-xl border border-white/10 bg-black/30 px-2"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-white/55 text-xs mb-1">Descrição</div>
                  <textarea
                    value={cDescription}
                    onChange={(e) => setCDescription(e.target.value)}
                    placeholder="Detalhes do compromisso…"
                    className={cx(
                      'w-full min-h-[88px] rounded-xl border border-white/10 bg-black/30',
                      'px-3 py-2 text-white/85 text-sm outline-none focus:border-white/20',
                    )}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input id="allDay" type="checkbox" checked={cAllDay} onChange={(e) => setCAllDay(e.target.checked)} className="h-4 w-4" />
                  <label htmlFor="allDay" className="text-white/75 text-sm">
                    Dia inteiro
                  </label>
                </div>
              </div>
            </div>

            {/* Datas */}
            <div className="col-span-12 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-white/70 text-xs uppercase tracking-wider">Quando</div>

              <div className="mt-3 grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-3">
                  <div className="text-white/55 text-xs mb-1">Data início</div>
                  <input
                    type="date"
                    value={cStartDate}
                    onChange={(e) => setCStartDate(e.target.value)}
                    className={cx(
                      'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                      'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                    )}
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <div className="text-white/55 text-xs mb-1">Hora início</div>
                  <input
                    type="time"
                    value={cStartTime}
                    onChange={(e) => setCStartTime(e.target.value)}
                    disabled={cAllDay}
                    className={cx(
                      'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                      'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                      cAllDay ? 'opacity-60 cursor-not-allowed' : '',
                    )}
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <div className="text-white/55 text-xs mb-1">Data fim</div>
                  <input
                    type="date"
                    value={cEndDate}
                    onChange={(e) => setCEndDate(e.target.value)}
                    disabled={cAllDay}
                    className={cx(
                      'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                      'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                      cAllDay ? 'opacity-60 cursor-not-allowed' : '',
                    )}
                  />
                </div>

                <div className="col-span-12 md:col-span-3">
                  <div className="text-white/55 text-xs mb-1">Hora fim</div>
                  <input
                    type="time"
                    value={cEndTime}
                    onChange={(e) => setCEndTime(e.target.value)}
                    disabled={cAllDay}
                    className={cx(
                      'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                      'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                      cAllDay ? 'opacity-60 cursor-not-allowed' : '',
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Recorrência */}
            <div className="col-span-12 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white/70 text-xs uppercase tracking-wider">Recorrência</div>
                  <div className="text-white/45 text-sm mt-1">Opcional: repetir automaticamente.</div>
                </div>

                <label className="flex items-center gap-2 text-white/80 text-sm">
                  <input
                    type="checkbox"
                    checked={cRec.enabled}
                    onChange={(e) => setCRec((p) => ({ ...p, enabled: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  Ativar
                </label>
              </div>

              {cRec.enabled ? (
                <div className="mt-4 grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-3">
                    <div className="text-white/55 text-xs mb-1">Frequência</div>
                    <select
                      value={cRec.freq}
                      onChange={(e) => setCRec((p) => ({ ...p, freq: e.target.value as any }))}
                      className={cx(
                        'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                        'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                      )}
                    >
                      <option value="daily" className="bg-[#0B1022]">
                        Diária
                      </option>
                      <option value="weekly" className="bg-[#0B1022]">
                        Semanal
                      </option>
                      <option value="monthly" className="bg-[#0B1022]">
                        Mensal
                      </option>
                    </select>
                  </div>

                  <div className="col-span-12 md:col-span-3">
                    <div className="text-white/55 text-xs mb-1">Intervalo</div>
                    <input
                      type="number"
                      value={cRec.interval}
                      min={1}
                      onChange={(e) => setCRec((p) => ({ ...p, interval: Number(e.target.value) }))}
                      className={cx(
                        'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                        'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                      )}
                    />
                  </div>

                  <div className="col-span-12 md:col-span-6">
                    <div className="text-white/55 text-xs mb-1">Termina</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCRec((p) => ({ ...p, mode: 'count' }))}
                        className={cx(
                          'h-10 px-3 rounded-xl border border-white/10 text-sm',
                          cRec.mode === 'count'
                            ? 'bg-white/[0.10] text-white'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] text-white/80',
                          'transition',
                        )}
                      >
                        Por quantidade
                      </button>

                      <button
                        type="button"
                        onClick={() => setCRec((p) => ({ ...p, mode: 'until' }))}
                        className={cx(
                          'h-10 px-3 rounded-xl border border-white/10 text-sm',
                          cRec.mode === 'until'
                            ? 'bg-white/[0.10] text-white'
                            : 'bg-white/[0.03] hover:bg-white/[0.06] text-white/80',
                          'transition',
                        )}
                      >
                        Até data
                      </button>
                    </div>
                  </div>

                  {cRec.mode === 'count' ? (
                    <div className="col-span-12 md:col-span-3">
                      <div className="text-white/55 text-xs mb-1">Ocorrências</div>
                      <input
                        type="number"
                        min={1}
                        value={cRec.count}
                        onChange={(e) => setCRec((p) => ({ ...p, count: Number(e.target.value) }))}
                        className={cx(
                          'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                          'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                        )}
                      />
                    </div>
                  ) : (
                    <div className="col-span-12 md:col-span-3">
                      <div className="text-white/55 text-xs mb-1">Até</div>
                      <input
                        type="date"
                        value={cRec.until}
                        onChange={(e) => setCRec((p) => ({ ...p, until: e.target.value }))}
                        className={cx(
                          'w-full h-10 rounded-xl border border-white/10 bg-black/30',
                          'px-3 text-white/85 text-sm outline-none focus:border-white/20',
                        )}
                      />
                    </div>
                  )}

                  {cRec.freq === 'weekly' ? (
                    <div className="col-span-12 md:col-span-9">
                      <div className="text-white/55 text-xs mb-1">Dias da semana</div>
                      <div className="flex flex-wrap gap-2">
                        {weekdaysLabels.map((w) => {
                          const active = (cRec.weekdays || []).includes(w.n);
                          return (
                            <button
                              key={w.n}
                              type="button"
                              onClick={() => {
                                setCRec((p) => {
                                  const set = new Set<number>(p.weekdays || []);
                                  if (set.has(w.n)) set.delete(w.n);
                                  else set.add(w.n);
                                  const arr = Array.from(set).sort((a, b) => a - b);
                                  return { ...p, weekdays: arr.length ? arr : [new Date().getDay()] };
                                });
                              }}
                              className={cx(
                                'h-9 px-3 rounded-xl border border-white/10 text-sm',
                                active ? 'bg-white/[0.10] text-white' : 'bg-white/[0.03] hover:bg-white/[0.06] text-white/80',
                                'transition',
                              )}
                            >
                              {w.l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => (createBusy ? null : setCreateOpen(false))}
              className={cx(
                'h-10 px-3 rounded-xl border border-white/10',
                'bg-white/[0.02] hover:bg-white/[0.05] transition',
                'text-white/75 text-sm',
              )}
              disabled={createBusy}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={submitCreate}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                'text-sm font-medium',
                createBusy ? 'opacity-70 cursor-not-allowed' : '',
              )}
              disabled={createBusy}
            >
              {createBusy ? 'Criando…' : 'Criar agendamento'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
