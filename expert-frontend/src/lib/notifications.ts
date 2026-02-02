// src/lib/notifications.ts
import { apiFetch } from './api';
import { getToken } from './auth';
import { io, Socket } from 'socket.io-client';

export type ExpertNotification = {
  id: string;
  title: string;
  message: string;
  kind: string;
  dateIso?: string | null;
  createdAt: string;
  isRead: boolean;
};

const API_BASE = (() => {
  const raw = (process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_API_URL ?? '').trim();
  const low = raw.toLowerCase();
  if (!raw || low === 'undefined' || low === 'null') return '';
  return raw.replace(/\/+$/, '');
})();

/** ✅ Retenção: 24 horas */
const RETENTION_MS = 24 * 60 * 60 * 1000;

function toMsSafe(iso: any) {
  const d = new Date(String(iso || ''));
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function withinRetention(n: ExpertNotification, nowMs = Date.now()) {
  const createdMs = toMsSafe(n.createdAt);
  if (!createdMs) return true; // se vier inválido, não some (evita sumir coisa por bug de backend)
  return nowMs - createdMs <= RETENTION_MS;
}

function pruneAndNormalize(items: ExpertNotification[], nowMs = Date.now()) {
  const list = Array.isArray(items) ? items : [];

  // filtra 24h
  const pruned = list.filter((n) => withinRetention(n, nowMs));

  // remove duplicadas por id (defensivo: ws + fetch)
  const seen = new Set<string>();
  const unique: ExpertNotification[] = [];
  for (const n of pruned) {
    const id = String(n?.id ?? '').trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(n);
  }

  // ordena desc por createdAt
  unique.sort((a, b) => toMsSafe(b.createdAt) - toMsSafe(a.createdAt));

  // recalcula unreadCount de acordo com o que sobrou
  const unreadCount = unique.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0);

  return { items: unique, unreadCount };
}

/* ------------------- API ------------------- */

export async function fetchNotifications(opts?: { unreadOnly?: boolean; take?: number }) {
  const token = getToken();
  if (!token) throw new Error('Sem token');

  const qs = new URLSearchParams();
  if (opts?.unreadOnly) qs.set('unread', '1');
  if (opts?.take) qs.set('take', String(opts.take));

  const res = await apiFetch<{ items: ExpertNotification[]; unreadCount: number }>(
    `/expert/notifications?${qs.toString()}`,
    { token },
  );

  // ✅ aplica retenção 24h no histórico
  const normalized = pruneAndNormalize(res?.items ?? []);
  return normalized;
}

export async function markNotificationRead(id: string) {
  const token = getToken();
  if (!token) throw new Error('Sem token');
  return apiFetch(`/expert/notifications/${encodeURIComponent(id)}/read`, { token, method: 'PATCH' });
}

export async function markAllNotificationsRead() {
  const token = getToken();
  if (!token) throw new Error('Sem token');
  return apiFetch(`/expert/notifications/read-all`, { token, method: 'PATCH' });
}

/* ------------------- WS ------------------- */

let socket: Socket | null = null;

export function connectNotificationsWS(onNotification: (n: ExpertNotification) => void) {
  const token = getToken();
  if (!token) return null;

  if (socket) return socket;

  socket = io(`${API_BASE}/ws`, {
    transports: ['websocket'],
    auth: { token },
  });

  socket.on('notification', (payload: any) => {
    const n = payload as ExpertNotification;

    // ✅ se veio do backend já “velha”, nem coloca no histórico
    if (!withinRetention(n, Date.now())) return;

    onNotification(n);
  });

  socket.on('connect_error', () => {
    // silencioso
  });

  return socket;
}

export function disconnectNotificationsWS() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/* ------------------- Lembrete local (próximo do horário) ------------------- */

/**
 * Use isso no calendário do expert (quando você já tem os agendamentos carregados).
 * Ele vai criar notificações "in-app" (sininho) automaticamente X minutos antes.
 * Opcional: também dispara Notification do navegador.
 */
