// src/app/admin/experts/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

type UserItem = {
  id: string;
  email: string;
  role: 'ADMIN' | 'EXPERT';
  isActive: boolean;
  createdAt: string;
  photoUrl?: string | null;

  // config de planilha por expert
  leadsSheetId?: string | null;
  leadsSheetTab?: string | null;
  leadsSheetCsvUrl?: string | null;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

function formatISODateTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

/**
 * Base de API só pra casos que NÃO são JSON (ex.: upload FormData) e pra resolver foto.
 * - Em dev: vc pode deixar NEXT_PUBLIC_API_BASE=http://localhost:3000 (backend)
 * - Em prod: pode ser "" (mesma origem) OU teu domínio.
 */
const API_BASE = (() => {
  const raw =
    (process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_API_URL ?? '').trim();
  const low = raw.toLowerCase();
  if (!raw || low === 'undefined' || low === 'null') return '';
  return raw.replace(/\/+$/, '');
})();

function resolvePhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return '';
  // se vier relativo do backend: "/uploads/.."
  if (photoUrl.startsWith('/')) return `${API_BASE}${photoUrl}`;
  // se já vier absoluto: "https://..."
  return photoUrl;
}

function getInitials(email: string) {
  const v = (email || '').trim();
  if (!v) return 'EX';
  const name = v.split('@')[0] || v;
  const parts = name.split(/[.\-_ ]+/).filter(Boolean);
  const a = (parts[0]?.[0] || name[0] || 'E').toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || 'X').toUpperCase();
  return `${a}${b}`;
}

function Icon(props: { name: 'search' | 'plus' | 'chevron' | 'edit' | 'close' | 'upload' }) {
  const { name } = props;

  if (name === 'search') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M10.5 18.5a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M17 17l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'plus') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'chevron') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 10l3 4 3-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === 'edit') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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

  // upload
  return (
    <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M8 7l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 14v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

async function uploadExpertPhoto(params: { token: string; userId: string; file: File }) {
  const { token, userId, file } = params;
  const fd = new FormData();
  fd.append('file', file);

  // FormData => não usa apiFetch (ele seta application/json). Aqui vai fetch puro.
  const url = `${API_BASE}/admin/experts/${encodeURIComponent(userId)}/photo`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || text || 'Falha no upload';
    throw new Error(typeof msg === 'string' ? msg : 'Falha no upload');
  }

  return data as UserItem;
}

// ✅ Portal pra não “cortar” em layouts com transform/overflow
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ✅ Buscar detalhe do expert (pega config da planilha corretamente)
async function fetchExpertDetails(params: { token: string; expertId: string }) {
  const { token, expertId } = params;

  // AdminController: GET /admin/experts/:expertId/overview
  const data = await apiFetch<any>(`/admin/experts/${encodeURIComponent(expertId)}/overview`, { token });

  // retorno esperado: { period, expert: { ... }, kpis }
  const ex = data?.expert ?? null;
  if (!ex) return null;

  return ex as Partial<UserItem>;
}

