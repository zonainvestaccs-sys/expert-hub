// src/lib/appointments.ts
import { apiFetch } from './api';
import { getToken } from './auth';

export type Appointment = {
  id: string;
  expertId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string; // ISO
  endAt?: string | null; // ISO
  allDay: boolean;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAppointmentInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string; // ISO
  endAt?: string | null; // ISO
  allDay?: boolean;
  color?: string | null;
};

export type UpdateAppointmentInput = Partial<CreateAppointmentInput>;

function requireToken(token?: string | null) {
  const t = token ?? getToken();
  if (!t) throw { statusCode: 401, message: 'Sem token' };
  return t;
}

export async function listAppointments(params: { from: string; to: string }, token?: string | null) {
  const t = requireToken(token);
  const qs = new URLSearchParams();
  qs.set('from', params.from);
  qs.set('to', params.to);

  return apiFetch<Appointment[]>(`/appointments?${qs.toString()}`, {
    method: 'GET',
    token: t,
  });
}

export async function createAppointment(payload: CreateAppointmentInput, token?: string | null) {
  const t = requireToken(token);
  return apiFetch<Appointment>(`/appointments`, {
    method: 'POST',
    token: t,
    body: payload,
  });
}

export async function updateAppointment(id: string, payload: UpdateAppointmentInput, token?: string | null) {
  const t = requireToken(token);
  return apiFetch<Appointment>(`/appointments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token: t,
    body: payload,
  });
}

export async function deleteAppointment(id: string, token?: string | null) {
  const t = requireToken(token);
  return apiFetch<{ ok: true }>(`/appointments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token: t,
  });
}