export type AppointmentReminderSource = {
  id: string;
  title: string;
  startAt: string; // ISO
  endAt?: string | null;
  allDay?: boolean;
};

type ReminderOpts = {
  minutesBefore?: number[]; // default [60,15,5]
  allowBrowserNotification?: boolean; // default false
  // se quiser customizar o texto
  titlePrefix?: string; // default 'Lembrete'
};

const LOCAL_KIND = 'APPOINTMENT_REMINDER_LOCAL';

/** evita lembrete duplicado por refresh */
function reminderStorageKey(apptId: string, minutes: number) {
  return `notif:reminder:${apptId}:${minutes}`;
}

function didFireRecently(key: string, nowMs: number) {
  try {
    const raw = localStorage.getItem(key);
    const ms = raw ? Number(raw) : 0;
    if (!Number.isFinite(ms) || !ms) return false;
    // se disparou nos últimos 2h, não dispara de novo
    return nowMs - ms < 2 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markFired(key: string, nowMs: number) {
  try {
    localStorage.setItem(key, String(nowMs));
  } catch {
    // ignore
  }
}

function formatTimeBR(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateBR(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

/**
 * Retorna uma função cancel() pra limpar timers.
 */
export function scheduleLocalAppointmentReminders(
  appointments: AppointmentReminderSource[],
  push: (n: ExpertNotification) => void,
  opts?: ReminderOpts,
) {
  if (typeof window === 'undefined') return () => {};
  const nowMs = Date.now();

  const minutesBefore = (opts?.minutesBefore?.length ? opts.minutesBefore : [60, 15, 5])
    .map((m) => Math.max(1, Math.floor(Number(m))))
    .filter((m) => Number.isFinite(m))
    .sort((a, b) => b - a); // maior -> menor

  const allowBrowser = Boolean(opts?.allowBrowserNotification);
  const prefix = String(opts?.titlePrefix || 'Lembrete').trim() || 'Lembrete';

  const timeouts: number[] = [];

  // opcional: pede permissão só se quiser usar Notification do navegador
  async function ensureBrowserPermission() {
    if (!allowBrowser) return false;
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  }

  // dispara local
  function fire(appt: AppointmentReminderSource, minutes: number) {
    const now = Date.now();
    const storageKey = reminderStorageKey(appt.id, minutes);
    if (didFireRecently(storageKey, now)) return;
    markFired(storageKey, now);

    const time = formatTimeBR(appt.startAt);
    const date = formatDateBR(appt.startAt);

    const n: ExpertNotification = {
      id: `local-${appt.id}-${minutes}-${now}`,
      title: `${prefix}: ${minutes} min`,
      message: `Seu agendamento "${appt.title}" começa em ${minutes} min (${date} às ${time}).`,
      kind: LOCAL_KIND,
      dateIso: appt.startAt,
      createdAt: new Date(now).toISOString(),
      isRead: false,
    };

    push(n);

    // browser notification
    if (allowBrowser && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(n.title, { body: n.message });
      } catch {
        // ignore
      }
    }
  }

  // agenda timers
  (appointments || []).forEach((appt) => {
    if (!appt?.id || !appt?.startAt) return;
    if (appt.allDay) return; // se quiser lembrar allDay, me diga que eu habilito

    const startMs = toMsSafe(appt.startAt);
    if (!startMs) return;
    if (startMs <= nowMs) return; // já passou

    for (const m of minutesBefore) {
      const whenMs = startMs - m * 60 * 1000;
      const delay = whenMs - nowMs;

      if (delay <= 0) continue; // já estaria dentro da janela
      if (delay > 7 * 24 * 60 * 60 * 1000) continue; // não agenda muito longe (defensivo)

      const t = window.setTimeout(() => fire(appt, m), delay);
      timeouts.push(t);
    }
  });

  // pede permissão depois que agendou (sem travar)
  if (allowBrowser) {
    void ensureBrowserPermission();
  }

  // cancel
  return () => {
    for (const t of timeouts) window.clearTimeout(t);
  };
}
