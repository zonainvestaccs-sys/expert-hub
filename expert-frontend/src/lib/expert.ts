import { apiFetch } from './api';

export type ExpertSeriesPoint = {
  label: string;
  leadsTotal: number;
  leadsActive: number;
  depositsBRL: number;
  ftdCount: number;
  revBRL: number;
  salesBRL: number;
  salesCount: number;
  trafficBRL: number;
};

export type ExpertSeriesResponse = {
  period: { from: string; to: string };
  group: 'day' | 'week' | 'month';
  points: ExpertSeriesPoint[];
};

export type ExpertOverview = {
  period: { from: string; to: string };
  kpis: {
    leadsTotal: number;
    leadsActive: number;
    depositsCount: number;
    depositsTotalCents: number;
    ftdCount: number;
    revCents: number;

    // ✅ NOVO: REV SAQUES (centavos)
    revWithdrawalsCents: number;

    salesCents: number;
    salesCount: number;
    trafficCents: number;
  };
};

export async function fetchExpertOverview(token: string, from: string, to: string) {
  const url = `/expert/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return apiFetch<ExpertOverview>(url, { token });
}

export async function fetchExpertSeries(
  token: string,
  from: string,
  to: string,
  group: 'day' | 'week' | 'month' = 'day',
) {
  const url =
    `/expert/series?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
    `&group=${encodeURIComponent(group)}`;
  return apiFetch<ExpertSeriesResponse>(url, { token });
}

/* -------------------- LEADS (NOVO) -------------------- */

export type ExpertLeadItem = {
  id: string;
  date: string;
  email: string;
  phone: string;
  firstDeposit: number;
  deposits: number;
  withdrawals: number;
  profits: number;
  losses: number;
  balance: number;
};

export type ExpertLeadsResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: ExpertLeadItem[];
  warning?: string;
  csvUrl?: string;
  period?: { from: string; to: string };
  source?: string;
};

export async function fetchExpertLeads(
  token: string,
  params: {
    from: string;
    to: string;
    page?: number;
    pageSize?: number;
    q?: string;
  },
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const qs = new URLSearchParams();
  qs.set('from', params.from);
  qs.set('to', params.to);
  qs.set('page', String(page));
  qs.set('pageSize', String(pageSize));
  if (params.q) qs.set('q', params.q);

  return apiFetch<ExpertLeadsResponse>(`/expert/leads?${qs.toString()}`, { token });
}

/* -------------------- ATIVAÇÕES (NOVO) -------------------- */

export type ExpertActivationItem = {
  id: string;
  date: string;       // ISO yyyy-mm-dd
  dateLabel: string;  // label original (se vier)
  activation: string;
  description: string;
  ftd: number;
  deposit: number;
  rev: number;
};

export type ExpertActivationsResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: ExpertActivationItem[];
  warning?: string;
  csvUrl?: string;
  period?: { from: string; to: string };
  source?: string;
};

export type ActivationsSortBy = 'date' | 'activation' | 'ftd' | 'deposit' | 'rev';

export async function fetchExpertActivations(
  token: string,
  params: {
    from: string;
    to: string;
    page?: number;
    pageSize?: number;
    q?: string;
    sortBy?: ActivationsSortBy;
    sortDir?: 'asc' | 'desc';
    fresh?: boolean;
  },
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const qs = new URLSearchParams();
  qs.set('from', params.from);
  qs.set('to', params.to);
  qs.set('page', String(page));
  qs.set('pageSize', String(pageSize));

  if (params.q) qs.set('q', params.q);
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortDir) qs.set('sortDir', params.sortDir);
  if (params.fresh) qs.set('fresh', '1');

  return apiFetch<ExpertActivationsResponse>(`/expert/activations?${qs.toString()}`, { token });
}
