'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

type Overview = {
  users: { total: number; admins: number; experts: number; active: number };
  leads: { total: number };
  deposits: { count: number; totalCents: number };
};

type User = { id: string; email: string; role: 'ADMIN' | 'EXPERT'; isActive: boolean; createdAt: string };

export default function OverviewPage() {
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');
  const [expertId, setExpertId] = useState<string>('all');

  const [users, setUsers] = useState<User[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const experts = useMemo(() => users.filter((u) => u.role === 'EXPERT'), [users]);

  const totalBRL = useMemo(() => {
    const cents = overview?.deposits.totalCents ?? 0;
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }, [overview]);

  async function load() {
    setErr('');
    setLoading(true);
    try {
      const token = getToken();
      if (!token) throw new Error('Sem token');

      const u = await apiFetch<User[]>('/users', { token });
      setUsers(u);

      // por enquanto é global mesmo (endpoint atual)
      const q = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const data = await apiFetch<Overview>(`/admin/overview${q}`, { token });
      setOverview(data);
    } catch {
      setErr('Falha ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="title">Dashboard</div>
          <div className="subtitle">Visão global da operação (todos experts)</div>
        </div>

        <div className="controls">
          <div className="control">
            <div className="label">Período</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="control">
            <div className="label">Expert</div>
            <select className="select" value={expertId} onChange={(e) => setExpertId(e.target.value)}>
              <option value="all">Todos</option>
              {experts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.email}
                </option>
              ))}
            </select>
          </div>

          <button className="btn primary" onClick={load} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}

      <div className="kpis">
        <Kpi title="Usuários" value={String(overview?.users.total ?? '—')} sub={`Ativos: ${overview?.users.active ?? '—'}`} />
        <Kpi title="Leads" value={String(overview?.leads.total ?? '—')} sub="No período" />
        <Kpi title="Depósitos" value={totalBRL} sub={`Transações: ${overview?.deposits.count ?? '—'}`} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Evolução</div>
          <div className="card-sub">Placeholder visual (depois pluga o gráfico real)</div>
          <div className="chart" aria-hidden>
            <div className="bar" style={{ height: 48 }} />
            <div className="bar" style={{ height: 72 }} />
            <div className="bar" style={{ height: 40 }} />
            <div className="bar" style={{ height: 96 }} />
            <div className="bar" style={{ height: 64 }} />
            <div className="bar" style={{ height: 82 }} />
            <div className="bar" style={{ height: 56 }} />
          </div>
        </div>

        <div className="card">
          <div className="card-title">Resumo do filtro</div>
          <div className="card-sub">Sem bagunçar nada: isso vira dado real no próximo passo</div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <span className="pill">from: {from}</span>
            <span className="pill">to: {to}</span>
            <span className="pill">expert: {expertId === 'all' ? 'Todos' : expertId}</span>
          </div>

          <div className="card-sub" style={{ marginTop: 12 }}>
            Próximo passo: quando selecionar um expert, chamar endpoint por expert e atualizar KPIs + funil + vendas.
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}
