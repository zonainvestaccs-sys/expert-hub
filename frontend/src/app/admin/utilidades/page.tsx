'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiUpload } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

type UtilityItem = {
  id: string;
  name: string;
  url: string;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

const API_PUBLIC_BASE = (() => {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? '').trim();
  const low = raw.toLowerCase();
  if (!raw || low === 'undefined' || low === 'null') return '';
  return raw.replace(/\/+$/, '');
})();

function resolveImageUrl(imageUrl?: string | null) {
  const raw = String(imageUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (!API_PUBLIC_BASE) return raw;
  if (raw.startsWith('/')) return `${API_PUBLIC_BASE}${raw}`;
  return `${API_PUBLIC_BASE}/${raw}`;
}

function normalizeUrl(input: string) {
  const v = (input || '').trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return `https://${v}`;
}

function Icon(props: { name: 'plus' | 'trash' | 'open' | 'upload' | 'close' | 'link' }) {
  const { name } = props;

  if (name === 'plus') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'trash') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10 11v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14 11v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M7 7l1-3h8l1 3v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === 'open') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M14 5h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 14L19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M19 14v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === 'upload') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 14v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'close') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // link
  return (
    <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-white/10',
        'bg-gradient-to-b from-white/[0.055] to-white/[0.02]',
        'shadow-[0_18px_70px_rgba(0,0,0,0.42)]',
        'transition-all duration-200',
        'hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/[0.035]',
        'hover:shadow-[0_26px_90px_rgba(0,0,0,0.55)]',
        'overflow-hidden',
      )}
    >
      {children}
    </div>
  );
}

