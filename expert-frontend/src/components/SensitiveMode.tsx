'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type SensitiveModeCtx = {
  hidden: boolean;
  toggle: () => void;
  setHidden: (v: boolean) => void;
};

const Ctx = createContext<SensitiveModeCtx | null>(null);

/**
 * ✅ Mantém a mesma chave que você já usa no ExpertShell
 * (assim não quebra o “persistir no F5” de quem já tem valor salvo)
 */
const STORAGE_KEY = 'zi_sensitive_hidden';

/**
 * ✅ Evento customizado para sincronizar na MESMA aba
 * (storage NÃO dispara na mesma aba)
 */
const EVENT_KEY = 'zi_sensitive_hidden_change';

function readHidden(defaultValue: boolean) {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return defaultValue;
    return v === '1' || v === 'true';
  } catch {
    return defaultValue;
  }
}

function applyToDom(v: boolean) {
  try {
    document.documentElement.setAttribute('data-zi-sensitive-hidden', v ? '1' : '0');
  } catch {}
}

function writeHidden(v: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
  } catch {}

  // ✅ avisa a mesma aba
  try {
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: { value: v } }));
  } catch {}
}

export function SensitiveModeProvider({ children }: { children: React.ReactNode }) {
  // ✅ default no expert: oculto
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return readHidden(true);
  });

  // mount: aplica no DOM imediatamente
  useEffect(() => {
    applyToDom(hidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // quando muda: salva + aplica + emite evento
  useEffect(() => {
    applyToDom(hidden);
    writeHidden(hidden);
  }, [hidden]);

  // listeners: outras abas (storage) + mesma aba (event)
  useEffect(() => {
    function setIfChanged(next: boolean) {
      setHidden((prev) => (prev === next ? prev : next));
      applyToDom(next);
    }

    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue === '1' || e.newValue === 'true';
      setIfChanged(next);
    }

    function onLocalEvent(e: any) {
      const next = Boolean(e?.detail?.value);
      setIfChanged(next);
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener(EVENT_KEY as any, onLocalEvent);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVENT_KEY as any, onLocalEvent);
    };
  }, []);

  const value = useMemo<SensitiveModeCtx>(
    () => ({
      hidden,
      toggle: () => setHidden((v) => !v),
      setHidden,
    }),
    [hidden],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSensitiveMode() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSensitiveMode must be used within SensitiveModeProvider');
  return v;
}

/**
 * ✅ Botão de toggle REUTILIZÁVEL (no expert: só ícone)
 * Você pode passar os ícones do lucide (Eye / EyeOff) por props.
 */
export function SensitiveToggleIconButton({
  className,
  iconOn,
  iconOff,
  titleOn = 'Ocultar dados sensíveis',
  titleOff = 'Mostrar dados sensíveis',
  ariaLabelOn = 'Ocultar dados sensíveis',
  ariaLabelOff = 'Mostrar dados sensíveis',
}: {
  className?: string;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
  titleOn?: string;
  titleOff?: string;
  ariaLabelOn?: string;
  ariaLabelOff?: string;
}) {
  const { hidden, toggle } = useSensitiveMode();

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        'h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition grid place-items-center'
      }
      title={hidden ? titleOff : titleOn}
      aria-label={hidden ? ariaLabelOff : ariaLabelOn}
    >
      {hidden ? iconOff : iconOn}
      <span className="sr-only">{hidden ? ariaLabelOff : ariaLabelOn}</span>
    </button>
  );
}
