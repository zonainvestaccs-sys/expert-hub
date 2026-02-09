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
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type UtilityTag = { id: string; name: string; color?: string | null };
type UtilityFolderNode = { id: string; name: string; parentId?: string | null; orderIndex: number; children: UtilityFolderNode[] };

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
  updatedAt?: string | null;
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
function Icon(props: { name: 'plus' | 'trash' | 'edit' | 'refresh' | 'close' | 'upload' | 'folder' | 'tag' | 'chevR' | 'chevD' | 'dots' }) {
  const { name } = props;
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' as const };

  if (name === 'plus') return (
    <svg {...common}>
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );

  if (name === 'trash') return (
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

  if (name === 'edit') return (
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

  if (name === 'refresh') return (
    <svg {...common}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (name === 'close') return (
    <svg {...common}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );

  if (name === 'upload') return (
    <svg {...common}>
      <path d="M12 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );

  if (name === 'folder') return (
    <svg {...common}>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );

  if (name === 'tag') return (
    <svg {...common}>
      <path d="M20 10V4h-6L4 14l6 6 10-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.5 7.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );

  if (name === 'chevR') return (
    <svg {...common}>
      <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (name === 'chevD') return (
    <svg {...common}>
      <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <svg {...common}>
      <path d="M12 5h.01M12 12h.01M12 19h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** ===== UI helpers ===== */
function CardShell({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-2xl border border-white/10',
        'bg-gradient-to-b from-white/[0.055] to-white/[0.02]',
        'shadow-[0_18px_70px_rgba(0,0,0,0.42)]',
        'transition-all duration-200',
        'hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/[0.035]',
        'hover:shadow-[0_26px_90px_rgba(0,0,0,0.55)]',
        onClick && 'cursor-pointer',
        'overflow-hidden',
      )}
    >
      {children}
    </div>
  );
}

function Pill({ text, color }: { text: string; color?: string | null }) {
  const bg = color ? `${color}22` : 'rgba(255,255,255,0.08)';
  const bd = color ? `${color}55` : 'rgba(255,255,255,0.12)';
  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 h-7 rounded-full text-xs text-white/85 border"
      style={{ background: bg, borderColor: bd }}
      title={text}
    >
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color || 'rgba(255,255,255,0.5)' }} />
      <span className="truncate max-w-[140px]">{text}</span>
    </span>
  );
}

/** ===== Sortable row (Drive-like list row) ===== */
function SortableRow(props: {
  item: UtilityItem;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
  hiddenTagIds: Set<string>;
  setHiddenTagIds: (next: Set<string>) => void;
}) {
  const { item, onEdit, onDelete, onOpen, hiddenTagIds, setHiddenTagIds } = props;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  const img = resolveImageUrl(item.imageUrl);

  return (
    <div ref={setNodeRef} style={style} className={cx('group', isDragging && 'z-50')}>
      <div className={cx(
        'rounded-2xl border border-white/10 bg-white/[0.02]',
        'hover:bg-white/[0.04] hover:border-white/20 transition',
        'px-3 py-3 flex items-center gap-3'
      )}>
        {/* drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 h-10 w-10 rounded-xl border border-white/10 bg-black/20 grid place-items-center text-white/55 hover:text-white/80 cursor-grab active:cursor-grabbing"
          title="Arrastar para reordenar"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="dots" />
        </div>

        {/* preview larger */}
        <div
          className="shrink-0 h-14 w-14 rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]"
          onClick={onOpen}
          title="Abrir"
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-white/60">
              <Icon name="folder" />
            </div>
          )}
        </div>

        {/* content */}
        <div className="min-w-0 flex-1" onClick={onOpen} title="Abrir">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-white/92 font-semibold truncate">{item.name}</div>
              <div className="text-white/45 text-xs truncate mt-1">{item.url}</div>
              {item.description ? <div className="text-white/55 text-xs mt-1 line-clamp-1">{item.description}</div> : null}
            </div>

            {/* icon actions */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] transition grid place-items-center text-white/85"
                title="Editar"
                aria-label="Editar"
              >
                <Icon name="edit" />
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="h-9 w-9 rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/15 transition grid place-items-center text-red-200"
                title="Excluir"
                aria-label="Excluir"
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>

          {/* tags line */}
          {item.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.map((t) => (
                <span key={t.id} onClick={(e) => e.stopPropagation()}>
                  <Pill text={t.name} color={t.color} />
                </span>
              ))}
            </div>
          ) : null}

          {/* sidebar tag preference: quick hide/unhide from sidebar (local only) */}
          {item.tags?.length ? (
            <div className="mt-2 text-[11px] text-white/40 flex flex-wrap gap-2">
              {item.tags.map((t) => {
                const hidden = hiddenTagIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = new Set(hiddenTagIds);
                      if (hidden) next.delete(t.id);
                      else next.add(t.id);
                      setHiddenTagIds(next);
                      localStorage.setItem('admin_util_hidden_tags', JSON.stringify(Array.from(next)));
                    }}
                    className={cx(
                      'px-2 py-1 rounded-lg border transition',
                      hidden
                        ? 'border-white/10 bg-white/[0.02] text-white/45 hover:bg-white/[0.04]'
                        : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]',
                    )}
                    title={hidden ? 'Mostrar esta tag no sidebar' : 'Ocultar esta tag no sidebar'}
                  >
                    {hidden ? `Mostrar "${t.name}" no sidebar` : `Ocultar "${t.name}" no sidebar`}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** ===== Folder tree (Drive-like sidebar) ===== */
function FolderTree(props: {
  roots: UtilityFolderNode[];
  activeFolderId: string | null;
  onOpenFolder: (folderId: string | null) => void;
}) {
  const { roots, activeFolderId, onOpenFolder } = props;

  const [open, setOpen] = useState<Record<string, boolean>>({});

  function Row({ node, depth }: { node: UtilityFolderNode; depth: number }) {
    const hasKids = (node.children || []).length > 0;
    const isOpen = open[node.id] ?? true;
    const active = activeFolderId === node.id;

    return (
      <div>
        <div
          className={cx(
            'flex items-center gap-2 rounded-xl px-2 py-2 cursor-pointer transition',
            active ? 'bg-white/[0.06] border border-white/10' : 'hover:bg-white/[0.04]',
          )}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onOpenFolder(node.id)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!hasKids) return;
              setOpen((p) => ({ ...p, [node.id]: !isOpen }));
            }}
            className={cx(
              'h-7 w-7 rounded-lg grid place-items-center',
              hasKids ? 'text-white/70 hover:bg-white/[0.06]' : 'text-white/20',
            )}
            aria-label="Expandir"
            title={hasKids ? 'Expandir' : ''}
          >
            {hasKids ? <Icon name={isOpen ? 'chevD' : 'chevR'} /> : null}
          </button>

          <div className="text-white/85 text-sm truncate flex items-center gap-2">
            <Icon name="folder" />
            <span className="truncate">{node.name}</span>
          </div>
        </div>

        {hasKids && isOpen ? (
          <div className="mt-1 space-y-1">
            {node.children.map((c) => <Row key={c.id} node={c} depth={depth + 1} />)}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        className={cx(
          'flex items-center gap-2 rounded-xl px-2 py-2 cursor-pointer transition',
          activeFolderId === null ? 'bg-white/[0.06] border border-white/10' : 'hover:bg-white/[0.04]',
        )}
        onClick={() => onOpenFolder(null)}
      >
        <div className="h-7 w-7 rounded-lg grid place-items-center text-white/70">
          <Icon name="folder" />
        </div>
        <div className="text-white/85 text-sm truncate">Meu Drive</div>
      </div>

      <div className="mt-2 space-y-1">
        {roots.map((n) => <Row key={n.id} node={n} depth={0} />)}
      </div>
    </div>
  );
}

/** ===== Breadcrumb ===== */
function buildBreadcrumb(roots: UtilityFolderNode[], activeFolderId: string | null) {
  if (!activeFolderId) return [{ id: null as any, name: 'Meu Drive' }];

  const byId = new Map<string, UtilityFolderNode>();
  const parent = new Map<string, string | null>();

  const walk = (node: UtilityFolderNode) => {
    byId.set(node.id, node);
    (node.children || []).forEach((c) => {
      parent.set(c.id, node.id);
      walk(c);
    });
  };
  roots.forEach((r) => {
    parent.set(r.id, null);
    walk(r);
  });

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

/** ===== Page ===== */
export default function AdminUtilitiesPage() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // drive state
  const [folders, setFolders] = useState<UtilityFolderNode[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // tags
  const [tags, setTags] = useState<UtilityTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [hiddenTagIds, setHiddenTagIds] = useState<Set<string>>(new Set());

  // list
  const [items, setItems] = useState<UtilityItem[]>([]);
  const [q, setQ] = useState('');

  // create/edit modal
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

  // tags manager (color + delete)
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#7C3AED');
  const [tagSaving, setTagSaving] = useState(false);
  const [tagErr, setTagErr] = useState('');

  // folders menu
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderErr, setFolderErr] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const breadcrumb = useMemo(() => buildBreadcrumb(folders, activeFolderId), [folders, activeFolderId]);

  /** ===== Load initial ===== */
  const loadFolders = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) throw new Error('Sem token');
    const data = await apiFetch<{ items: UtilityFolderNode[] }>('/utility-folders', { token });
    setFolders(Array.isArray(data?.items) ? data.items : []);
  }, []);

  const loadTags = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) throw new Error('Sem token');
    const data = await apiFetch<{ items: UtilityTag[] }>('/utility-tags', { token });
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
      // root: não passa folderId e backend retorna folderId=null
      if (q.trim()) params.set('q', q.trim());
      if (selectedTagIds.length) params.set('tagIds', selectedTagIds.join(','));

      const data = await apiFetch<{ items: UtilityItem[] }>(`/utilities?${params.toString()}`, { token });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao carregar utilidades';
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

    // hidden tags local pref
    try {
      const raw = localStorage.getItem('admin_util_hidden_tags');
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) setHiddenTagIds(new Set(ids.map(String)));
      }
    } catch {}

    (async () => {
      await Promise.all([loadFolders(), loadTags()]);
      await loadItems();
    })();
  }, [router, loadFolders, loadTags, loadItems]);

  /** ===== Modal helpers ===== */
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
        await apiUpload<UtilityItem>('/utilities', { token, formData: fd, method: 'POST' });
      } else {
        await apiUpload<UtilityItem>(`/utilities/${encodeURIComponent(editingId)}`, { token, formData: fd, method: 'PATCH' });
      }

      closeModal();
      await loadItems();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao salvar utilidade';
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

      await apiFetch(`/utilities/${encodeURIComponent(id)}`, { token, method: 'DELETE' });
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

  /** ===== Top filters ===== */
  const visibleTagsForSidebar = useMemo(() => {
    // tags list display = not hidden by preference
    return tags.filter((t) => !hiddenTagIds.has(t.id));
  }, [tags, hiddenTagIds]);

  function toggleSelectedTag(id: string) {
    setSelectedTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  /** ===== Folder nav ===== */
  function openFolder(folderId: string | null) {
    setActiveFolderId(folderId);
    // reset filters optional? keep tags selection and q
    // reload
    setTimeout(() => loadItems(), 0);
  }

  /** ===== DnD reorder ===== */
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

    // persist
    try {
      const token = tokenRef.current;
      if (!token) return;
      await apiFetch('/utilities/reorder', {
        token,
        method: 'POST',
        body: { orderedIds: next.map((x) => x.id) },
      });
    } catch {
      // fallback reload
      await loadItems();
    }
  }

  /** ===== Tags manager ===== */
  async function createTag() {
    setTagErr('');
    setTagSaving(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const nm = tagName.trim();
      if (!nm) throw new Error('Nome da tag obrigatório');

      await apiFetch('/utility-tags', {
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
      await apiFetch(`/utility-tags/${encodeURIComponent(tagId)}`, { token, method: 'DELETE' });
      await loadTags();
      setSelectedTagIds((p) => p.filter((x) => x !== tagId));
    } catch (e: any) {
      window.alert(typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao excluir tag');
    }
  }

  /** ===== Folders manager ===== */
  async function createFolder() {
    setFolderErr('');
    setFolderSaving(true);
    try {
      const token = tokenRef.current;
      if (!token) throw new Error('Sem token');

      const nm = folderName.trim();
      if (!nm) throw new Error('Nome da pasta obrigatório');

      await apiFetch('/utility-folders', {
        token,
        method: 'POST',
        body: { name: nm, parentId: folderParentId },
      });

      setFolderName('');
      setFolderParentId(activeFolderId); // convenience
      await loadFolders();
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : e?.error || 'Falha ao criar pasta';
      setFolderErr(msg);
    } finally {
      setFolderSaving(false);
    }
  }

  /** ===== Layout ===== */
  return (
    <div className="relative">
      {/* TOP BAR: title + breadcrumb + top menus */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white/92 font-semibold tracking-tight text-[18px]">Utilidades</div>

            {/* breadcrumb like Drive */}
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-white/55">
              {breadcrumb.map((b, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => openFolder(b.id)}
                  className={cx(
                    'px-2 py-1 rounded-lg hover:bg-white/[0.05] transition',
                    idx === breadcrumb.length - 1 && 'bg-white/[0.05] border border-white/10 text-white/80',
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          {/* menus at top, beside Atualizar and + */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Folder menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setFoldersOpen((v) => !v)}
                className={cx(
                  'h-10 px-4 rounded-xl border border-white/10',
                  'bg-white/[0.03] hover:bg-white/[0.06] transition',
                  'text-white/85 text-sm font-medium flex items-center gap-2',
                )}
              >
                <Icon name="folder" />
                Pastas
              </button>

              {foldersOpen ? (
                <div className="absolute right-0 mt-2 w-[320px] rounded-2xl border border-white/10 bg-[#0B1022]/95 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.70)] p-3 z-50">
                  {folderErr ? <div className="mb-2 text-xs text-red-200">{folderErr}</div> : null}

                  <div className="text-white/70 text-xs mb-2">Criar pasta (como Drive)</div>
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

                  <div className="text-white/45 text-[11px] mt-2">
                    Parent: {activeFolderId ? 'Pasta atual' : 'Meu Drive'}
                  </div>

                  <div className="mt-3 h-px bg-white/10" />

                  <div className="mt-3 text-white/70 text-xs mb-2">Navegação rápida</div>
                  <div className="max-h-[280px] overflow-auto pr-1">
                    <FolderTree roots={folders} activeFolderId={activeFolderId} onOpenFolder={(id) => { openFolder(id); setFoldersOpen(false); }} />
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

            {/* Tag menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTagsOpen((v) => !v)}
                className={cx(
                  'h-10 px-4 rounded-xl border border-white/10',
                  'bg-white/[0.03] hover:bg-white/[0.06] transition',
                  'text-white/85 text-sm font-medium flex items-center gap-2',
                )}
              >
                <Icon name="tag" />
                Tags
                {selectedTagIds.length ? (
                  <span className="ml-1 inline-flex h-6 px-2 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/80 items-center">
                    {selectedTagIds.length}
                  </span>
                ) : null}
              </button>

              {tagsOpen ? (
                <div className="absolute right-0 mt-2 w-[360px] rounded-2xl border border-white/10 bg-[#0B1022]/95 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.70)] p-3 z-50">
                  {tagErr ? <div className="mb-2 text-xs text-red-200">{tagErr}</div> : null}

                  {/* create tag with color */}
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
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => {
                      const selected = selectedTagIds.includes(t.id);
                      const hidden = hiddenTagIds.has(t.id);

                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSelectedTag(t.id)}
                            className={cx(
                              'h-8 px-3 rounded-full border transition text-xs',
                              selected
                                ? 'bg-white/[0.08] border-white/20 text-white'
                                : 'bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.06]',
                            )}
                            title="Filtrar"
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color || 'rgba(255,255,255,0.5)' }} />
                              {t.name}
                            </span>
                          </button>

                          {/* hide/show sidebar (local pref) */}
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(hiddenTagIds);
                              if (hidden) next.delete(t.id);
                              else next.add(t.id);
                              setHiddenTagIds(next);
                              localStorage.setItem('admin_util_hidden_tags', JSON.stringify(Array.from(next)));
                            }}
                            className={cx(
                              'h-8 px-2 rounded-xl border text-xs transition',
                              hidden
                                ? 'border-white/10 bg-white/[0.02] text-white/45 hover:bg-white/[0.04]'
                                : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]',
                            )}
                            title={hidden ? 'Tag oculta no sidebar' : 'Tag visível no sidebar'}
                          >
                            {hidden ? 'Oculta' : 'Sidebar'}
                          </button>

                          {/* delete */}
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
                      onClick={() => { setSelectedTagIds([]); }}
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
              onKeyDown={(e) => { if (e.key === 'Enter') loadItems(); }}
            />

            <button
              type="button"
              onClick={() => loadItems()}
              className={cx(
                'h-10 px-4 rounded-xl border border-white/10',
                'bg-white/[0.03] hover:bg-white/[0.06] transition',
                'text-white/85 text-sm font-medium flex items-center gap-2',
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

      {/* MAIN: Sidebar + list like Drive */}
      <div className="mt-5 grid grid-cols-12 gap-4">
        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-white/75 text-xs mb-2 flex items-center gap-2">
              <Icon name="folder" /> Pastas
            </div>

            <FolderTree roots={folders} activeFolderId={activeFolderId} onOpenFolder={openFolder} />

            <div className="mt-4 h-px bg-white/10" />

            <div className="mt-4 text-white/75 text-xs mb-2 flex items-center gap-2">
              <Icon name="tag" /> Tags (sidebar)
            </div>

            <div className="flex flex-wrap gap-2">
              {visibleTagsForSidebar.length ? visibleTagsForSidebar.map((t) => {
                const selected = selectedTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleSelectedTag(t.id)}
                    className={cx(
                      'rounded-full border px-3 h-8 text-xs transition',
                      selected ? 'bg-white/[0.08] border-white/20 text-white' : 'bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.06]',
                    )}
                    title="Filtrar por tag"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color || 'rgba(255,255,255,0.5)' }} />
                      {t.name}
                    </span>
                  </button>
                );
              }) : (
                <div className="text-white/45 text-xs">Sem tags visíveis.</div>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="col-span-12 lg:col-span-9">
          {err ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">{err}</div>
          ) : null}

          <div className="mt-0">
            {loading ? (
              <div className="h-[260px] rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-white/55">
                Nenhuma utilidade aqui. Clique em <span className="text-white/80 font-medium">Nova Utilidade</span>.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setActiveDragId(String(e.active.id))}
                onDragEnd={onDragEnd}
                onDragCancel={() => setActiveDragId(null)}
              >
                <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {items.map((it) => (
                      <SortableRow
                        key={it.id}
                        item={it}
                        onOpen={() => openLink(it.url)}
                        onEdit={() => openEdit(it)}
                        onDelete={() => removeUtility(it.id)}
                        hiddenTagIds={hiddenTagIds}
                        setHiddenTagIds={setHiddenTagIds}
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
      </div>

      {/* MODAL create/edit — compact width */}
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
                  <div className="text-white/90 font-semibold tracking-tight">
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

              <div className="p-5">
                {modalErr ? (
                  <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200">
                    {modalErr}
                  </div>
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
                    <div className="text-white/55 text-xs mb-2">Descrição</div>
                    <textarea
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      className="w-full min-h-[90px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white/85 text-sm outline-none focus:border-white/20"
                      placeholder="Opcional..."
                    />
                  </div>

                  <div className="col-span-12">
                    <div className="text-white/55 text-xs mb-2">Pasta</div>
                    <select
                      value={folderIdForItem ?? ''}
                      onChange={(e) => setFolderIdForItem(e.target.value ? e.target.value : null)}
                      className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-white/85 text-sm outline-none focus:border-white/20"
                    >
                      <option value="">(Meu Drive)</option>
                      {flattenFolders(folders).map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-12">
                    <div className="text-white/55 text-xs mb-2">Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((t) => {
                        const sel = tagIdsForItem.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTagIdsForItem((p) => sel ? p.filter((x) => x !== t.id) : [...p, t.id])}
                            className={cx(
                              'h-9 px-3 rounded-full border transition text-xs',
                              sel ? 'bg-white/[0.08] border-white/20 text-white' : 'bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.06]',
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
                  </div>

                  <div className="col-span-12">
                    <div className="text-white/55 text-xs mb-2">Imagem</div>
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

                      {file ? <div className="text-white/60 text-sm truncate">{file.name}</div> : <div className="text-white/45 text-sm">Nenhuma</div>}
                    </div>

                    <div className="mt-3">
                      <div className="text-white/55 text-xs mb-2">Prévia</div>
                      <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02] h-[180px] w-full grid place-items-center">
                        {preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={preview} alt="Prévia" className="h-full w-full object-cover" />
                        ) : (
                          <div className="text-white/55 text-sm">Sem imagem</div>
                        )}
                      </div>
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

/** flatten folder tree for select */
function flattenFolders(roots: UtilityFolderNode[]) {
  const out: Array<{ id: string; label: string }> = [];
  const walk = (n: UtilityFolderNode, depth: number) => {
    out.push({ id: n.id, label: `${'— '.repeat(depth)}${n.name}` });
    (n.children || []).forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return out;
}
