// src/components/ExpertShell.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getToken } from '@/lib/auth';
import { API_BASE, apiFetch } from '@/lib/api';
import { LayoutDashboard, Users, CalendarCheck2, CalendarDays, LogOut, Bell } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { SensitiveModeProvider, SensitiveToggleIconButton, useSensitiveMode } from '@/components/SensitiveMode';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function initials(email?: string) {
  if (!email) return 'EX';
  const left = (email.split('@')[0] || 'EX').trim();
  const a = (left[0] || 'E').toUpperCase();
  const b = (left[1] || 'X').toUpperCase();
  return `${a}${b}`;
}

function resolvePhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('/')) return `${API_BASE}${photoUrl}`;
  return photoUrl;
}

function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function timeLabel(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

type ExpertNotification = {
  id: string;
  title: string;
  message: string;
  kind: string;
  dateIso?: string | null;
  createdAt: string;
  isRead: boolean;

  // ✅ interno: origem (server via API/WS, ou local via cronograma)
  source?: 'server' | 'local';
};

function getWsBase() {
  // ✅ prioridade: NEXT_PUBLIC_WS_BASE
  const wsEnv = (process.env.NEXT_PUBLIC_WS_BASE ?? '').trim();
  if (wsEnv && wsEnv !== 'undefined' && wsEnv !== 'null') {
    return wsEnv.replace(/\/+$/, '');
  }

  // ✅ fallback: extrai origin do API_BASE (mesmo se API_BASE tiver path)
  const raw = String(API_BASE ?? '').trim();
  if (raw && raw !== 'undefined' && raw !== 'null') {
    try {
      const u = new URL(raw);
      return `${u.protocol}//${u.host}`; // mantém porta
    } catch {
      // se for relativo, tenta colar na origin do browser
      if (typeof window !== 'undefined') {
        try {
          const u2 = new URL(raw, window.location.origin);
          return `${u2.protocol}//${u2.host}`;
        } catch {}
      }
      return raw.replace(/\/+$/, '');
    }
  }

  // ⚠️ último fallback: origin do front
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/* -------------------- ✅ Notifs: utilidades -------------------- */

const NOTIF_RETENTION_MS = 24 * 60 * 60 * 1000;

function safeIso(v: any) {
  if (!v) return null;
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  return null;
}

function stableIdFromPayload(payload: any) {
  // gera id determinístico para notificação local quando não vem id
  const kind = String(payload?.kind ?? 'LOCAL').trim().toUpperCase();
  const createdAt = safeIso(payload?.createdAt) ?? new Date().toISOString();
  const title = String(payload?.title ?? '').trim();
  const msg = String(payload?.message ?? '').trim();
  const dateIso = String(payload?.dateIso ?? '').trim();
  const basis = `${kind}|${createdAt}|${title}|${msg}|${dateIso}`;
  // hash simples (não-crypto) pra reduzir tamanho e evitar caracteres estranhos
  let h = 2166136261;
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `local:${kind}:${(h >>> 0).toString(16)}`;
}

function pruneNotifs24h(items: ExpertNotification[]) {
  const now = Date.now();
  return items.filter((n) => {
    const t = new Date(n.createdAt).getTime();
    if (Number.isNaN(t)) return true;
    return now - t <= NOTIF_RETENTION_MS;
  });
}

function normalizeNotif(payload: any): ExpertNotification | null {
  if (!payload) return null;

  // ✅ aceita id ausente (caso de evento local)
  const idRaw = String(payload.id ?? '').trim();
  const id = idRaw || stableIdFromPayload(payload);

  const createdAtRaw = payload.createdAt ?? new Date().toISOString();
  const createdAt =
    typeof createdAtRaw === 'string'
      ? createdAtRaw
      : createdAtRaw instanceof Date
        ? createdAtRaw.toISOString()
        : String(createdAtRaw);

  // ✅ origem
  const explicitSource = String(payload.source ?? '').toLowerCase();
  const source: 'server' | 'local' =
    explicitSource === 'local'
      ? 'local'
      : explicitSource === 'server'
        ? 'server'
        : id.startsWith('local:')
          ? 'local'
          : 'server';

  return {
    id,
    title: String(payload.title ?? 'Notificação'),
    message: String(payload.message ?? ''),
    kind: String(payload.kind ?? 'ACTIVATION'),
    dateIso: payload.dateIso ?? null,
    createdAt: safeIso(createdAt) ?? new Date().toISOString(),
    isRead: Boolean(payload.isRead ?? false),
    source,
  };
}

/* -------------------- MODO PRIVACIDADE (ocultar dados sensíveis) -------------------- */

const SENSITIVE_STORAGE_KEY = 'ui_sensitive_hidden';

function readSensitiveHiddenFromStorage(defaultValue: boolean) {
  try {
    const v = localStorage.getItem(SENSITIVE_STORAGE_KEY);
    if (v === null) return defaultValue;
    return v === '1' || v === 'true';
  } catch {
    return defaultValue;
  }
}

function writeSensitiveHiddenToStorage(v: boolean) {
  try {
    localStorage.setItem(SENSITIVE_STORAGE_KEY, v ? '1' : '0');
  } catch {}
}

function applySensitiveHiddenToDom(v: boolean) {
  try {
    document.documentElement.setAttribute('data-zi-sensitive-hidden', v ? '1' : '0');
  } catch {}
}

function ExpertShellInner({
  me,
  children,
}: {
  me: { email?: string; photoUrl?: string | null } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const nav = useMemo(
    () => [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/leads', label: 'Leads', icon: Users },
      { href: '/ativacoes', label: 'Ativações', icon: CalendarCheck2 },
      { href: '/cronograma', label: 'Cronograma', icon: CalendarDays },
    ],
    [],
  );

  const photoSrc = resolvePhotoUrl(me?.photoUrl);

  const topbarLabel =
    pathname === '/leads' || pathname.startsWith('/leads/')
      ? 'Leads'
      : pathname === '/ativacoes' || pathname.startsWith('/ativacoes/')
        ? 'Ativações'
        : pathname === '/cronograma' || pathname.startsWith('/cronograma/')
          ? 'Cronograma'
          : pathname === '/expert/profile' || pathname.startsWith('/expert/profile/')
            ? 'Perfil'
            : 'Dashboard';

  /* -------------------- NOTIFICAÇÕES (push + sino + local bridge) -------------------- */

  const socketRef = useRef<Socket | null>(null);
  const notifIdsRef = useRef<Set<string>>(new Set());

  const [notifOpen, setNotifOpen] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifs, setNotifs] = useState<ExpertNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const [toasts, setToasts] = useState<Array<{ id: string; title: string; message: string; kind?: string }>>([]);
  const toastTimers = useRef<Record<string, any>>({});

  const { hidden: sensitiveHidden, setHidden: setSensitiveHidden } = useSensitiveMode();

  useEffect(() => {
    applySensitiveHiddenToDom(sensitiveHidden);
    writeSensitiveHiddenToStorage(sensitiveHidden);
  }, [sensitiveHidden]);

  useEffect(() => {
    const v = readSensitiveHiddenFromStorage(true);
    setSensitiveHidden(v);
    applySensitiveHiddenToDom(v);

    function onStorage(e: StorageEvent) {
      if (e.key !== SENSITIVE_STORAGE_KEY) return;
      const next = e.newValue === '1' || e.newValue === 'true';
      setSensitiveHidden(next);
      applySensitiveHiddenToDom(next);
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushToast(n: ExpertNotification) {
    const id = String(n.id || Date.now());
    setToasts((prev) => [{ id, title: n.title, message: n.message, kind: n.kind }, ...prev].slice(0, 3));

    if (toastTimers.current[id]) clearTimeout(toastTimers.current[id]);
    toastTimers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete toastTimers.current[id];
    }, 180000);
  }

  function recalcUnread(list: ExpertNotification[]) {
    // ✅ unread calculado por estado (server + local)
    const u = list.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0);
    setUnread(u);
  }

  function upsertIncoming(payload: any) {
    const n0 = normalizeNotif(payload);
    if (!n0) return;

    const nowIso = new Date().toISOString();
    const n: ExpertNotification = {
      ...n0,
      // ✅ se não vier createdAt válido, garante algo
      createdAt: safeIso(n0.createdAt) ?? nowIso,
    };

    const seen = notifIdsRef.current.has(n.id);

    setNotifs((prev) => {
      const merged = (() => {
        const exists = prev.some((x) => x.id === n.id);
        const next = exists ? prev.map((x) => (x.id === n.id ? { ...x, ...n } : x)) : [n, ...prev];
        return next;
      })();

      const pruned = pruneNotifs24h(merged).slice(0, 60);

      // ✅ mantém set de IDs em sync
      notifIdsRef.current = new Set(pruned.map((x) => x.id));

      // ✅ recalcula unread (evita drift por bump)
      recalcUnread(pruned);

      return pruned;
    });

    if (!seen && !n.isRead) {
      pushToast(n);
    }

    notifIdsRef.current.add(n.id);
  }

  async function refreshNotifications(opts?: { silent?: boolean }) {
    const token = getToken();
    if (!token) return;

    try {
      if (!opts?.silent) setLoadingNotifs(true);

      const qs = new URLSearchParams();
      qs.set('take', '40');

      const res = await apiFetch<{ items: ExpertNotification[]; unreadCount: number }>(`/expert/notifications?${qs.toString()}`, {
        token,
      });

      const serverItems = (res?.items || [])
        .map((x: any) => normalizeNotif({ ...x, source: 'server' }))
        .filter(Boolean) as ExpertNotification[];

      // ✅ mantém locais atuais (que ainda estão dentro da janela de 24h)
      setNotifs((prev) => {
        const locals = prev.filter((n) => (n.source ?? (n.id.startsWith('local:') ? 'local' : 'server')) === 'local');
        const merged = pruneNotifs24h([...serverItems, ...locals]);

        // ordena desc (mais recente primeiro)
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const clipped = merged.slice(0, 60);

        notifIdsRef.current = new Set(clipped.map((x) => x.id));

        // ✅ unread: mistura (server unreadCount pode não incluir local)
        recalcUnread(clipped);

        return clipped;
      });
    } catch {
      // silencioso
    } finally {
      if (!opts?.silent) setLoadingNotifs(false);
    }
  }

  async function readOne(id: string) {
    const token = getToken();
    if (!token) return;

    const before = notifs.find((n) => n.id === id);
    if (before?.isRead) return;

    const source: 'server' | 'local' = before?.source ?? (id.startsWith('local:') ? 'local' : 'server');

    // ✅ local: marca como lido só no client
    if (source === 'local') {
      setNotifs((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
        recalcUnread(next);
        return next;
      });
      return;
    }

    try {
      await apiFetch(`/expert/notifications/${encodeURIComponent(id)}/read`, { token, method: 'PATCH' });
      setNotifs((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
        recalcUnread(next);
        return next;
      });
    } catch {
      // ✅ fallback: não trava UI — marca localmente
      setNotifs((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
        recalcUnread(next);
        return next;
      });
    }
  }

  async function readAll() {
    const token = getToken();
    if (!token) return;

    // ✅ já marca localmente (UI rápida)
    setNotifs((prev) => {
      const next = prev.map((n) => ({ ...n, isRead: true }));
      recalcUnread(next);
      return next;
    });

    try {
      await apiFetch(`/expert/notifications/read-all`, { token, method: 'PATCH' });
    } catch {
      // silencioso
    }
  }

  async function openNotifications() {
    setNotifOpen(true);
    await refreshNotifications({ silent: false });
  }

  function connectSocket() {
    const token = getToken();
    if (!token) return;

    const base = getWsBase();
    if (!base) return;

    if (socketRef.current) return;

    const s = io(`${base}/ws`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 50,
      reconnectionDelay: 700,
      timeout: 8000,
    });

    s.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[WS] connected', { id: s.id, base });
      refreshNotifications({ silent: true });
    });

    s.on('connect_error', (err: any) => {
      // eslint-disable-next-line no-console
      console.error('[WS] connect_error', err?.message || err, { base, data: err?.data });
    });

    s.on('disconnect', (reason: any) => {
      // eslint-disable-next-line no-console
      console.warn('[WS] disconnected', reason);
    });

    s.on('notification', (payload: any) => {
      upsertIncoming({ ...payload, source: 'server' });
    });

    s.on('notification:unread', (payload: any) => {
      // ✅ mantém compat com servidor, mas evita drift: atualiza "unread" só se painel fechado e não tiver notifs carregadas
      const bump = Number(payload?.bump ?? 0);
      if (Number.isFinite(bump) && bump > 0) {
        // não incrementa cegamente se já temos lista (pra não driftar)
        setUnread((u) => u + bump);
      }
    });

    socketRef.current = s;
  }

  /* -------------------- ✅ bridge: evento local do cronograma -------------------- */
  useEffect(() => {
    function onLocalNotif(e: any) {
      const payload = e?.detail ?? null;
      if (!payload) return;

      // força origem local
      upsertIncoming({ ...payload, source: 'local' });
    }

    window.addEventListener('expert-notification', onLocalNotif as any);
    return () => window.removeEventListener('expert-notification', onLocalNotif as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------- ✅ prune periódico (24h) -------------------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      setNotifs((prev) => {
        const next = pruneNotifs24h(prev);
        if (next.length !== prev.length) {
          notifIdsRef.current = new Set(next.map((x) => x.id));
          recalcUnread(next);
        }
        return next;
      });
    }, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    clearToken();
    try {
      socketRef.current?.disconnect();
    } catch {}
    socketRef.current = null;
    router.replace('/login');
  }

  useEffect(() => {
    refreshNotifications({ silent: true });
    connectSocket();

    return () => {
      const timers = toastTimers.current;
      Object.keys(timers).forEach((k) => {
        try {
          clearTimeout(timers[k]);
        } catch {}
      });
      toastTimers.current = {};

      try {
        socketRef.current?.disconnect();
      } catch {}
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!notifOpen) return;
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest('[data-notif-panel="1"]')) return;
      setNotifOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [notifOpen]);

  return (
    <div className="min-h-screen text-white">
      <style jsx global>{`
        body {
          background: #070a12;
        }

        /* ✅ Sidebar fixa (layout não mexe) + overlay expandindo por cima */
        .zi-railSlot {
          width: 88px; /* largura fixa do "slot" no layout */
        }

        .zi-railOverlay {
          width: 88px;
          transition: width 220ms ease;
          will-change: width;
        }

        .zi-railOverlay:hover {
          width: 312px; /* abre por cima do conteúdo */
        }

        /* ✅ labels: aparecem só depois que a sidebar já abriu (evita quebrar texto no meio do resize) */
        .zi-rail__label {
          opacity: 0;
          transform: translateX(-6px);
          transition: opacity 160ms ease, transform 160ms ease;
          transition-delay: 0ms;
          white-space: nowrap;
        }

        .zi-railOverlay:hover .zi-rail__label {
          opacity: 1;
          transform: translateX(0);
          transition-delay: 140ms; /* 👈 evita wrap/desformatar durante o hover */
        }

        .zi-rail__brandText {
          opacity: 0;
          transform: translateX(-6px);
          transition: opacity 160ms ease, transform 160ms ease;
          transition-delay: 0ms;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }

        .zi-railOverlay:hover .zi-rail__brandText {
          opacity: 1;
          transform: translateX(0);
          transition-delay: 140ms; /* 👈 mesmo truque do label */
        }

        .zi-brandTitle,
        .zi-brandSub {
          white-space: nowrap;
        }

        *::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        *::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          border: 2px solid rgba(0, 0, 0, 0.25);
        }
        *::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.18);
        }
        *::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
        }

        ::selection {
          background: rgba(106, 92, 255, 0.35);
          color: rgba(255, 255, 255, 0.95);
        }

        /* ✅ MODO PRIVACIDADE (aplicado pelo atributo no <html>) */
        html[data-zi-sensitive-hidden='1'] .zi-sensitive {
          filter: blur(10px);
          user-select: none;
          pointer-events: none;
        }
        html[data-zi-sensitive-hidden='1'] .zi-sensitive::selection {
          background: transparent;
        }

        html[data-zi-sensitive-hidden='1'] .zi-sensitive-badge {
          filter: blur(8px);
          user-select: none;
          pointer-events: none;
        }

        /* ====== ✅ MÁSCARA •••• (override do blur) ====== */
        html[data-zi-sensitive-hidden='1'] .zi-sensitive {
          filter: none !important;
          color: transparent !important;
          text-shadow: none !important;
          position: relative !important;
          display: inline-block !important;
          user-select: none;
          pointer-events: none;
          white-space: nowrap;
        }

        html[data-zi-sensitive-hidden='1'] .zi-sensitive::after {
          content: '••••••';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          color: rgba(255, 255, 255, 0.88);
          letter-spacing: 1px;
          pointer-events: none;
        }

        html[data-zi-sensitive-hidden='1'] .zi-sensitive-badge {
          filter: none !important;
          color: transparent !important;
          text-shadow: none !important;
          position: relative !important;
          display: inline-block !important;
          user-select: none;
          pointer-events: none;
          white-space: nowrap;
        }

        html[data-zi-sensitive-hidden='1'] .zi-sensitive-badge::after {
          content: '••••';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          color: rgba(255, 255, 255, 0.88);
          letter-spacing: 1px;
          pointer-events: none;
        }

        button:focus-visible,
        a:focus-visible,
        select:focus-visible,
        input:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(106, 92, 255, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          border-color: rgba(255, 255, 255, 0.22) !important;
        }
      `}</style>

      <div className="relative min-h-screen">
        {/* ✅ SLOT FIXO NO LAYOUT (não cresce) */}
        <div className="zi-railSlot" aria-hidden="true" />

        {/* ✅ SIDEBAR OVERLAY FIXA (expande por cima do conteúdo, sem empurrar) */}
        <aside className="fixed left-0 top-0 bottom-0 z-[80]">
          <div
            className={cx(
              'zi-railOverlay h-full overflow-hidden',
              'border-r border-white/10',
              'bg-gradient-to-b from-[#0E1430]/85 via-[#090C18]/85 to-[#070A12]/90',
              'backdrop-blur-xl',
              'shadow-[0_30px_120px_rgba(0,0,0,0.55)]',
              'relative',
            )}
          >
            {/* glows dentro da sidebar */}
            <div
              className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 opacity-60 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(106, 92, 255, 0.35), transparent 60%)' }}
            />
            <div
              className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 opacity-50 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(62, 120, 255, 0.28), transparent 60%)' }}
            />

            {/* conteúdo sidebar */}
            <div className="h-full flex flex-col py-4 px-3 relative">
              {/* Top row: Brand + Sair em cima */}
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className={cx(
                    'flex-1 h-12 rounded-2xl border border-white/10 bg-white/[0.03]',
                    'flex items-center gap-3 px-3',
                    'hover:bg-white/[0.06] hover:border-white/20 transition',
                    'shadow-[0_18px_70px_rgba(0,0,0,0.40)]',
                  )}
                  title="Ir para Dashboard"
                >
                  {/* ✅ Logo sem container/borda (só a imagem) */}
                  <div className="h-9 w-9 grid place-items-center overflow-hidden">
                    <Image src="/logozonainvest.png" alt="Zona Invest" width={36} height={36} className="object-contain" priority />
                  </div>

                  <div className="zi-rail__brandText">
                    <div className="zi-brandTitle text-white/92 text-sm font-semibold leading-tight">Zona Invest</div>
                    <div className="zi-brandSub text-white/45 text-xs -mt-0.5">Expert Panel</div>
                  </div>
                </Link>

                <button
                  onClick={logout}
                  title="Sair"
                  className={cx(
                    'h-12 w-12 rounded-2xl border',
                    'border-red-500/25 bg-red-500/5 hover:bg-red-500/12 transition-colors',
                    'grid place-items-center',
                    'shadow-[0_18px_70px_rgba(0,0,0,0.35)]',
                    'shrink-0',
                  )}
                >
                  <LogOut className="h-5 w-5 text-red-200" />
                </button>
              </div>

              {/* Quando expandir, aparece o texto "Sair" como linha (opcional) */}
              <button
                onClick={logout}
                type="button"
                className={cx(
                  'mt-2 w-full h-10 rounded-2xl border',
                  'border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors',
                  'flex items-center gap-3 px-3',
                  'hidden',
                )}
              >
                <div className="h-8 w-8 rounded-xl border border-red-500/20 bg-red-500/10 grid place-items-center">
                  <LogOut className="h-4 w-4 text-red-200" />
                </div>
                <span className="zi-rail__label text-sm font-medium text-red-100">Sair</span>
              </button>

              {/* Nav */}
              <div className="mt-5 space-y-2">
                {nav.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cx(
                        'relative w-full h-12 rounded-2xl border',
                        'flex items-center gap-3 px-3',
                        'transition-all duration-200',
                        active
                          ? 'border-white/25 bg-gradient-to-r from-[#6A5CFF]/20 to-[#3E78FF]/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15',
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span
                        className={cx(
                          'absolute left-0 top-2 bottom-2 w-[3px] rounded-full',
                          active ? 'bg-gradient-to-b from-[#6A5CFF] to-[#3E78FF]' : 'bg-transparent',
                        )}
                        aria-hidden="true"
                      />

                      <div
                        className={cx(
                          'h-9 w-9 rounded-xl border grid place-items-center',
                          active ? 'border-white/15 bg-white/[0.05] text-white/92' : 'border-white/10 bg-white/[0.03] text-white/78',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <span className={cx('zi-rail__label text-sm font-medium', active ? 'text-white/92' : 'text-white/78')}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="flex-1" />
            </div>
          </div>
        </aside>

        {/* MAIN (fica estático; só tem “padding-left” do slot fixo 88px) */}
        <div className="min-h-screen pl-[88px]">
          {/* Topbar */}
          <header className="sticky top-0 z-30">
            <div className="relative border-b border-white/10 bg-black/30 backdrop-blur-xl">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-70"
                style={{
                  background:
                    'radial-gradient(900px 90px at 55% 30%, rgba(106,92,255,0.20), transparent 60%), radial-gradient(800px 100px at 15% 10%, rgba(62,120,255,0.14), transparent 60%)',
                }}
              />
              <div className="relative h-16 px-6 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-white/92 font-semibold tracking-tight leading-tight">{topbarLabel}</div>
                  <div className="text-white/45 text-xs mt-0.5 truncate">Visão geral • métricas e atividade</div>
                </div>

                <div className="flex items-center gap-3 relative">
                  {false ? (
                    <button
                      type="button"
                      onClick={() => setSensitiveHidden(!sensitiveHidden)}
                      className={cx(
                        'h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03]',
                        'hover:bg-white/[0.06] hover:border-white/20 transition grid place-items-center',
                      )}
                      title={sensitiveHidden ? 'Mostrar dados sensíveis' : 'Ocultar dados sensíveis'}
                      aria-label={sensitiveHidden ? 'Mostrar dados sensíveis' : 'Ocultar dados sensíveis'}
                    >
                      {sensitiveHidden ? <EyeOff className="h-5 w-5 text-white/80" /> : <Eye className="h-5 w-5 text-white/80" />}
                      <span className="sr-only">{sensitiveHidden ? 'Mostrar dados sensíveis' : 'Ocultar dados sensíveis'}</span>
                    </button>
                  ) : null}

                  <SensitiveToggleIconButton
                    className={cx(
                      'h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03]',
                      'hover:bg-white/[0.06] hover:border-white/20 transition grid place-items-center',
                    )}
                    iconOn={<Eye className="h-5 w-5 text-white/80" />}
                    iconOff={<EyeOff className="h-5 w-5 text-white/80" />}
                    titleOn="Ocultar dados sensíveis"
                    titleOff="Mostrar dados sensíveis"
                    ariaLabelOn="Ocultar dados sensíveis"
                    ariaLabelOff="Mostrar dados sensíveis"
                  />

                  {/* Notificações */}
                  <div className="relative" data-notif-panel="1">
                    <button
                      type="button"
                      onClick={() => (notifOpen ? setNotifOpen(false) : void openNotifications())}
                      className={cx(
                        'h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03]',
                        'hover:bg-white/[0.06] hover:border-white/20 transition grid place-items-center',
                      )}
                      title="Notificações"
                      aria-label="Notificações"
                    >
                      <Bell className="h-5 w-5 text-white/80" />
                      {unread > 0 ? (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-[11px] font-semibold grid place-items-center text-white shadow">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      ) : null}
                    </button>

                    {notifOpen ? (
                      <div
                        className={cx(
                          'absolute right-0 mt-2 w-[360px] max-w-[86vw]',
                          'rounded-2xl border border-white/10 overflow-hidden',
                          'bg-[#0B1022]/95 backdrop-blur-xl',
                          'shadow-[0_30px_120px_rgba(0,0,0,0.70)]',
                        )}
                      >
                        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-white/90 font-semibold">Notificações</div>
                            <div className="text-white/45 text-xs mt-0.5">{unread > 0 ? `${unread} não lida(s)` : 'Tudo em dia'}</div>
                          </div>

                          <button
                            type="button"
                            onClick={readAll}
                            className={cx(
                              'h-9 px-3 rounded-xl border border-white/10',
                              'bg-white/[0.03] hover:bg-white/[0.06] transition',
                              'text-white/80 text-xs font-medium',
                              unread <= 0 && 'opacity-40 pointer-events-none',
                            )}
                            title="Marcar tudo como lido"
                          >
                            Ler tudo
                          </button>
                        </div>

                        <div className="max-h-[420px] overflow-auto">
                          {loadingNotifs ? (
                            <div className="p-4 text-white/55 text-sm">Carregando…</div>
                          ) : notifs.length ? (
                            notifs.map((n) => (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => readOne(n.id)}
                                className={cx('w-full text-left px-4 py-3 border-b border-white/10 last:border-b-0', 'hover:bg-white/[0.04] transition')}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className={cx('font-semibold truncate zi-sensitive', n.isRead ? 'text-white/80' : 'text-white/95')}>
                                      {n.title}
                                    </div>

                                    <div className={cx('mt-1 text-sm whitespace-pre-wrap zi-sensitive', n.isRead ? 'text-white/55' : 'text-white/70')}>
                                      {n.message}
                                    </div>

                                    <div className="mt-2 text-white/40 text-xs">
                                      {dateLabel(n.createdAt)} • {timeLabel(n.createdAt)}
                                      {n.source === 'local' ? <span className="ml-2 text-white/35">• local</span> : null}
                                    </div>
                                  </div>

                                  {!n.isRead ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#6A5CFF]" aria-hidden="true" /> : null}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-white/55 text-sm">Nenhuma notificação.</div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* User */}
                  <div className="hidden md:block text-right min-w-0">
                    <div className="text-white/80 text-sm font-medium truncate max-w-[360px] zi-sensitive">{me?.email ?? ''}</div>
                    <div className="text-white/45 text-xs flex items-center justify-end gap-2">
                      <span>Conta Expert</span>
                      <span className="text-white/25">•</span>
                      <Link
                        href="/expert/profile"
                        className="text-white/70 hover:text-white/90 underline-offset-4 hover:underline transition"
                        title="Abrir meu perfil"
                      >
                        Meu perfil
                      </Link>
                    </div>
                  </div>

                  <Link href="/expert/profile" title="Abrir meu perfil" className="block">
                    {photoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoSrc}
                        alt="Foto do expert"
                        className="h-9 w-9 rounded-2xl object-cover border border-white/10 hover:border-white/20 transition"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/[0.03] grid place-items-center text-white/85 text-xs font-semibold hover:bg-white/[0.06] hover:border-white/20 transition">
                        {initials(me?.email)}
                      </div>
                    )}
                  </Link>
                </div>
              </div>
            </div>
          </header>

          {/* TOASTS */}
          {toasts.length ? (
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
              {toasts.map((t) => {
                const isActivation = String(t.kind || '').toUpperCase() === 'ACTIVATION';
                const isReminder = String(t.kind || '').toUpperCase().includes('REMINDER');

                return (
                  <div
                    key={t.id}
                    className={cx(
                      'pointer-events-auto relative',
                      'w-[420px] max-w-[92vw]',
                      'rounded-2xl border overflow-hidden',
                      'shadow-[0_30px_120px_rgba(0,0,0,0.70)]',
                      'bg-[#0B1022]/92 backdrop-blur-xl border-white/10',
                      isActivation && 'border-[#6A5CFF]/35',
                      isReminder && 'border-[#3E78FF]/30',
                    )}
                  >
                    <div className={cx('absolute left-0 top-0 bottom-0 w-[6px]', isActivation ? 'bg-[#6A5CFF]' : isReminder ? 'bg-[#3E78FF]' : 'bg-white/20')} />

                    <div className="relative pl-5 pr-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {isActivation ? (
                            <div className="inline-flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#6A5CFF]/20 text-[#C9C3FF] border border-[#6A5CFF]/25">
                                ATIVAÇÃO
                              </span>
                              <span className="text-[11px] text-white/45">Evento</span>
                            </div>
                          ) : isReminder ? (
                            <div className="inline-flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#3E78FF]/18 text-[#BBD3FF] border border-[#3E78FF]/22">
                                LEMBRETE
                              </span>
                              <span className="text-[11px] text-white/45">Cronograma</span>
                            </div>
                          ) : null}

                          <div className={cx('text-white/95 font-semibold leading-tight zi-sensitive', isActivation && 'text-white')}>{t.title}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                          className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center text-white/70 hover:text-white/90"
                          title="Fechar"
                        >
                          ×
                        </button>
                      </div>

                      <div className={cx('mt-2 text-sm whitespace-pre-wrap zi-sensitive', isActivation ? 'text-white/75' : 'text-white/70')}>{t.message}</div>

                      {isActivation ? (
                        <div
                          className="pointer-events-none absolute -inset-10 opacity-60 blur-2xl"
                          style={{
                            background:
                              'radial-gradient(circle at 70% 20%, rgba(106,92,255,0.35), transparent 55%), radial-gradient(circle at 20% 80%, rgba(106,92,255,0.18), transparent 55%)',
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Content */}
          <main className="px-6 py-6">
            <div className="w-full max-w-[1680px] mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function ExpertShell({
  me,
  children,
}: {
  me: { email?: string; photoUrl?: string | null } | null;
  children: React.ReactNode;
}) {
  return (
    <SensitiveModeProvider>
      <ExpertShellInner me={me} children={children} />
    </SensitiveModeProvider>
  );
}