export default function AdminUtilitiesPage() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [items, setItems] = useState<UtilityItem[]>([]);

  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => items, [items]);

  const load = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const data = await apiFetch<{ items: UtilityItem[] }>('/admin/utilities', { token });
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar utilidades';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      clearToken();
      router.replace('/login');
      return;
    }
    tokenRef.current = t;
    load();
  }, [router, load]);

  useEffect(() => {
    const isOpen = openCreate;
    if (!isOpen) return;

    const prev = document.body.style.overflow;
    document.body.dataset.prevOverflow = prev;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenCreate(false);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const p = document.body.dataset.prevOverflow ?? '';
      document.body.style.overflow = p;
      delete document.body.dataset.prevOverflow;
    };
  }, [openCreate]);

  function resetCreate() {
    setCreateErr('');
    setName('');
    setUrl('');
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
  }

  function openModal() {
    resetCreate();
    setOpenCreate(true);
  }

  function closeModal() {
    setOpenCreate(false);
    resetCreate();
  }

  function pickFile() {
    setCreateErr('');
    fileInputRef.current?.click();
  }

  function onFileSelected(f?: File) {
    setCreateErr('');
    if (!f) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(f.type)) {
      setCreateErr('Arquivo inválido. Envie png/jpg/jpeg/webp.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setCreateErr('Arquivo muito grande. Limite: 5MB.');
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    const local = URL.createObjectURL(f);
    setPreview(local);
    setFile(f);
  }

  async function create() {
    setCreateErr('');
    setCreating(true);

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const nm = name.trim();
      const lk = normalizeUrl(url);

      if (!nm) throw new Error('Preencha o nome.');
      if (!lk) throw new Error('Preencha o link.');

      const fd = new FormData();
      fd.append('name', nm);
      fd.append('url', lk);
      if (file) fd.append('file', file);

      const created = await apiUpload<UtilityItem>('/admin/utilities', { token, formData: fd, method: 'POST' });

      setItems((prev) => [created, ...prev]);
      closeModal();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao criar utilidade';
      setCreateErr(msg);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    const ok = window.confirm('Tem certeza que deseja excluir este link útil?');
    if (!ok) return;

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      await apiFetch(`/admin/utilities/${encodeURIComponent(id)}`, { token, method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao excluir utilidade';
      window.alert(msg);
    }
  }

  function openLink(u: string) {
    const lk = normalizeUrl(u);
    window.open(lk, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="relative">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-white/92 font-semibold tracking-tight text-[18px]">Utilidade</div>
          <div className="text-white/45 text-sm mt-1">
            Cadastre links úteis com imagem e acesse com 1 clique.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              'bg-white/[0.03] hover:bg-white/[0.06] transition',
              'text-white/85 text-sm font-medium',
            )}
          >
            Atualizar
          </button>

          <button
            type="button"
            onClick={openModal}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
              'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
              'text-sm font-medium flex items-center gap-2',
            )}
          >
            <Icon name="plus" />
            Adicionar
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
      ) : null}

      <div className="mt-5">
        {loading ? (
          <div className="h-[260px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-white/55">
            Nenhum link cadastrado ainda. Clique em <span className="text-white/80 font-medium">Adicionar</span>.
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {filtered.map((it) => {
              const img = resolveImageUrl(it.imageUrl);
              return (
                <div key={it.id} className="col-span-12 md:col-span-6 xl:col-span-4">
                  <CardShell>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cx(
                              'h-12 w-12 rounded-2xl border border-white/10 overflow-hidden shrink-0',
                              'bg-gradient-to-br from-[#3E78FF]/20 via-white/[0.06] to-[#6A5CFF]/18',
                            )}
                          >
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt={it.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full grid place-items-center text-white/70">
                                <Icon name="link" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-white/92 font-semibold truncate">{it.name}</div>
                            <div className="text-white/45 text-xs truncate mt-1">{it.url}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => remove(it.id)}
                          className={cx(
                            'h-10 w-10 rounded-xl border border-white/10',
                            'bg-white/[0.02] hover:bg-white/[0.05] transition',
                            'grid place-items-center text-white/75',
                          )}
                          title="Excluir"
                          aria-label="Excluir"
                        >
                          <Icon name="trash" />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openLink(it.url)}
                          className={cx(
                            'h-10 flex-1 rounded-xl border border-white/10',
                            'bg-white/[0.03] hover:bg-white/[0.06] transition',
                            'text-white/85 text-sm font-medium flex items-center justify-center gap-2',
                          )}
                        >
                          <Icon name="open" />
                          Abrir
                        </button>
                      </div>
                    </div>
                  </CardShell>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {openCreate ? (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/60" onMouseDown={closeModal} aria-hidden="true" />
          <div className="absolute inset-0 grid place-items-center p-4" onMouseDown={closeModal}>
            <div
              className={cx(
                'w-full max-w-[640px] rounded-2xl border border-white/10 overflow-hidden',
                'bg-[#0B1022]/95 backdrop-blur-xl',
                'shadow-[0_30px_120px_rgba(0,0,0,0.70)]',
              )}
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
                <div>
                  <div className="text-white/90 font-semibold tracking-tight">Adicionar Utilidade</div>
                  <div className="text-white/45 text-sm mt-1">Nome + link + imagem (opcional).</div>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center text-white/80"
                  aria-label="Fechar"
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="p-5">
                {createErr ? (
                  <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
                    {createErr}
                  </div>
                ) : null}

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-8">
                    <div>
                      <div className="text-white/55 text-xs mb-2">Nome</div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                        placeholder="Ex: Google Ads"
                      />
                    </div>

                    <div className="mt-3">
                      <div className="text-white/55 text-xs mb-2">Link</div>
                      <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                        placeholder="Ex: https://ads.google.com"
                      />
                      <div className="text-white/45 text-xs mt-2">Dica: se você colar sem https, eu coloco automaticamente.</div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={pickFile}
                        className={cx(
                          'h-10 px-4 rounded-xl border border-white/10',
                          'bg-white/[0.03] hover:bg-white/[0.06] transition',
                          'text-white/85 text-sm font-medium flex items-center gap-2',
                        )}
                      >
                        <Icon name="upload" />
                        Upload imagem (opcional)
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.currentTarget.value = '';
                          onFileSelected(f);
                        }}
                      />

                      {file ? (
                        <div className="text-white/60 text-sm truncate">
                          {file.name}
                        </div>
                      ) : (
                        <div className="text-white/45 text-sm">Nenhuma imagem selecionada</div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <div className="text-white/55 text-xs mb-2">Prévia</div>
                    <div
                      className={cx(
                        'rounded-2xl border border-white/10 overflow-hidden',
                        'bg-gradient-to-br from-[#3E78FF]/15 via-white/[0.06] to-[#6A5CFF]/12',
                        'h-[180px] w-full grid place-items-center',
                      )}
                    >
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="Prévia" className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-white/60 text-sm text-center px-4">
                          Sem imagem<br /> (opcional)
                        </div>
                      )}
                    </div>

                    <div className="text-white/45 text-xs mt-2">
                      Aceita png/jpg/webp • até 5MB.
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition text-white/80 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={create}
                  disabled={creating}
                  className={cx(
                    'h-10 px-4 rounded-xl border border-white/10',
                    'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                    'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                    'text-sm font-medium',
                    creating && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {creating ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
