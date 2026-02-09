'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, fetchMe, getToken } from '@/lib/auth';
import { SensitiveModeProvider, useSensitiveMode, EyeIcon, Sensitive } from '@/components/SensitiveMode';

type Me = { id: string; email: string; role: 'ADMIN' | 'EXPERT' };

const BRAND = {
  name: 'Zona Invest',
  subtitle: 'Admin Panel',
};

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(' ');
}

function IconDashboard(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M4 13h7V4H4v9Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 20h7V11h-7v9Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 9h7V4h-7v5Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 20h7v-5H4v5Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconExperts(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4 20c1.8-3 5-5 8-5s6.2 2 8 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCalendar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M8 3v3M16 3v3M4.5 9.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M6.5 5.5h11A3 3 0 0 1 20.5 8.5v11A3 3 0 0 1 17.5 22.5h-11A3 3 0 0 1 3.5 19.5v-11A3 3 0 0 1 6.5 5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7.5 12h3.2M13 12h3.5M7.5 16h3.2M13 16h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** ✅ NOVO: Ícone de Utilidade */
function IconUtilities(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M10 4h10v8H10V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M4 12h10v8H4v-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7 15h4M7 17h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13 7h4M13 9h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLogout(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M10 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M4 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M7 9l-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BrandMark() {
  return (
    <div
      className={cx(
        'h-11 w-11 rounded-2xl border border-white/10',
        'bg-gradient-to-br from-[#3E78FF]/25 via-white/[0.06] to-[#6A5CFF]/20',
        'shadow-[0_24px_90px_rgba(62,120,255,0.18)]',
      )}
    />
  );
}

function BurgerIcon() {
  return (
    <div className="grid gap-1.5">
      <span className="block h-[2px] w-5 rounded-full bg-white/80" />
      <span className="block h-[2px] w-5 rounded-full bg-white/80" />
      <span className="block h-[2px] w-5 rounded-full bg-white/80" />
    </div>
  );
}

/** ✅ Botão compacto do “olho” (só ícone) */
function EyeToggleCompact() {
  const { hidden, toggle } = useSensitiveMode();

  return (
    <button
      type="button"
      onClick={toggle}
      className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center text-white/85"
      title={hidden ? 'Mostrar dados' : 'Ocultar dados'}
      aria-label={hidden ? 'Mostrar dados' : 'Ocultar dados'}
    >
      <EyeIcon off={hidden} />
    </button>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = getToken();
        if (!token) {
          router.replace('/login');
          return;
        }

        const m = await fetchMe(token);
        if (!alive) return;

        if (m?.role !== 'ADMIN') {
          clearToken();
          router.replace('/login');
          return;
        }

        setMe(m);
      } catch {
        clearToken();
        router.replace('/login');
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    // ao navegar fecha drawer mobile
    setMobileOpen(false);
  }, [pathname]);

  const nav = useMemo(
    () => [
      { href: '/admin/dashboard', alt: '/admin', label: 'Dashboard', icon: IconDashboard },
      { href: '/admin/experts', label: 'Experts', icon: IconExperts },
      { href: '/admin/cronogramas', label: 'Cronogramas', icon: IconCalendar }, // ✅ NOVO
      { href: '/admin/utilidades', label: 'Utilidade', icon: IconUtilities }, // ✅ NOVO: Aba Utilidade
    ],
    [],
  );

  function isActive(item: { href: string; alt?: string }) {
    if (pathname === item.href) return true;
    if (item.alt && pathname === item.alt) return true;
    if (pathname?.startsWith(item.href + '/')) return true;
    return false;
  }

  const title =
    pathname === '/admin' || pathname === '/admin/dashboard'
      ? 'Dashboard'
      : pathname?.startsWith('/admin/experts')
        ? 'Experts'
        : pathname?.startsWith('/admin/cronogramas')
          ? 'Cronogramas'
          : pathname?.startsWith('/admin/utilidades')
            ? 'Utilidade'
            : 'Admin';

  if (checking) {
    return (
      <SensitiveModeProvider>
        <div className="min-h-screen text-white">
          <div
            className="min-h-screen flex items-center justify-center"
            style={{
              background:
                'radial-gradient(900px 260px at 60% 12%, rgba(62,120,255,0.22), transparent 60%), radial-gradient(800px 260px at 20% 18%, rgba(106,92,255,0.18), transparent 60%), #070A14',
            }}
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 shadow-[0_26px_90px_rgba(0,0,0,0.55)]">
              <div className="text-sm text-white/80">Carregando painel…</div>
            </div>
          </div>
        </div>
      </SensitiveModeProvider>
    );
  }

  return (
    <SensitiveModeProvider>
      <div className="min-h-screen text-white">
        <div
          className="min-h-screen"
          style={{
            background:
              'radial-gradient(900px 260px at 60% 12%, rgba(62,120,255,0.22), transparent 60%), radial-gradient(800px 260px at 20% 18%, rgba(106,92,255,0.18), transparent 60%), #070A14',
          }}
        >
          {/* ======= MOBILE TOP BAR ======= */}
          <div className="lg:hidden sticky top-0 z-40 border-b border-white/10 bg-[#070A14]/70 backdrop-blur-xl">
            <div className="px-4 py-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center"
                aria-label="Abrir menu"
              >
                <BurgerIcon />
              </button>

              <div className="min-w-0 text-center">
                <div className="text-white/92 font-semibold tracking-tight text-[15px]">{title}</div>
                <div className="text-white/45 text-xs mt-0.5">Zona Invest • Administração</div>
              </div>

              <div className="flex items-center gap-2">
                <EyeToggleCompact />
                <span className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] text-white/75 text-sm flex items-center">
                  ADMIN
                </span>
              </div>
            </div>

            {mobileOpen ? (
              <div className="px-4 pb-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_26px_90px_rgba(0,0,0,0.55)] overflow-hidden">
                  <div className="p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <BrandMark />
                      <div className="min-w-0">
                        <div className="font-semibold tracking-tight text-white/95 truncate">{BRAND.name}</div>
                        <div className="text-xs text-white/55">{BRAND.subtitle}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-white/45">Painel</div>

                    <nav className="space-y-2">
                      {nav.map((item) => {
                        const active = isActive(item);
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cx(
                              'w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm border transition',
                              active
                                ? cx(
                                    'border-white/15 bg-gradient-to-r from-white/[0.10] to-white/[0.04]',
                                    'text-white shadow-[0_18px_70px_rgba(0,0,0,0.25)]',
                                  )
                                : 'border-transparent bg-transparent text-white/75 hover:bg-white/[0.06] hover:border-white/10',
                            )}
                          >
                            <Icon className={cx('h-5 w-5', active ? 'text-[#7AA7FF]' : 'text-white/70')} />
                            <span className={cx('font-medium', active ? 'text-white' : 'text-white/85')}>
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </nav>

                    <div className="mt-4 border-t border-white/10 pt-4 px-2">
                      <button
                        onClick={() => {
                          clearToken();
                          router.replace('/login');
                        }}
                        className={cx(
                          'w-full rounded-xl border border-white/10 px-3 py-3 text-sm transition',
                          'bg-white/[0.03] hover:bg-white/[0.06] text-white/85',
                          'flex items-center justify-center gap-2',
                        )}
                      >
                        <IconLogout className="h-5 w-5 text-white/70" />
                        Sair
                      </button>

                      <div className="mt-3 text-[12px] text-white/50">
                        Logado:{' '}
                        <span className="text-white/75">
                          <Sensitive placeholder="••••••@••••">{me?.email ?? ''}</Sensitive>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* ======= DESKTOP SHELL ======= */}
          <div className="hidden lg:block">
            <aside
              className={cx(
                'fixed left-0 top-0 h-screen w-[280px] p-5',
                'border-r border-white/10',
                'bg-white/[0.03] backdrop-blur-xl',
              )}
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="p-5 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <BrandMark />
                    <div className="min-w-0">
                      <div className="font-semibold tracking-tight text-white/95 truncate">{BRAND.name}</div>
                      <div className="text-xs text-white/55">{BRAND.subtitle}</div>
                    </div>
                  </div>
                </div>

                <div className="p-3">
                  <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-white/45">Painel</div>

                  <nav className="space-y-2">
                    {nav.map((item) => {
                      const active = isActive(item);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cx(
                            'w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm border transition',
                            active
                              ? cx(
                                  'border-white/15 bg-gradient-to-r from-white/[0.10] to-white/[0.04]',
                                  'text-white shadow-[0_18px_70px_rgba(0,0,0,0.25)]',
                                )
                              : 'border-transparent bg-transparent text-white/75 hover:bg-white/[0.06] hover:border-white/10',
                          )}
                        >
                          <Icon className={cx('h-5 w-5', active ? 'text-[#7AA7FF]' : 'text-white/70')} />
                          <span className={cx('font-medium', active ? 'text-white' : 'text-white/85')}>
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="mt-4 border-t border-white/10 pt-4 px-2">
                    <button
                      onClick={() => {
                        clearToken();
                        router.replace('/login');
                      }}
                      className={cx(
                        'w-full rounded-xl border border-white/10 px-3 py-3 text-sm transition',
                        'bg-white/[0.03] hover:bg-white/[0.06] text-white/85',
                        'flex items-center justify-center gap-2',
                      )}
                    >
                      <IconLogout className="h-5 w-5 text-white/70" />
                      Sair
                    </button>

                    <div className="mt-3 text-[12px] text-white/50">
                      Logado:{' '}
                      <span className="text-white/75">
                        <Sensitive placeholder="••••••@••••">{me?.email ?? ''}</Sensitive>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <div className="pl-[280px]">
              <header
                className={cx(
                  'sticky top-0 z-30',
                  'border-b border-white/10',
                  'bg-[#070A14]/60 backdrop-blur-xl',
                )}
              >
                <div className="px-8 py-5 flex items-center justify-between">
                  <div>
                    <div className="text-white/92 font-semibold tracking-tight text-[18px]">{title}</div>
                    <div className="text-white/45 text-sm mt-1">Zona Invest • Administração</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <EyeToggleCompact />
                    <span className="px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/75 text-sm">
                      ADMIN
                    </span>
                  </div>
                </div>
              </header>

              <main className="px-8 py-6">{children}</main>
            </div>
          </div>

          {/* ======= MOBILE CONTENT ======= */}
          <div className="lg:hidden px-4 py-5">{children}</div>
        </div>
      </div>
    </SensitiveModeProvider>
  );
}
