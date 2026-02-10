'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiUpload } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type UtilityTag = { id: string; name: string; color?: string | null };

type UtilityFolderNode = {
  id: string;
  name: string;
  parentId?: string | null;
  orderIndex: number;
  children: UtilityFolderNode[];
};

type UtilityItem = {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  imageUrl?: string | null;
  folderId?: string | null;
  orderIndex?: number;
  tags?: UtilityTag[];
  createdAt?: string | null;
  updatedAt?: string | nullz;
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

/** ===== ICONS ===== */
function Icon(props: {
  name:
    | 'plus'
    | 'trash'
    | 'edit'
    | 'refresh'
    | 'close'
    | 'upload'
    | 'folder'
    | 'tag'
    | 'chevR'
    | 'chevD'
    | 'dots'
    | 'grid'
    | 'spark'
    | 'x';
}) {
  const { name } = props;
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' as const };

  if (name === 'plus')
    return (
      <svg {...common}>
        <path d="M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );

  if (name === 'trash')
    return (
      <svg {...common}>
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

  if (name === 'edit')
    return (
      <svg {...common}>
        <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );

  if (name === 'refresh')
    return (
      <svg {...common}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

  if (name === 'close' || name === 'x')
    return (
      <svg {...common}>
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );

  if (name === 'upload')
    return (
      <svg {...common}>
        <path d="M12 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 14v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );

  if (name === 'folder')
    return (
      <svg {...common}>
        <path
          d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );

  if (name === 'tag')
    return (
      <svg {...common}>
        <path d="M20 10V4h-6L4 14l6 6 10-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14.5 7.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );

  if (name === 'chevR')
    return (
      <svg {...common}>
        <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

  if (name === 'chevD')
    return (
      <svg {...common}>
        <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

  if (name === 'grid')
    return (
      <svg {...common}>
        <path d="M4 4h7v7H4V4Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M13 4h7v7h-7V4Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 13h7v7H4v-7Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M13 13h7v7h-7v-7Z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );

  if (name === 'spark')
    return (
      <svg {...common}>
        <path
          d="M12 2l1.2 4.3L17.5 8l-4.3 1.2L12 13.5l-1.2-4.3L6.5 8l4.3-1.7L12 2Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M19 12l.7 2.4L22 15l-2.3.7L19 18l-.7-2.3L16 15l2.3-.6L19 12Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );

  return (
    <svg {...common}>
      <path d="M12 5h.01M12 12h.01M12 19h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** ===== PREMIUM UI bits ===== */
function PremiumPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-white/10',
        'bg-gradient-to-b from-white/[0.06] to-white/[0.02]',
        'shadow-[0_18px_70px_rgba(0,0,0,0.42)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pill({ text, color }: { text: string; color?: string | null }) {
  const bg = color ? `${color}22` : 'rgba(255,255,255,0.08)';
  const bd = color ? `${color}55` : 'rgba(255,255,255,0.14)';
  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 h-7 rounded-full text-xs text-white/85 border"
      style={{ background: bg, borderColor: bd }}
      title={text}
    >
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color || 'rgba(255,255,255,0.55)' }} />
      <span className="truncate max-w-[160px]">{text}</span>
    </span>
  );
}

function Collapsible(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const { title, open, onToggle, children, right } = props;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition"
      >
        <div className="flex items-center gap-2 text-white/85">
          <Icon name={open ? 'chevD' : 'chevR'} />
          <span className="font-medium text-sm">{title}</span>
        </div>
        {right}
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

/** ===== Folder helpers ===== */
function buildMaps(roots: UtilityFolderNode[]) {
  const byId = new Map<string, UtilityFolderNode>();
  const parent = new Map<string, string | null>();

  const walk = (node: UtilityFolderNode, parentId: string | null) => {
    byId.set(node.id, node);
    parent.set(node.id, parentId);
    (node.children || []).forEach((c) => walk(c, node.id));
  };

  roots.forEach((r) => walk(r, null));
  return { byId, parent };
}

function buildBreadcrumb(roots: UtilityFolderNode[], activeFolderId: string | null) {
  if (!activeFolderId) return [{ id: null as any, name: 'Meu Drive' }];

  const { byId, parent } = buildMaps(roots);

  const out: Array<{ id: string | null; name: string }> = [{ id: null, name: 'Meu Drive' }];

  let cur: string | null = activeFolderId;
  const stack: string[] = [];
  while (cur) {
    stack.push(cur);
    cur = parent.get(cur) ?? null;
  }
  stack.reverse();

  for (const id of stack) {
    const node = byId.get(id);
    if (node) out.push({ id: node.id, name: node.name });
  }
  return out;
}

function getChildrenFolders(roots: UtilityFolderNode[], activeFolderId: string | null) {
  if (!activeFolderId) {
    return roots
      .slice()
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.name.localeCompare(b.name));
  }

  const { byId } = buildMaps(roots);
  const node = byId.get(activeFolderId);
  if (!node) return [];
  return (node.children || [])
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.name.localeCompare(b.name));
}

function flattenFoldersForSelect(roots: UtilityFolderNode[]) {
  const out: Array<{ id: string; label: string }> = [];
  const walk = (n: UtilityFolderNode, depth: number) => {
    out.push({ id: n.id, label: `${'— '.repeat(depth)}${n.name}` });
    (n.children || []).forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return out;
}

/** ===== Folder Card ===== */
function FolderCard(props: { name: string; onOpen: () => void; onDelete?: () => void }) {
  const { name, onOpen, onDelete } = props;
  return (
    <div
      className={cx(
        'group relative rounded-2xl border border-white/10 overflow-hidden',
        'bg-gradient-to-b from-white/[0.06] to-white/[0.02]',
        'shadow-[0_18px_70px_rgba(0,0,0,0.35)]',
        'hover:border-white/20 hover:bg-white/[0.035] hover:shadow-[0_26px_90px_rgba(0,0,0,0.55)]',
        'transition-all duration-200 cursor-pointer',
      )}
      onClick={onOpen}
      title="Abrir pasta"
    >
      <div className="p-4 flex items-center gap-3">
        <div className="h-14 w-14 rounded-2xl border border-white/10 bg-white/[0.03] grid place-items-center text-white/80">
          <Icon name="folder" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-white/92 font-semibold text-[15px] truncate">{name}</div>
          <div className="text-white/45 text-xs mt-1">Pasta</div>
        </div>

        {onDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 transition h-9 w-9 rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/15 grid place-items-center text-red-200"
            title="Excluir pasta"
            aria-label="Excluir pasta"
          >
            <Icon name="trash" />
          </button>
        ) : null}
      </div>
      <div className="h-px bg-white/10" />
      <div className="p-4 text-white/50 text-xs">Clique para abrir</div>
    </div>
  );
}

/** ===== Utility Card (Grid) ===== */
function SortableUtilityCard(props: { item: UtilityItem; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const { item, onOpen, onEdit, onDelete } = props;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.78 : 1,
  };

  const img = resolveImageUrl(item.imageUrl);

  return (
    <div ref={setNodeRef} style={style} className={cx(isDragging && 'z-50')}>
      <div
        className={cx(
          'group relative rounded-2xl border border-white/10 overflow-hidden',
          'bg-gradient-to-b from-white/[0.06] to-white/[0.02]',
          'shadow-[0_18px_70px_rgba(0,0,0,0.35)]',
          'hover:border-white/20 hover:bg-white/[0.035] hover:shadow-[0_26px_90px_rgba(0,0,0,0.55)]',
          'transition-all duration-200',
        )}
      >
        <div className="relative">
          <div className={cx('h-[160px] w-full overflow-hidden', 'bg-white/[0.03]', 'cursor-pointer')} onClick={onOpen} title="Abrir link">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={item.name}
                className="h-full w-full object-cover scale-[1.02] group-hover:scale-[1.05] transition-transform duration-300"
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-white/55">
                <Icon name="spark" />
              </div>
            )}
          </div>

          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className={cx(
              'absolute top-3 left-3 h-10 w-10 rounded-xl',
              'border border-white/10 bg-black/35 backdrop-blur',
              'text-white/75 hover:text-white hover:bg-black/45 transition',
              'grid place-items-center cursor-grab active:cursor-grabbing',
              'opacity-0 group-hover:opacity-100',
            )}
            title="Arrastar para reordenar"
            aria-label="Arrastar"
          >
            <Icon name="dots" />
          </button>

          <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="h-10 w-10 rounded-xl border border-white/10 bg-black/35 backdrop-blur hover:bg-black/45 transition grid place-items-center text-white/90"
              title="Editar"
              aria-label="Editar"
            >
              <Icon name="edit" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-10 w-10 rounded-xl border border-red-500/25 bg-red-500/15 backdrop-blur hover:bg-red-500/20 transition grid place-items-center text-red-200"
              title="Excluir"
              aria-label="Excluir"
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="text-white font-semibold text-[16px] leading-snug line-clamp-2">{item.name}</div>

          {item.description ? (
            <div className="mt-2 text-white/80 text-[13px] leading-relaxed line-clamp-2">{item.description}</div>
          ) : (
            <div className="mt-2 text-white/35 text-[13px] italic">Sem descrição</div>
          )}

          <div className="mt-3 text-white/50 text-xs truncate">{item.url}</div>

          {item.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.tags.map((t) => (
                <Pill key={t.id} text={t.name} color={t.color} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** ===== Page ===== */
export default function AdminUtilitiesPage() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [folders, setFolders] = useState<UtilityFolderNode[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [tags, setTags] = useState<UtilityTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [q, setQ] = useState('');

  const [items, setItems] = useState<UtilityItem[]>([]);

  const [foldersOpen, setFoldersOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  const [folderName, setFolderName] = useState('');
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderErr, setFolderErr] = useState('');

  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#7C3AED');
  const [tagSaving, setTagSaving] = useState(false);
  const [tagErr, setTagErr] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState('');

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [folderIdForItem, setFolderIdForItem] = useState<string | null>(null);
  const [tagIdsForItem, setTagIdsForItem] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');

  const [drawerFolderOpen, setDrawerFolderOpen] = useState(true);
  const [drawerTagsOpen, setDrawerTagsOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const breadcrumb = useMemo(() => buildBreadcrumb(folders, activeFolderId), [folders, activeFolderId]);
  const childFolders = useMemo(() => getChildrenFolders(folders, activeFolderId), [folders, activeFolderId]);
  const folderSelectOptions = useMemo(() => flattenFoldersForSelect(folders), [folders]);

  /** ===== loaders (IMPORTANT: /admin prefix) ===== */
  const loadFolders = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) throw new Error('Sem token');

    const data = await apiFetch<{ items: UtilityFolderNode[] }>('/admin/utility-folders', { token });
    setFolders(Array.isArray(data?.items) ? data.items : []);
  }, []);

  const loadTags = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) throw new Error('Sem token');

    const data = await apiFetch<{ items: UtilityTag[] }>('/admin/utility-tags', { token });
    setTags(Array.isArray(data?.items) ? data.items : []);
  }, []);

  const loadItems = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const params = new URLSearchParams();
      if (activeFolderId) params.set('folderId', activeFolderId);
      if (q.trim()) params.set('q', q.trim());
      if (selectedTagIds.length) params.set('tagIds', selectedTagIds.join(','));

      const data = await apiFetch<{ items: UtilityItem[] }>(`/admin/utilities?${params.toString()}`, { token });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [activeFolderId, q, selectedTagIds]);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      clearToken();
      router.replace('/login');
      return;
    }
    tokenRef.current = t;

    (async () => {
      await Promise.all([loadFolders(), loadTags()]);
      await loadItems();
    })();
  }, [router, loadFolders, loadTags, loadItems]);

  /** ===== actions ===== */
  function openFolder(folderId: string | null) {
    setActiveFolderId(folderId);
    setTimeout(() => loadItems(), 0);
  }

  function openLink(u: string) {
    const lk = normalizeUrl(u);
    window.open(lk, '_blank', 'noopener,noreferrer');
  }

  function resetModal() {
    setModalErr('');
    setEditingId(null);
    setName('');
    setUrl('');
    setDesc('');
    setFolderIdForItem(activeFolderId);
    setTagIdsForItem([]);
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setDrawerFolderOpen(true);
    setDrawerTagsOpen(true);
  }

  function openCreate() {
    resetModal();
    setFolderIdForItem(activeFolderId);
    setModalOpen(true);
  }

  function openEdit(it: UtilityItem) {
    resetModal();
    setEditingId(it.id);
    setName(it.name || '');
    setUrl(it.url || '');
    setDesc(it.description || '');
    setFolderIdForItem(it.folderId ?? null);
    setTagIdsForItem((it.tags || []).map((t) => t.id));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetModal();
  }

  function pickFile() {
    setModalErr('');
    fileInputRef.current?.click();
  }

  function onFileSelected(f?: File) {
    setModalErr('');
    if (!f) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(f.type)) {
      setModalErr('Arquivo inválido. Envie png/jpg/jpeg/webp.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setModalErr('Arquivo muito grande. Limite: 5MB.');
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    const local = URL.createObjectURL(f);
    setPreview(local);
    setFile(f);
  }

  async function saveUtility() {
    setModalErr('');
    setSaving(true);
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
      fd.append('description', desc || '');
      if (folderIdForItem) fd.append('folderId', folderIdForItem);
      fd.append('tagIds', tagIdsForItem.join(','));
      if (file) fd.append('file', file);

      if (!editingId) {
        await apiUpload<UtilityItem>('/admin/utilities', { token, formData: fd, method: 'POST' });
      } else {
        await apiUpload<UtilityItem>(`/admin/utilities/${encodeURIComponent(editingId)}`, {
          token,
          formData: fd,
          method: 'PATCH',
        });
      }

      closeModal();
      await loadItems();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao salvar';
      setModalErr(msg);
    } finally {
      setSaving(false);
    }
  }

  async function removeUtility(id: string) {
    const ok = window.confirm('Tem certeza que deseja excluir esta utilidade?');
    if (!ok) return;

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      await apiFetch(`/admin/utilities/${encodeURIComponent(id)}`, { token, method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      window.alert(typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao excluir');
    }
  }

  function toggleSelectedTag(id: string) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** ===== Top menu: folders ===== */
  async function createFolder() {
    setFolderErr('');
    setFolderSaving(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const nm = folderName.trim();
      if (!nm) throw new Error('Nome da pasta obrigatório');

      await apiFetch('/admin/utility-folders', {
        token,
        method: 'POST',
        body: {
          name: nm,
          parentId: activeFolderId,
        },
      });

      setFolderName('');
      await loadFolders();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao criar pasta';
      setFolderErr(msg);
    } finally {
      setFolderSaving(false);
    }
  }

  async function deleteFolder(folderId: string) {
    const ok = window.confirm('Excluir esta pasta? (Se tiver itens dentro, o backend pode bloquear.)');
    if (!ok) return;

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      await apiFetch(`/admin/utility-folders/${encodeURIComponent(folderId)}`, { token, method: 'DELETE' });

      if (activeFolderId === folderId) setActiveFolderId(null);

      await loadFolders();
      await loadItems();
    } catch (e: any) {
      window.alert(typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao excluir pasta');
    }
  }

  /** ===== Top menu: tags ===== */
  async function createTag() {
    setTagErr('');
    setTagSaving(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const nm = tagName.trim();
      if (!nm) throw new Error('Nome da tag obrigatório');

      await apiFetch('/admin/utility-tags', {
        token,
        method: 'POST',
        body: { name: nm, color: tagColor },
      });

      setTagName('');
      await loadTags();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao criar tag';
      setTagErr(msg);
    } finally {
      setTagSaving(false);
    }
  }

  async function deleteTag(tagId: string) {
    const ok = window.confirm('Excluir tag? Ela será removida das utilidades.');
    if (!ok) return;

    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');
      await apiFetch(`/admin/utility-tags/${encodeURIComponent(tagId)}`, { token, method: 'DELETE' });
      await loadTags();
      setSelectedTagIds((p) => p.filter((x) => x !== tagId));
    } catch (e: any) {
      window.alert(typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao excluir tag');
    }
  }

  /** ===== DnD reorder utilities ===== */
  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveDragId(null);

    if (!over) return;
    if (active.id === over.id) return;

    const oldIndex = items.findIndex((x) => x.id === active.id);
    const newIndex = items.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    try {
      const token = tokenRef.current;
      if (!token) return;
      await apiFetch('/admin/utilities/reorder', {
        token,
        method: 'POST',
        body: { orderedIds: next.map((x) => x.id) },
      });
    } catch {
      await loadItems();
    }
  }

  const hasAny = childFolders.length > 0 || items.length > 0;

  return (
    <div className="relative">
      {/* TOP BAR */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white font-semibold tracking-tight text-[20px] flex items-center gap-2">
              <Icon name="grid" />
              Utilidades
            </div>

            {/* breadcrumb like Drive */}
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-white/55">
              {breadcrumb.map((b, idx) => (
                <button
                  key={`${b.id ?? 'root'}_${idx}`}
                  type="button"
                  onClick={() => openFolder(b.id)}
                  className={cx(
                    'px-2 py-1 rounded-lg hover:bg-white/[0.05] transition',
                    idx === breadcrumb.length - 1 && 'bg-white/[0.06] border border-white/10 text-white/85',
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Folders drawer */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setFoldersOpen((v) => !v);
                  setTagsOpen(false);
                }}
                className={cx(
                  'h-10 px-4 rounded-xl border border-white/10',
                  'bg-white/[0.03] hover:bg-white/[0.06] transition',
                  'text-white/90 text-sm font-medium flex items-center gap-2',
                )}
              >
                <Icon name="folder" />
                Pastas
              </button>

              {foldersOpen ? (
                <div className="absolute right-0 mt-2 w-[360px] rounded-2xl border border-white/10 bg-[#0B1022]/95 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.70)] p-3 z-50">
                  {folderErr ? <div className="mb-2 text-xs text-red-200">{folderErr}</div> : null}

                  <div className="text-white/75 text-xs mb-2">
                    Criar pasta dentro de:{' '}
                    <span className="text-white/90">{breadcrumb[breadcrumb.length - 1]?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      className="flex-1 h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none"
                      placeholder="Nome da pasta"
                    />
                    <button
                      type="button"
                      onClick={createFolder}
                      disabled={folderSaving}
                      className={cx(
                        'h-10 px-3 rounded-xl border border-white/10',
                        'bg-white/[0.04] hover:bg-white/[0.08] transition text-white/85 text-sm',
                        folderSaving && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      Criar
                    </button>
                  </div>

                  <div className="mt-3 h-px bg-white/10" />

                  <div className="mt-3 text-white/70 text-xs mb-2">Pastas aqui</div>
                  <div className="max-h-[260px] overflow-auto pr-1 space-y-2">
                    {childFolders.length ? (
                      childFolders.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              openFolder(f.id);
                              setFoldersOpen(false);
                            }}
                            className="min-w-0 flex-1 text-left text-white/85 text-sm truncate hover:text-white"
                            title="Abrir"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Icon name="folder" />
                              {f.name}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteFolder(f.id)}
                            className="h-9 w-9 rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/15 transition grid place-items-center text-red-200"
                            title="Excluir pasta"
                            aria-label="Excluir pasta"
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-white/45 text-xs">Nenhuma pasta aqui.</div>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setFoldersOpen(false)}
                      className="h-9 px-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition text-white/75 text-sm"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Tags drawer */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setTagsOpen((v) => !v);
                  setFoldersOpen(false);
                }}
                className={cx(
                  'h-10 px-4 rounded-xl border border-white/10',
                  'bg-white/[0.03] hover:bg-white/[0.06] transition',
                  'text-white/90 text-sm font-medium flex items-center gap-2',
                )}
              >
                <Icon name="tag" />
                Tags
                {selectedTagIds.length ? (
                  <span className="ml-1 inline-flex h-6 px-2 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/85 items-center">
                    {selectedTagIds.length}
                  </span>
                ) : null}
              </button>

              {tagsOpen ? (
                <div className="absolute right-0 mt-2 w-[420px] rounded-2xl border border-white/10 bg-[#0B1022]/95 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.70)] p-3 z-50">
                  {tagErr ? <div className="mb-2 text-xs text-red-200">{tagErr}</div> : null}

                  <div className="text-white/70 text-xs mb-2">Criar tag (com cor)</div>
                  <div className="flex items-center gap-2">
                    <input
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      className="flex-1 h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none"
                      placeholder="Nome da tag"
                    />
                    <input
                      type="color"
                      value={tagColor}
                      onChange={(e) => setTagColor(e.target.value)}
                      className="h-10 w-12 rounded-xl border border-white/10 bg-black/30 p-1"
                      title="Escolher cor"
                    />
                    <button
                      type="button"
                      onClick={createTag}
                      disabled={tagSaving}
                      className={cx(
                        'h-10 px-3 rounded-xl border border-white/10',
                        'bg-white/[0.04] hover:bg-white/[0.08] transition text-white/85 text-sm',
                        tagSaving && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      Criar
                    </button>
                  </div>

                  <div className="mt-3 h-px bg-white/10" />

                  <div className="mt-3 text-white/70 text-xs mb-2">Filtrar por tags</div>
                  <div className="flex flex-wrap gap-2 max-h-[260px] overflow-auto pr-1">
                    {tags.map((t) => {
                      const selected = selectedTagIds.includes(t.id);
                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSelectedTag(t.id)}
                            className={cx(
                              'h-8 px-3 rounded-full border transition text-xs',
                              selected
                                ? 'bg-white/[0.10] border-white/25 text-white'
                                : 'bg-white/[0.03] border-white/10 text-white/85 hover:bg-white/[0.06]',
                            )}
                            title="Filtrar"
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color || 'rgba(255,255,255,0.5)' }} />
                              {t.name}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteTag(t.id)}
                            className="h-8 w-8 rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/15 transition grid place-items-center text-red-200"
                            title="Excluir tag"
                            aria-label="Excluir tag"
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTagIds([]);
                        loadItems();
                      }}
                      className="h-9 px-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition text-white/75 text-sm"
                    >
                      Limpar filtros
                    </button>

                    <button
                      type="button"
                      onClick={() => setTagsOpen(false)}
                      className="h-9 px-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition text-white/75 text-sm"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* search */}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-[240px] max-w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
              placeholder="Buscar..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadItems();
              }}
            />

            <button
              type="button"
              onClick={() => loadItems()}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-white/[0.03] hover:bg-white/[0.06] transition',
                'text-white/90 text-sm font-medium flex items-center gap-2',
              )}
            >
              <Icon name="refresh" />
              Atualizar
            </button>

            <button
              type="button"
              onClick={openCreate}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                'text-sm font-medium flex items-center gap-2',
              )}
            >
              <Icon name="plus" />
              Nova Utilidade
            </button>
          </div>
        </div>
      </div>

      {/* MAIN GRID (Drive-like) */}
      <div className="mt-5">
        {err ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
        ) : null}

        {loading ? (
          <div className="h-[260px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
        ) : !hasAny ? (
          <PremiumPanel className="px-6 py-10 text-center text-white/55">
            Nada aqui ainda. Crie uma pasta ou uma utilidade.
          </PremiumPanel>
        ) : (
          <div className="space-y-6">
            {/* Folders section */}
            {childFolders.length ? (
              <div>
                <div className="text-white/75 text-xs mb-3 flex items-center gap-2">
                  <Icon name="folder" /> Pastas
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {childFolders.map((f) => (
                    <FolderCard key={f.id} name={f.name} onOpen={() => openFolder(f.id)} onDelete={() => deleteFolder(f.id)} />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Utilities section */}
            <div>
              <div className="text-white/75 text-xs mb-3 flex items-center gap-2">
                <Icon name="spark" /> Utilidades
              </div>

              {items.length === 0 ? (
                <PremiumPanel className="px-6 py-10 text-center text-white/55">Nenhuma utilidade nesta pasta.</PremiumPanel>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={(e) => setActiveDragId(String(e.active.id))}
                  onDragEnd={onDragEnd}
                  onDragCancel={() => setActiveDragId(null)}
                >
                  <SortableContext items={items.map((x) => x.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {items.map((it) => (
                        <SortableUtilityCard
                          key={it.id}
                          item={it}
                          onOpen={() => openLink(it.url)}
                          onEdit={() => openEdit(it)}
                          onDelete={() => removeUtility(it.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {activeDragId ? (
                      <div className="rounded-2xl border border-white/15 bg-[#0B1022]/95 px-4 py-3 text-white/85 shadow-[0_30px_120px_rgba(0,0,0,0.70)]">
                        Arrastando…
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL create/edit — smaller + scroll */}
      {modalOpen ? (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/60" onMouseDown={closeModal} aria-hidden="true" />
          <div className="absolute inset-0 grid place-items-center p-4" onMouseDown={closeModal}>
            <div
              className={cx(
                'w-full max-w-[560px] rounded-2xl border border-white/10 overflow-hidden',
                'bg-[#0B1022]/95 backdrop-blur-xl',
                'shadow-[0_30px_120px_rgba(0,0,0,0.70)]',
              )}
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
                <div>
                  <div className="text-white/95 font-semibold tracking-tight text-[16px]">
                    {editingId ? 'Editar utilidade' : 'Nova utilidade'}
                  </div>
                  <div className="text-white/45 text-sm mt-1">Nome + link + imagem + descrição + pasta + tags.</div>
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

              {/* scroll area */}
              <div className="p-5 max-h-[70vh] overflow-auto">
                {modalErr ? (
                  <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{modalErr}</div>
                ) : null}

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12">
                    <div className="text-white/55 text-xs mb-2">Nome</div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                      placeholder="Ex: Google Ads"
                    />
                  </div>

                  <div className="col-span-12">
                    <div className="text-white/55 text-xs mb-2">Link</div>
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                      placeholder="Ex: https://ads.google.com"
                    />
                  </div>

                  <div className="col-span-12">
                    <div className="text-white/55 text-xs mb-2">Descrição (destaque)</div>
                    <textarea
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      className="w-full min-h-[110px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white/90 text-sm outline-none focus:border-white/20"
                      placeholder="Uma descrição curta e útil..."
                    />
                  </div>

                  {/* drawers premium */}
                  <div className="col-span-12 space-y-3">
                    <Collapsible
                      title="Pasta"
                      open={drawerFolderOpen}
                      onToggle={() => setDrawerFolderOpen((v) => !v)}
                      right={<span className="text-white/45 text-xs">{folderIdForItem ? 'Selecionada' : 'Meu Drive'}</span>}
                    >
                      <select
                        value={folderIdForItem ?? ''}
                        onChange={(e) => setFolderIdForItem(e.target.value ? e.target.value : null)}
                        className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                      >
                        <option value="">(Meu Drive)</option>
                        {folderSelectOptions.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-white/45 text-xs">
                        Dica: você está em <span className="text-white/75">{breadcrumb[breadcrumb.length - 1]?.name}</span>
                      </div>
                    </Collapsible>

                    <Collapsible
                      title="Tags"
                      open={drawerTagsOpen}
                      onToggle={() => setDrawerTagsOpen((v) => !v)}
                      right={<span className="text-white/45 text-xs">{tagIdsForItem.length ? `${tagIdsForItem.length} selecionadas` : 'Nenhuma'}</span>}
                    >
                      {tags.length ? (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((t) => {
                            const sel = tagIdsForItem.includes(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setTagIdsForItem((p) => (sel ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                                className={cx(
                                  'h-9 px-3 rounded-full border transition text-xs',
                                  sel
                                    ? 'bg-white/[0.10] border-white/25 text-white'
                                    : 'bg-white/[0.03] border-white/10 text-white/85 hover:bg-white/[0.06]',
                                )}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color || 'rgba(255,255,255,0.5)' }} />
                                  {t.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-white/45 text-sm">Sem tags ainda. Crie no menu “Tags”.</div>
                      )}
                    </Collapsible>

                    <Collapsible title="Imagem (thumbnail grande)" open={true} onToggle={() => {}} right={null}>
                      <div className="flex items-center gap-2">
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
                          Upload (opcional)
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

                        {file ? <div className="text-white/70 text-sm truncate">{file.name}</div> : <div className="text-white/45 text-sm">Nenhuma</div>}
                      </div>

                      <div className="mt-3">
                        <div className="text-white/55 text-xs mb-2">Prévia</div>
                        <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02] h-[220px] w-full grid place-items-center">
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="Prévia" className="h-full w-full object-cover" />
                          ) : (
                            <div className="text-white/55 text-sm">Sem imagem</div>
                          )}
                        </div>
                      </div>
                    </Collapsible>
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
                  onClick={saveUtility}
                  disabled={saving}
                  className={cx(
                    'h-10 px-4 rounded-xl border border-white/10',
                    'bg-gradient-to-r from-[#3E78FF] to-[#6A5CFF] text-white',
                    'shadow-[0_18px_70px_rgba(62,120,255,0.18)] hover:opacity-95 transition',
                    'text-sm font-medium',
                    saving && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
