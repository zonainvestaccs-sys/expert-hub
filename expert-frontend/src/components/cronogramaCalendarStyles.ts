// src/components/cronogramaCalendarStyles.ts
export const ZI_FC_CSS = `
/* ===========================
   FullCalendar Skin (Performance)
   =========================== */

.fc {
  --zi-text: rgba(255,255,255,0.92);
  --zi-text-2: rgba(255,255,255,0.68);
  --zi-border: rgba(255,255,255,0.10);
  --zi-surface: rgba(11,16,34,0.72);
  --zi-surface-2: rgba(11,16,34,0.42);

  /* ✅ header escuro (antes estava claro demais) */
  --zi-header: rgba(11,16,34,0.92);

  --zi-today: rgba(106,92,255,0.14);

  width: 100%;
  font-family: inherit;
  color: var(--zi-text);
  user-select: none;
  contain: layout paint style;
}

.fc, .fc *, .fc *::before, .fc *::after { box-sizing: border-box; }
.fc a { color: inherit; text-decoration: none; }
.fc button { font: inherit; color: inherit; }
.fc table { border-collapse: collapse; width: 100%; }

.fc th, .fc td {
  border: 1px solid var(--zi-border);
  vertical-align: top;
}

.fc .fc-scrollgrid {
  border: 1px solid var(--zi-border);
  border-radius: 18px;
  overflow: hidden;
  background: var(--zi-surface);
  box-shadow: 0 18px 70px rgba(0,0,0,0.45);
}

.fc .fc-scroller {
  overflow: auto !important;
  -webkit-overflow-scrolling: touch;
}

/* ✅ Header backgrounds (month/week/day headers) */
.fc .fc-col-header,
.fc .fc-col-header-cell,
.fc .fc-timegrid-header,
.fc .fc-timegrid-col-header,
.fc .fc-timegrid-col-header-cushion,
.fc .fc-scrollgrid-section-header > *,
.fc .fc-scrollgrid-section-header,
.fc .fc-scrollgrid-section-header td,
.fc .fc-scrollgrid-section-header th {
  background: var(--zi-header) !important;
}

/* ✅ remove qualquer “clareamento” padrão */
.fc .fc-theme-standard .fc-scrollgrid,
.fc .fc-theme-standard td,
.fc .fc-theme-standard th {
  border-color: var(--zi-border) !important;
}

/* header text */
.fc .fc-col-header-cell-cushion,
.fc .fc-timegrid-col-header-cushion {
  display: block;
  padding: 10px 8px !important;
  font-size: 12px !important;
  font-weight: 900 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  color: rgba(255,255,255,0.72) !important;
  text-shadow: 0 1px 0 rgba(0,0,0,0.25);
}

/* ===== DayGrid ===== */
.fc .fc-daygrid-day-frame {
  position: relative;
  min-height: 118px;
  padding: 8px !important;
  background: rgba(255,255,255,0.02);
}

.fc .fc-daygrid-day-number {
  padding: 10px 10px 6px !important;
  font-weight: 900 !important;
  color: rgba(255,255,255,0.92) !important;
}

.fc .fc-daygrid-day-frame::before {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.10);
  background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012));
  pointer-events: none;
}

.fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-frame::before {
  border-color: rgba(106,92,255,0.38);
  background: linear-gradient(180deg, rgba(106,92,255,0.20), rgba(255,255,255,0.02));
}

/* ===== TimeGrid ===== */
.fc .fc-timegrid-axis {
  width: 62px !important;

  /* ✅ eixo de horas também escuro */
  background: var(--zi-header) !important;
}

.fc .fc-timegrid-slot-label,
.fc .fc-timegrid-axis-cushion {
  color: rgba(255,255,255,0.70) !important;
  font-weight: 900 !important;
}

.fc .fc-timegrid-slot {
  height: 46px !important;
  border-top: 1px solid rgba(255,255,255,0.08) !important;
  background: transparent;
}

.fc .fc-timegrid-slot-lane,
.fc .fc-timegrid-col {
  border-color: rgba(255,255,255,0.08) !important;
}

.fc .fc-timegrid-now-indicator-line {
  border-color: rgba(106,92,255,0.95) !important;
  box-shadow: 0 0 0 1px rgba(106,92,255,0.15);
}
.fc .fc-timegrid-now-indicator-arrow { border-color: rgba(106,92,255,0.95) !important; }

.fc .fc-highlight { background: rgba(62,120,255,0.14) !important; }

/* ===== Eventos (reduz paint) ===== */
.fc .fc-event {
  border-radius: 14px !important;
  border: 1px solid rgba(255,255,255,0.16) !important;
  box-shadow: 0 14px 45px rgba(0,0,0,0.50) !important;
  padding: 3px 8px !important;
  cursor: pointer !important;
  overflow: hidden !important;
  transition: transform 120ms ease, filter 120ms ease !important;
  will-change: transform;
}

.fc .fc-event:hover {
  transform: translate3d(0,-1px,0) !important;
  filter: brightness(1.03) saturate(1.05) !important;
}

.fc .fc-event-title { font-weight: 900 !important; line-height: 1.15 !important; }
.fc .fc-event-time { font-weight: 900 !important; color: rgba(255,255,255,0.92) !important; }

.fc .zi-fc-selected {
  outline: 2px solid rgba(106,92,255,0.55) !important;
  box-shadow: 0 18px 70px rgba(106,92,255,0.20) !important;
}

/* ===== Popover ===== */
.fc .fc-popover {
  background: rgba(11,16,34,0.92) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  border-radius: 16px !important;
  overflow: hidden !important;
  box-shadow: 0 26px 110px rgba(0,0,0,0.70) !important;
}
.fc .fc-popover-header {
  background: rgba(255,255,255,0.04) !important;
  border-bottom: 1px solid rgba(255,255,255,0.10) !important;
  color: rgba(255,255,255,0.90) !important;
  font-weight: 900 !important;
}

/* ===== Tooltip flutuante (GPU-friendly) ===== */
.zi-fcHover {
  position: fixed;
  z-index: 999999;
  width: 340px;
  max-width: calc(100vw - 24px);
  pointer-events: none;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(11,16,34,0.92);
  box-shadow: 0 40px 160px rgba(0,0,0,0.70);
  overflow: hidden;
  will-change: transform;
  transform: translate3d(-9999px,-9999px,0);
}

.zi-fcHover__bar { height: 6px; width: 100%; }
.zi-fcHover__body { padding: 14px 14px 12px; }

.zi-fcHover__title {
  color: rgba(255,255,255,0.92);
  font-weight: 900;
  line-height: 1.15;
  font-size: 14px;
  margin: 0;
}

.zi-fcHover__meta {
  margin-top: 8px;
  display: grid;
  gap: 6px;
  color: rgba(255,255,255,0.68);
  font-size: 12px;
  line-height: 1.25;
}
.zi-fcHover__row { display: flex; align-items: flex-start; gap: 8px; }
.zi-fcHover__icon { margin-top: 1px; opacity: 0.55; flex: 0 0 auto; }

.zi-fcHover__desc {
  margin-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.10);
  padding-top: 10px;
  color: rgba(255,255,255,0.68);
  font-size: 12px;
  line-height: 1.35;
  white-space: pre-wrap;
  max-height: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== App background (fix jank: fixed + no huge repaint) ===== */
.ziCalendarApp {
  color-scheme: dark;
  position: relative;
}

.ziCalendarApp::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(900px 520px at 20% 10%, rgba(106, 92, 255, 0.22), transparent 60%),
    radial-gradient(780px 520px at 78% 18%, rgba(62, 120, 255, 0.16), transparent 58%),
    radial-gradient(820px 520px at 55% 82%, rgba(20, 184, 166, 0.10), transparent 60%),
    radial-gradient(900px 700px at 50% 50%, rgba(0, 0, 0, 0.60), rgba(0, 0, 0, 0.82));
}

/* Scrollbar (mais leve) */
.fc *::-webkit-scrollbar { width: 10px; height: 10px; }
.fc *::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
  border-radius: 999px;
  border: 2px solid rgba(0,0,0,0.25);
}
.fc *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
.fc *::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
`;
