'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiUpload } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Folder = { id: string; name: string; orderIndex: number };
type Tag = { id: string; name: string; color?: string | null };

type UtilityItem = {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  imageUrl?: string | null;
  folderId?: string | null;
  orderIndex?: number;
  tags?: Tag[];
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

function Icon(props: { name: 'plus' | 'trash' | 'upload' | 'close' | 'edit' | 'folder' | 'tag' | 'search' | 'dots' }) {
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

  if (name === 'edit') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === 'folder') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === 'tag') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 13l-7 7-11-11V2h7l11 11Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M7.5 7.5h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'search') {
    return (
      <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M21 21l-4.2-4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // dots (drag handle)
  return (
    <svg className="inline-block" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Pill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'px-3 h-9 rounded-xl border text-sm transition whitespace-nowrap',
        active ? 'border-white/20 bg-white/[0.08] text-white' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80',
      )}
    >
      {children}
    </button>
  );
}

function SortableCard(props: {
  item: UtilityItem;
  onEdit: (it: UtilityItem) => void;
  onDelete: (id: string) => void;
}) {
  const { item, onEdit, onDelete } = props;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  const img = resolveImageUrl(item.imageUrl);

  const open = () => {
    const lk = normalizeUrl(item.url);
    window.open(lk, '_blank', 'noopener,noreferrer');
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div
        className={cx(
          'rounded-2xl border border-white/10 overflow-hidden',
          'bg-gradient-to-b from-white/[0.055] to-white/[0.02]',
          'shadow-[0_18px_70px_rgba(0,0,0,0.35)]',
          'hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/[0.035] hover:shadow-[0_26px_90px_rgba(0,0,0,0.48)]',
          'transition-all duration-200',
        )}
      >
        {/* Card inteiro clicável */}
        <button
          type="button"
          onClick={open}
          className="w-full text-left"
          title="Abrir link"
        >
          <div className="p-4 flex items-start gap-4">
            {/* ✅ imagem maior */}
            <div
              className={cx(
                'h-20 w-20 rounded-2xl border border-white/10 overflow-hidden shrink-0',
                'bg-gradient-to-br from-[#3E78FF]/20 via-white/[0.06] to-[#6A5CFF]/18',
              )}
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-white/70">
                  <Icon name="tag" />
                </div>
              )}
            </div>

            {/* ✅ conteúdo compacto (não largão) */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-white/92 font-semibold truncate">{item.name}</div>
                  <div className="text-white/45 text-xs truncate mt-1">{item.url}</div>
                </div>
              </div>

              {item.description ? (
                <div className="text-white/55 text-sm mt-2 line-clamp-2">
                  {item.description}
                </div>
              ) : null}

              {item.tags?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.slice(0, 4).map((t) => (
                    <span
                      key={t.id}
                      className="px-2 py-1 rounded-lg text-xs border border-white/10 bg-white/[0.03] text-white/75"
                      title={t.name}
                    >
                      {t.name}
                    </span>
                  ))}
                  {item.tags.length > 4 ? (
                    <span className="px-2 py-1 rounded-lg text-xs border border-white/10 bg-white/[0.03] text-white/55">
                      +{item.tags.length - 4}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </button>

        {/* Ações (edit/delete/drag) */}
        <div className="px-4 pb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(item); }}
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm flex items-center gap-2"
              title="Editar"
            >
              <Icon name="edit" />
              Editar
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm flex items-center gap-2"
              title="Excluir"
            >
              <Icon name="trash" />
              Excluir
            </button>
          </div>

          {/* drag handle */}
          <button
            type="button"
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/80 grid place-items-center cursor-grab active:cursor-grabbing"
            title="Arrastar"
            {...attributes}
            {...listeners}
          >
            <Icon name="dots" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUtilitiesPage() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [items, setItems] = useState<UtilityItem[]>([]);

  // filtros
  const [activeFolderId, setActiveFolderId] = useState<string>(''); // '' = todos
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [q, setQ] = useState('');

  // modais
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formErr, setFormErr] = useState('');

  // form fields
  const [editId, setEditId] = useState<string>('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [folderId, setFolderId] = useState<string>(''); // '' = sem pasta
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');

  const [newFolderName, setNewFolderName] = useState('');
  const [newTagName, setNewTagName] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadBootstrap = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const [f, t] = await Promise.all([
        apiFetch<{ items: Folder[] }>('/admin/utility-folders', { token }),
        apiFetch<{ items: Tag[] }>('/admin/utility-tags', { token }),
      ]);

      setFolders(Array.isArray(f?.items) ? f.items : []);
      setTags(Array.isArray(t?.items) ? t.items : []);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar dados';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setErr('');
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const params = new URLSearchParams();
      if (activeFolderId) params.set('folderId', activeFolderId);
      if (selectedTagIds.length) params.set('tagIds', selectedTagIds.join(','));
      if (q.trim()) params.set('q', q.trim());

      const data = await apiFetch<{ items: UtilityItem[] }>(`/admin/utilities?${params.toString()}`, { token });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar utilidades';
      setErr(msg);
    }
  }, [activeFolderId, selectedTagIds, q]);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      clearToken();
      router.replace('/login');
      return;
    }
    tokenRef.current = t;
    loadBootstrap().then(() => loadItems());
  }, [router, loadBootstrap, loadItems]);

  useEffect(() => {
    // recarrega quando filtros mudam
    if (!tokenRef.current) return;
    loadItems();
  }, [activeFolderId, selectedTagIds, q, loadItems]);

  function resetForm() {
    setFormErr('');
    setEditId('');
    setName('');
    setUrl('');
    setDescription('');
    setFolderId('');
    setTagIds([]);
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setNewFolderName('');
    setNewTagName('');
  }

  function openCreateModal() {
    resetForm();
    setOpenCreate(true);
    setOpenEdit(false);
  }

  function openEditModal(it: UtilityItem) {
    resetForm();
    setEditId(it.id);
    setName(it.name || '');
    setUrl(it.url || '');
    setDescription(it.description || '');
    setFolderId(it.folderId || '');
    setTagIds((it.tags || []).map((x) => x.id));
    setOpenEdit(true);
    setOpenCreate(false);
  }

  function closeModal() {
    setOpenCreate(false);
    setOpenEdit(false);
    resetForm();
  }

  function pickFile() {
    setFormErr('');
    fileInputRef.current?.click();
  }

  function onFileSelected(f?: File) {
    setFormErr('');
    if (!f) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(f.type)) {
      setFormErr('Arquivo inválido. Envie png/jpg/jpeg/webp.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setFormErr('Arquivo muito grande. Limite: 5MB.');
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    const local = URL.createObjectURL(f);
    setPreview(local);
    setFile(f);
  }

  async function createFolderQuick() {
    const token = tokenRef.current;
    if (!token) return;

    const nm = newFolderName.trim();
    if (!nm) return;

    const created = await apiFetch<Folder>('/admin/utility-folders', {
      token,
      method: 'POST',
      body: { name: nm },
    });

    setFolders((prev) => [...prev, created].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)));
    setFolderId(created.id);
    setNewFolderName('');
  }

  async function createTagQuick() {
    const token = tokenRef.current;
    if (!token) return;

    const nm = newTagName.trim();
    if (!nm) return;

    const created = await apiFetch<Tag>('/admin/utility-tags', {
      token,
      method: 'POST',
      body: { name: nm },
    });

    setTags((prev) => [...prev, created].sort((a, b) => String(a.name).localeCompare(String(b.name))));
    setTagIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
    setNewTagName('');
  }

  async function onCreate() {
    setFormErr('');
    setCreating(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const nm = name.trim();
      const lk = normalizeUrl(url);
      const desc = description.trim();

      if (!nm) throw new Error('Preencha o nome.');
      if (!lk) throw new Error('Preencha o link.');

      const fd = new FormData();
      fd.append('name', nm);
      fd.append('url', lk);
      fd.append('description', desc);
      fd.append('folderId', folderId || '');
      fd.append('tagIds', tagIds.join(','));
      if (file) fd.append('file', file);

      await apiUpload<UtilityItem>('/admin/utilities', { token, formData: fd, method: 'POST' });
      closeModal();
      await loadItems();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao criar utilidade';
      setFormErr(msg);
    } finally {
      setCreating(false);
    }
  }

  async function onSaveEdit() {
    setFormErr('');
    setSaving(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');
      if (!editId) throw new Error('ID inválido');

      const nm = name.trim();
      const lk = normalizeUrl(url);
      const desc = description.trim();

      if (!nm) throw new Error('Preencha o nome.');
      if (!lk) throw new Error('Preencha o link.');

      const fd = new FormData();
      fd.append('name', nm);
      fd.append('url', lk);
      fd.append('description', desc);
      fd.append('folderId', folderId || '');
      fd.append('tagIds', tagIds.join(','));
      if (file) fd.append('file', file);

      await apiUpload<UtilityItem>(`/admin/utilities/${encodeURIComponent(editId)}`, { token, formData: fd, method: 'PATCH' });
      closeModal();
      await loadItems();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao salvar';
      setFormErr(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    const ok = window.confirm('Excluir esta utilidade?');
    if (!ok) return;

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      await apiFetch(`/admin/utilities/${encodeURIComponent(id)}`, { token, method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao excluir';
      window.alert(msg);
    }
  }

  function toggleFilterTag(id: string) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleFormTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function persistReorder(next: UtilityItem[]) {
    const token = tokenRef.current;
    if (!token) return;

    const orderedIds = next.map((x) => x.id);
    await apiFetch('/admin/utilities-reorder', {
      token,
      method: 'PATCH',
      body: { orderedIds },
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active?.id || '');
    const overId = String(e.over?.id || '');
    if (!activeId || !overId || activeId === overId) return;

    const oldIndex = items.findIndex((x) => x.id === activeId);
    const newIndex = items.findIndex((x) => x.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    try {
      await persistReorder(next);
    } catch (err: any) {
      // fallback: recarrega do servidor
      await loadItems();
    }
  }

  const showModal = openCreate || openEdit;

  return (
    <div className="relative">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-white/92 font-semibold tracking-tight text-[18px]">Utilidades</div>
          <div className="text-white/45 text-sm mt-1">
            Organize links por pasta, tags, filtro e ordem (arraste para reorganizar).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadItems()}
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
            onClick={openCreateModal}
            className={cx(
              'h-10 px-4 rounded-xl border border-white/10',
              'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
              'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
              'text-sm font-medium flex items-center gap-2',
            )}
          >
            <Icon name="plus" />
            Nova utilidade
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
      ) : null}

      <div className="mt-5 grid grid-cols-12 gap-4">
        {/* Sidebar (pastas + filtros) */}
        <div className="col-span-12 lg:col-span-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-white/85 text-sm font-semibold flex items-center gap-2">
              <Icon name="folder" />
              Pastas
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setActiveFolderId('')}
                className={cx(
                  'h-10 px-3 rounded-xl border text-sm text-left transition',
                  activeFolderId === '' ? 'border-white/20 bg-white/[0.08] text-white' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80',
                )}
              >
                Todas
              </button>

              <button
                type="button"
                onClick={() => setActiveFolderId('')}
                className="hidden"
              />

              {(folders || []).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFolderId(f.id)}
                  className={cx(
                    'h-10 px-3 rounded-xl border text-sm text-left transition truncate',
                    activeFolderId === f.id ? 'border-white/20 bg-white/[0.08] text-white' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80',
                  )}
                  title={f.name}
                >
                  {f.name}
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="text-white/85 text-sm font-semibold flex items-center gap-2">
                <Icon name="tag" />
                Tags (filtro)
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(tags || []).map((t) => (
                  <Pill
                    key={t.id}
                    active={selectedTagIds.includes(t.id)}
                    onClick={() => toggleFilterTag(t.id)}
                  >
                    {t.name}
                  </Pill>
                ))}
              </div>

              <div className="mt-4">
                <div className="text-white/55 text-xs mb-2">Busca</div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.03] grid place-items-center text-white/70">
                    <Icon name="search" />
                  </div>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                    placeholder="Nome, link, descrição..."
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedTagIds([]); setQ(''); }}
                  className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lista (drag & drop) */}
        <div className="col-span-12 lg:col-span-9">
          {loading ? (
            <div className="h-[260px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-white/55">
              Nenhuma utilidade encontrada para os filtros atuais.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-12 gap-4">
                  {items.map((it) => (
                    <div key={it.id} className="col-span-12 md:col-span-6 xl:col-span-4">
                      <SortableCard item={it} onEdit={openEditModal} onDelete={onDelete} />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* MODAL (CREATE/EDIT) */}
      {showModal ? (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/60" onMouseDown={closeModal} aria-hidden="true" />
          <div className="absolute inset-0 grid place-items-center p-4" onMouseDown={closeModal}>
            <div
              className={cx(
                'w-full max-w-[720px] rounded-2xl border border-white/10 overflow-hidden',
                'bg-[#0B1022]/95 backdrop-blur-xl',
                'shadow-[0_30px_120px_rgba(0,0,0,0.70)]',
              )}
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
                <div>
                  <div className="text-white/90 font-semibold tracking-tight">
                    {openEdit ? 'Editar utilidade' : 'Nova utilidade'}
                  </div>
                  <div className="text-white/45 text-sm mt-1">Nome + link + descrição + pasta + tags + imagem.</div>
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
                {formErr ? (
                  <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
                    {formErr}
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
                    </div>

                    <div className="mt-3">
                      <div className="text-white/55 text-xs mb-2">Descrição (opcional)</div>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full min-h-[84px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white/85 text-sm outline-none focus:border-white/20 resize-none"
                        placeholder="Ex: Link rápido para acessar campanhas e relatórios."
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-12 gap-3">
                      <div className="col-span-12 md:col-span-6">
                        <div className="text-white/55 text-xs mb-2">Pasta</div>
                        <select
                          value={folderId}
                          onChange={(e) => setFolderId(e.target.value)}
                          className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                        >
                          <option value="">Sem pasta</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>

                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            className="flex-1 h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                            placeholder="Criar pasta rápida…"
                          />
                          <button
                            type="button"
                            onClick={createFolderQuick}
                            className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm"
                          >
                            <Icon name="plus" />
                          </button>
                        </div>
                      </div>

                      <div className="col-span-12 md:col-span-6">
                        <div className="text-white/55 text-xs mb-2">Tags</div>
                        <div className="flex flex-wrap gap-2">
                          {tags.map((t) => (
                            <Pill key={t.id} active={tagIds.includes(t.id)} onClick={() => toggleFormTag(t.id)}>
                              {t.name}
                            </Pill>
                          ))}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            className="flex-1 h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                            placeholder="Criar tag rápida…"
                          />
                          <button
                            type="button"
                            onClick={createTagQuick}
                            className="h-10 px-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-white/85 text-sm"
                          >
                            <Icon name="plus" />
                          </button>
                        </div>
                      </div>
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
                        {file ? 'Trocar imagem' : 'Upload imagem (opcional)'}
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
                        <div className="text-white/60 text-sm truncate">{file.name}</div>
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
                        'h-[200px] w-full grid place-items-center',
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

                {openEdit ? (
                  <button
                    type="button"
                    onClick={onSaveEdit}
                    disabled={saving}
                    className={cx(
                      'h-10 px-4 rounded-xl border border-white/10',
                      'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                      'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                      'text-sm font-medium',
                      saving && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    {saving ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onCreate}
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
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
