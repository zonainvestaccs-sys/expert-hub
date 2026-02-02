'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type SensitiveModeCtx = {
  hidden: boolean;
  toggle: () => void;
  setHidden: (v: boolean) => void;
};

const Ctx = createContext<SensitiveModeCtx | null>(null);

const STORAGE_KEY = 'ui_sensitive_hidden';

export function SensitiveModeProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === '1') setHidden(true);
      if (raw === '0') setHidden(false);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0');
    } catch {}
  }, [hidden]);

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

/** Ícone olho / olho cortado (sem libs) */
export function EyeIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="inline-block">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M10.6 10.6a2.7 2.7 0 0 0 3.8 3.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M7.1 7.1C4.7 8.6 3.1 11 2.4 12c.7 1 2.6 3.9 6.1 5.4 1.2.5 2.4.7 3.5.7 1 0 2-.2 3-.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.9 5.1c.7-.1 1.4-.2 2.1-.2 5.2 0 9.3 4.3 9.6 7.1-.2.9-1.1 2.6-2.7 4.1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="inline-block">
      <path
        d="M2.4 12c1.2-2.3 4.4-7.1 9.6-7.1s8.4 4.8 9.6 7.1c-1.2 2.3-4.4 7.1-9.6 7.1S3.6 14.3 2.4 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Botão de toggle reutilizável */
export function SensitiveToggleButton({ className }: { className?: string }) {
  const { hidden, toggle } = useSensitiveMode();

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        'h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm font-medium inline-flex items-center gap-2'
      }
      title={hidden ? 'Mostrar dados' : 'Ocultar dados'}
      aria-label={hidden ? 'Mostrar dados' : 'Ocultar dados'}
    >
      <EyeIcon off={hidden} />
      {hidden ? 'Oculto' : 'Visível'}
    </button>
  );
}

/**
 * Wrapper: se hidden=true -> mascara ou blur.
 * - mode="mask": substitui por •••
 * - mode="blur": mantém texto mas aplica blur (bom pra não mudar layout)
 */
export function Sensitive({
  children,
  placeholder = '••••',
  mode = 'mask',
  className,
}: {
  children: React.ReactNode;
  placeholder?: string;
  mode?: 'mask' | 'blur';
  className?: string;
}) {
  const { hidden } = useSensitiveMode();

  if (!hidden) return <span className={className}>{children}</span>;

  if (mode === 'blur') {
    return (
      <span className={className} style={{ filter: 'blur(6px)', userSelect: 'none' }}>
        {children}
      </span>
    );
  }

  return (
    <span className={className} style={{ userSelect: 'none' }}>
      {placeholder}
    </span>
  );
}
