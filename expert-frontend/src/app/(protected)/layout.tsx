'use client';

import React, { useEffect, useState } from 'react';
import { fetchMe, getToken, clearToken } from '@/lib/auth';
import { usePathname, useRouter } from 'next/navigation';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      const token = getToken();
      if (!token) {
        clearToken();
        router.replace('/login');
        return;
      }

      try {
        const me = await fetchMe(token);

        // só EXPERT entra aqui
        if (me.role !== 'EXPERT') {
          clearToken();
          router.replace('/login');
          return;
        }

        if (alive) setReady(true);
      } catch {
        clearToken();
        router.replace('/login');
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#070B18] text-white px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-white/90 font-semibold">Carregando painel...</div>
          <div className="text-white/50 text-sm mt-1">Validando acesso.</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
