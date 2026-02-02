'use client';

import React from 'react';
import { useSensitiveMode } from './SensitiveMode';

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function EyeIcon({ off }: { off: boolean }) {
  // off=true -> "olho cortado"
  if (off) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M10.6 10.7a2.6 2.6 0 0 0 3.7 3.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18.7 18.7 0 0 1-4.1 5.1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M6.1 6.5C3.7 8.5 2 12 2 12s3.5 7 10 7c1 0 2-.2 2.9-.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function SensitiveToggle({
  className,
  labelOn = 'Ocultar dados',
  labelOff = 'Mostrar dados',
}: {
  className?: string;
  labelOn?: string;
  labelOff?: string;
}) {
  const { hidden, toggle } = useSensitiveMode();

  return (
    <button
      type="button"
      onClick={toggle}
      className={cx(
        'h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition',
        'text-white/80 text-sm inline-flex items-center gap-2',
        className,
      )}
      title={hidden ? labelOff : labelOn}
      aria-pressed={!hidden}
      aria-label={hidden ? labelOff : labelOn}
    >
      <span className={cx(hidden ? 'text-white/75' : 'text-white/90')}>{hidden ? 'Oculto' : 'Visível'}</span>
      <span className="text-white/80">
        <EyeIcon off={hidden} />
      </span>
    </button>
  );
}