export default function AdminExpertsPage() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [experts, setExperts] = useState<UserItem[]>([]);
  const [q, setQ] = useState('');

  // popup editar (centro)
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<UserItem | null>(null);

  const [editEmail, setEditEmail] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [newPassword, setNewPassword] = useState('');

  // planilha no editar
  const [editSheetId, setEditSheetId] = useState('');
  const [editSheetTab, setEditSheetTab] = useState('');
  const [editCsvUrl, setEditCsvUrl] = useState('');
  const [sheetErr, setSheetErr] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // criar expert
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // planilha no create
  const [createSheetId, setCreateSheetId] = useState('');
  const [createSheetTab, setCreateSheetTab] = useState('');
  const [createCsvUrl, setCreateCsvUrl] = useState('');

  async function loadExperts() {
    setErr('');
    setLoading(true);

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const users = await apiFetch<UserItem[]>('/users', { token });
      setExperts((users || []).filter((u) => u.role === 'EXPERT'));
    } catch (e: any) {
      setErr(typeof e?.message === 'string' ? e.message : 'Falha ao carregar experts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace('/login');
      return;
    }
    tokenRef.current = t;
    loadExperts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // trava scroll quando abrir popup
  useEffect(() => {
    const isOpen = openCreate || editOpen;
    if (!isOpen) return;

    const prev = document.body.style.overflow;
    document.body.dataset.prevOverflow = prev;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenCreate(false);
        setEditOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const p = document.body.dataset.prevOverflow ?? '';
      document.body.style.overflow = p;
      delete document.body.dataset.prevOverflow;
    };
  }, [openCreate, editOpen]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return experts;
    return experts.filter((e) => e.email.toLowerCase().includes(s) || e.id.toLowerCase().includes(s));
  }, [experts, q]);

  const stats = useMemo(() => {
    const total = experts.length;
    const active = experts.filter((e) => e.isActive).length;
    return { total, active };
  }, [experts]);

  async function createExpert() {
    setCreateErr('');
    setCreating(true);

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const body = { email: email.trim(), password, role: 'EXPERT' as const };
      if (!body.email || !body.password) throw new Error('Preencha e-mail e senha.');

      const created = await apiFetch<UserItem>('/users', { token, method: 'POST', body });

      const patchBody: any = {
        leadsSheetId: createSheetId.trim() || null,
        leadsSheetTab: createSheetTab.trim() || null,
        leadsSheetCsvUrl: createCsvUrl.trim() || null,
      };

      if (patchBody.leadsSheetId || patchBody.leadsSheetTab || patchBody.leadsSheetCsvUrl) {
        await apiFetch<any>(`/admin/experts/${encodeURIComponent(created.id)}`, {
          token,
          method: 'PATCH',
          body: patchBody,
        });
      }

      setOpenCreate(false);
      setEmail('');
      setPassword('');
      setCreateSheetId('');
      setCreateSheetTab('');
      setCreateCsvUrl('');

      await loadExperts();
    } catch (e: any) {
      setCreateErr(typeof e?.message === 'string' ? e.message : 'Falha ao criar expert');
    } finally {
      setCreating(false);
    }
  }

  function goDetails(item: UserItem) {
    router.push(`/admin/experts/${encodeURIComponent(item.id)}`);
  }

  async function openEdit(item: UserItem) {
    setSelected(item);
    setEditEmail(item.email);
    setEditIsActive(!!item.isActive);
    setNewPassword('');
    setUploadErr('');
    setSheetErr('');

    // zera logo (evita ficar mostrando lixo)
    setEditSheetId('');
    setEditSheetTab('');
    setEditCsvUrl('');

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');

    setEditOpen(true);

    // ✅ carrega dados reais (inclui config da planilha)
    try {
      const token = tokenRef.current;
      if (!token) return;

      const details = await fetchExpertDetails({ token, expertId: item.id });
      if (!details) return;

      // atualiza selected
      setSelected((prev) => (prev ? { ...prev, ...details } : prev));

      // atualiza lista (se quiser ver refletido ao fechar)
      setExperts((prev) => prev.map((u) => (u.id === item.id ? { ...u, ...details } : u)));

      // popula inputs
      setEditSheetId(details.leadsSheetId || '');
      setEditSheetTab(details.leadsSheetTab || '');
      setEditCsvUrl(details.leadsSheetCsvUrl || '');
    } catch (e: any) {
      setSheetErr(typeof e?.message === 'string' ? e.message : 'Não consegui carregar a config da planilha.');
    }
  }

  function closeEdit() {
    setEditOpen(false);
    setSelected(null);
    setUploadErr('');
    setSheetErr('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  }

  function pickFile() {
    setUploadErr('');
    fileInputRef.current?.click();
  }

  async function onFileSelected(file?: File) {
    setUploadErr('');
    if (!file || !selected) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) return setUploadErr('Arquivo inválido. Envie png/jpg/jpeg/webp.');
    if (file.size > 5 * 1024 * 1024) return setUploadErr('Arquivo muito grande. Limite: 5MB.');

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const local = URL.createObjectURL(file);
    setPreviewUrl(local);

    setUploading(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const updated = await uploadExpertPhoto({ token, userId: selected.id, file });

      setExperts((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      setSelected((prev) => (prev ? { ...prev, ...updated } : prev));

      URL.revokeObjectURL(local);
      setPreviewUrl('');
    } catch (e: any) {
      setUploadErr(typeof e?.message === 'string' ? e.message : 'Falha ao enviar foto');
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    if (!selected) return;

    setSheetErr('');

    const token = tokenRef.current;
    if (!token) return;

    const sid = editSheetId.trim();
    const stab = editSheetTab.trim();
    const scsv = editCsvUrl.trim();

    if (stab && !sid && !scsv) {
      setSheetErr('Se vc definir “Aba”, precisa informar também “Sheet ID” ou “CSV URL”.');
      return;
    }

    const res = await apiFetch<any>(`/admin/experts/${encodeURIComponent(selected.id)}`, {
      token,
      method: 'PATCH',
      body: {
        email: editEmail.trim(),
        isActive: editIsActive,
        leadsSheetId: sid || null,
        leadsSheetTab: stab || null,
        leadsSheetCsvUrl: scsv || null,
      },
    });

    const updated: UserItem | null = res?.expert ?? res ?? null;

    if (updated?.id) {
      setExperts((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
    } else {
      try {
        const details = await fetchExpertDetails({ token, expertId: selected.id });
        if (details) {
          setExperts((prev) => prev.map((u) => (u.id === selected.id ? { ...u, ...details } : u)));
          setSelected((prev) => (prev ? { ...prev, ...details } : prev));
        }
      } catch {
        // ignora
      }
    }

    if (newPassword.trim()) {
      await apiFetch<any>(`/admin/experts/${encodeURIComponent(selected.id)}/password`, {
        token,
        method: 'PATCH',
        body: { password: newPassword },
      });
    }

    closeEdit();
  }

  const selectedPhoto = useMemo(() => {
    if (!selected) return '';
    if (previewUrl) return previewUrl;
    return resolvePhotoUrl(selected.photoUrl);
  }, [selected, previewUrl]);

  return (
    <div className="relative">
      {/* header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-white/92 font-semibold tracking-tight text-[18px]">Experts</div>
          <div className="text-white/45 text-sm mt-1">
            Acesse o painel individual por expert e edite perfil quando precisar.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white/80 text-sm">
            Total: <span className="text-white/95 font-medium">{stats.total}</span>
          </div>
          <div className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white/80 text-sm">
            Ativos: <span className="text-white/95 font-medium">{stats.active}</span>
          </div>

          <button
            onClick={() => setOpenCreate(true)}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
              'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
              'text-sm font-medium flex items-center gap-2',
            )}
          >
            <Icon name="plus" />
            Criar expert
          </button>
        </div>
      </div>

      {/* busca */}
      <div className="mt-5 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 h-11 w-full md:max-w-[520px]">
          <span className="text-white/55">
            <Icon name="search" />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por e-mail ou ID..."
            className="w-full bg-transparent outline-none text-white/85 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={loadExperts}
          className="h-11 px-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm font-medium"
        >
          Atualizar lista
        </button>
      </div>

      {err ? (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
      ) : null}

      {/* tabela */}
      <div
        className={cx(
          'mt-5 rounded-2xl border border-white/10 overflow-hidden',
          'bg-gradient-to-b from-white/[0.05] to-white/[0.02]',
          'shadow-[0_18px_70px_rgba(0,0,0,0.45)]',
        )}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-white/85 font-semibold tracking-tight">Lista de experts</div>
          <div className="text-white/45 text-sm">{loading ? 'Carregando…' : `${filtered.length} resultado(s)`}</div>
        </div>

        <div className="overflow-auto">
          <table className="w-full">
            <thead className="text-left">
              <tr className="text-white/55 text-xs">
                <th className="px-5 py-3 font-medium">Expert</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Criado</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="text-white/85">
              {loading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="px-5 py-4">
                        <div className="h-4 w-60 bg-white/[0.06] rounded animate-pulse" />
                        <div className="mt-2 h-3 w-40 bg-white/[0.05] rounded animate-pulse" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-7 w-20 bg-white/[0.05] rounded-full animate-pulse" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-4 w-40 bg-white/[0.05] rounded animate-pulse" />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="h-9 w-36 bg-white/[0.05] rounded-xl animate-pulse ml-auto" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : filtered.length === 0 ? (
                <tr className="border-t border-white/10">
                  <td colSpan={4} className="px-5 py-10 text-center text-white/55">
                    Nenhum expert encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const photo = resolvePhotoUrl(e.photoUrl);
                  const initials = getInitials(e.email);

                  return (
                    <tr key={e.id} className="border-t border-white/10 hover:bg-white/[0.03] transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cx(
                              'h-10 w-10 rounded-2xl border border-white/10 overflow-hidden grid place-items-center',
                              'bg-gradient-to-br from-[#3E78FF]/20 via-white/[0.06] to-[#6A5CFF]/18',
                            )}
                            title={e.email}
                          >
                            {photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={photo} alt="Foto do expert" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="text-white/85 text-xs font-semibold tracking-wide">{initials}</div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="font-medium text-white/92 truncate">{e.email}</div>
                            <div className="text-xs text-white/45 truncate">ID: {e.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={cx(
                            'inline-flex items-center px-3 py-1 rounded-full border text-xs',
                            e.isActive
                              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                              : 'border-white/10 bg-white/[0.03] text-white/65',
                          )}
                        >
                          {e.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-white/75 text-sm">{formatISODateTime(e.createdAt)}</td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => goDetails(e)}
                            className={cx(
                              'h-9 px-4 rounded-xl border border-white/10',
                              'bg-white/[0.03] hover:bg-white/[0.06] transition',
                              'text-white/85 text-sm font-medium inline-flex items-center gap-2',
                            )}
                          >
                            Detalhes
                            <Icon name="chevron" />
                          </button>

                          <button
                            onClick={() => openEdit(e)}
                            className={cx(
                              'h-9 w-9 rounded-xl border border-white/10',
                              'bg-white/[0.02] hover:bg-white/[0.05] transition',
                              'text-white/80 grid place-items-center',
                            )}
                            title="Editar perfil"
                          >
                            <Icon name="edit" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ POPUP EDITAR PERFIL (CENTRO) */}
      {editOpen && selected ? (
        <Portal>
          <div className="fixed inset-0 z-[9999]">
            <div className="absolute inset-0 bg-black/60" onMouseDown={closeEdit} aria-hidden="true" />
            <div className="absolute inset-0 grid place-items-center p-4" onMouseDown={closeEdit}>
              <div
                className={cx(
                  'w-full max-w-[780px] rounded-2xl border border-white/10 overflow-hidden',
                  'bg-[#0B1022]/95 backdrop-blur-xl',
                  'shadow-[0_30px_120px_rgba(0,0,0,0.70)]',
                )}
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-white/90 font-semibold tracking-tight">Editar perfil</div>
                    <div className="text-white/45 text-sm mt-1 truncate">{selected.email}</div>
                  </div>

                  <button
                    type="button"
                    onClick={closeEdit}
                    className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center text-white/80"
                    aria-label="Fechar"
                  >
                    <Icon name="close" />
                  </button>
                </div>

                <div className="p-5 overflow-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                  <div className="flex flex-col md:flex-row md:items-start gap-5">
                    {/* col esquerda */}
                    <div className="md:w-[300px] shrink-0">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div
                            className={cx(
                              'h-[84px] w-[84px] rounded-2xl border border-white/10 overflow-hidden',
                              'bg-gradient-to-br from-[#3E78FF]/22 via-white/[0.06] to-[#6A5CFF]/20',
                            )}
                          >
                            {selectedPhoto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={selectedPhoto} alt="Foto do expert" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full grid place-items-center">
                                <div className="text-white/85 font-semibold text-lg tracking-wide">{getInitials(selected.email)}</div>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={pickFile}
                            disabled={uploading}
                            className={cx(
                              'absolute -bottom-2 -right-2 h-10 w-10 rounded-xl border border-white/10',
                              'bg-[#0B1022]/90 backdrop-blur hover:bg-white/[0.06] transition grid place-items-center',
                              uploading && 'opacity-60 cursor-not-allowed',
                            )}
                            title="Alterar foto"
                          >
                            <Icon name="upload" />
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
                        </div>

                        <div className="min-w-0">
                          <div className="text-white/92 font-semibold truncate">{selected.email}</div>
                          <div className="text-white/55 text-sm mt-1">
                            ID: <span className="text-white/75">{selected.id}</span>
                          </div>
                        </div>
                      </div>

                      {uploadErr ? (
                        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
                          {uploadErr}
                        </div>
                      ) : null}
                    </div>

                    {/* col direita */}
                    <div className="flex-1 min-w-0">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <div className="text-white/55 text-xs mb-2">E-mail</div>
                          <input
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                          />
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div>
                            <div className="text-white/80 text-sm font-medium">Status</div>
                            <div className="text-white/45 text-xs mt-1">Ativar/Inativar expert</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditIsActive((v) => !v)}
                            className={cx(
                              'h-9 px-4 rounded-xl border border-white/10 text-sm font-medium transition',
                              editIsActive
                                ? 'bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/16'
                                : 'bg-white/[0.02] text-white/70 hover:bg-white/[0.05]',
                            )}
                          >
                            {editIsActive ? 'Ativo' : 'Inativo'}
                          </button>
                        </div>

                        <div>
                          <div className="text-white/55 text-xs mb-2">Nova senha (opcional)</div>
                          <input
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            type="password"
                            className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                            placeholder="Defina uma senha forte"
                          />
                          <div className="text-white/45 text-xs mt-2">Se deixar vazio, a senha não muda.</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-white/80 text-sm font-medium">Planilha de leads (Google Sheets)</div>
                          <div className="text-white/45 text-xs mt-1">Config por expert.</div>

                          {sheetErr ? (
                            <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
                              {sheetErr}
                            </div>
                          ) : null}

                          <div className="mt-4 grid grid-cols-1 gap-3">
                            <div>
                              <div className="text-white/55 text-xs mb-2">Sheet ID (opcional)</div>
                              <input
                                value={editSheetId}
                                onChange={(e) => setEditSheetId(e.target.value)}
                                className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                                placeholder="ex: 1AbC...XYZ"
                              />
                            </div>

                            <div>
                              <div className="text-white/55 text-xs mb-2">Aba (sheet/tab) (opcional)</div>
                              <input
                                value={editSheetTab}
                                onChange={(e) => setEditSheetTab(e.target.value)}
                                className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                                placeholder="ex: Leads"
                              />
                            </div>

                            <div>
                              <div className="text-white/55 text-xs mb-2">CSV URL (opcional)</div>
                              <input
                                value={editCsvUrl}
                                onChange={(e) => setEditCsvUrl(e.target.value)}
                                className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                                placeholder="ex: https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv&sheet=ABA"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition text-white/80 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveProfile}
                    className={cx(
                      'h-10 px-4 rounded-xl border border-white/10',
                      'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                      'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                      'text-sm font-medium',
                    )}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}

      {/* ✅ MODAL CREATE (CENTRO) */}
      {openCreate ? (
        <Portal>
          <div className="fixed inset-0 z-[9999]">
            <div className="absolute inset-0 bg-black/60" onMouseDown={() => setOpenCreate(false)} aria-hidden="true" />
            <div className="absolute inset-0 grid place-items-center p-4" onMouseDown={() => setOpenCreate(false)}>
              <div
                className={cx(
                  'w-full max-w-[620px] rounded-2xl border border-white/10 overflow-hidden',
                  'bg-[#0B1022]/95 backdrop-blur-xl',
                  'shadow-[0_30px_120px_rgba(0,0,0,0.70)]',
                )}
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-white/90 font-semibold tracking-tight">Criar expert</div>
                    <div className="text-white/45 text-sm mt-1">Cria um usuário EXPERT.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenCreate(false)}
                    className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition grid place-items-center text-white/80"
                    aria-label="Fechar"
                  >
                    <Icon name="close" />
                  </button>
                </div>

                <div className="p-5 overflow-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                  {createErr ? (
                    <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
                      {createErr}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <div className="text-white/55 text-xs mb-2">E-mail</div>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                      />
                    </div>

                    <div>
                      <div className="text-white/55 text-xs mb-2">Senha</div>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                      />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-white/80 text-sm font-medium">Planilha de leads (opcional)</div>
                      <div className="text-white/45 text-xs mt-1">Vc pode criar e já configurar.</div>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <div>
                          <div className="text-white/55 text-xs mb-2">Sheet ID</div>
                          <input
                            value={createSheetId}
                            onChange={(e) => setCreateSheetId(e.target.value)}
                            className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                            placeholder="ex: 1AbC...XYZ"
                          />
                        </div>

                        <div>
                          <div className="text-white/55 text-xs mb-2">Aba (sheet/tab)</div>
                          <input
                            value={createSheetTab}
                            onChange={(e) => setCreateSheetTab(e.target.value)}
                            className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                            placeholder="ex: Leads"
                          />
                        </div>

                        <div>
                          <div className="text-white/55 text-xs mb-2">CSV URL</div>
                          <input
                            value={createCsvUrl}
                            onChange={(e) => setCreateCsvUrl(e.target.value)}
                            className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                            placeholder="ex: https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv&sheet=ABA"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenCreate(false)}
                    className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition text-white/75 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={createExpert}
                    disabled={creating}
                    className={cx(
                      'h-10 px-4 rounded-xl border border-white/10',
                      'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                      'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                      'text-sm font-medium',
                      creating && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    {creating ? 'Criando…' : 'Criar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}
    </div>
  );
}
