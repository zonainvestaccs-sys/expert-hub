'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';

type UserRow = {
  id: string;
  email: string;
  role: 'ADMIN' | 'EXPERT';
  isActive: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const token = useMemo(() => getToken(), []);

  async function load() {
    try {
      setErr('');
      setLoading(true);
      const data = await apiFetch<UserRow[]>('/users', { token });
      setRows(data);
    } catch (e: any) {
      const apiErr = e as ApiError;
      setErr(
        typeof apiErr?.message === 'string'
          ? apiErr.message
          : Array.isArray(apiErr?.message)
            ? apiErr.message.join(', ')
            : 'Falha ao carregar usuários',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Admin · Usuários</h1>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.06)',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Carregando...' : 'Recarregar'}
        </button>
      </div>

      {err ? <div style={{ color: '#ff7b7b', fontSize: 13 }}>{err}</div> : null}

      <div style={{ border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Ativo</Th>
              <Th>Criado em</Th>
              <Th>ID</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <Td>{u.email}</Td>
                <Td>{u.role}</Td>
                <Td>{u.isActive ? 'Sim' : 'Não'}</Td>
                <Td>{new Date(u.createdAt).toLocaleString('pt-BR')}</Td>
                <Td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
                  {u.id}
                </Td>
              </tr>
            ))}
            {rows.length === 0 && !loading ? (
              <tr>
                <Td colSpan={5} style={{ opacity: 0.8 }}>
                  Nenhum usuário encontrado.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', padding: 12, fontSize: 12, opacity: 0.85, fontWeight: 600 }}>{children}</th>
  );
}

function Td({
  children,
  colSpan,
  style,
}: {
  children: React.ReactNode;
  colSpan?: number;
  style?: React.CSSProperties;
}) {
  return (
    <td style={{ padding: 12, fontSize: 13, ...style }} colSpan={colSpan}>
      {children}
    </td>
  );
}
