import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { NotificationsGateway } from './notifications.gateway';

// util simples timezone sem libs: usa Intl para "HH:mm" em timezone IANA
function nowInTzHHmm(timezone: string) {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return fmt.format(new Date()); // "HH:mm"
}

function todayIsoInTz(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /* ---------------- Expert ---------------- */

  async listExpertNotifications(expertId: string, opts?: { unreadOnly?: boolean; take?: number }) {
    const take = Math.min(Math.max(opts?.take ?? 30, 1), 200);

    const where: any = { expertId };
    if (opts?.unreadOnly) where.isRead = false;

    const [items, unreadCount] = await Promise.all([
      this.prisma.expertNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.expertNotification.count({
        where: { expertId, isRead: false },
      }),
    ]);

    return { items, unreadCount };
  }

  async markRead(expertId: string, notificationId: string) {
    const n = await this.prisma.expertNotification.findFirst({
      where: { id: notificationId, expertId },
    });
    if (!n) return { ok: true };

    if (n.isRead) return { ok: true };

    await this.prisma.expertNotification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(expertId: string) {
    await this.prisma.expertNotification.updateMany({
      where: { expertId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { ok: true };
  }

  /* ---------------- Admin rules ---------------- */

  async getRule(expertId: string) {
    const rule = await this.prisma.expertNotificationRule.findFirst({ where: { expertId } });
    if (rule) return rule;

    // default: ativo com 2 horários
    return this.prisma.expertNotificationRule.create({
      data: { expertId, isActive: true, times: ['09:00', '18:00'], timezone: 'America/Sao_Paulo' },
    });
  }

  async upsertRule(expertId: string, data: { isActive?: boolean; times?: string[]; timezone?: string }) {
    const times = (data.times ?? []).map((s) => String(s).trim()).filter(Boolean);

    // valida HH:mm
    for (const t of times) {
      if (!/^\d{2}:\d{2}$/.test(t)) throw new Error(`Horário inválido: ${t}`);
      const [hh, mm] = t.split(':').map(Number);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) throw new Error(`Horário inválido: ${t}`);
    }

    const existing = await this.prisma.expertNotificationRule.findFirst({ where: { expertId } });

    if (!existing) {
      return this.prisma.expertNotificationRule.create({
        data: {
          expertId,
          isActive: data.isActive ?? true,
          times: times.length ? times : ['09:00'],
          timezone: data.timezone?.trim() || 'America/Sao_Paulo',
        },
      });
    }

    return this.prisma.expertNotificationRule.update({
      where: { id: existing.id },
      data: {
        isActive: typeof data.isActive === 'boolean' ? data.isActive : existing.isActive,
        times: times.length ? times : existing.times,
        timezone: data.timezone?.trim() || existing.timezone,
      },
    });
  }

  /* ---------------- Emit / Create ---------------- */

  // ✅ aqui a correção: dateIso pode ser null
  async createAndPush(
    expertId: string,
    payload: { title: string; message: string; kind?: string; dateIso?: string | null },
  ) {
    const created = await this.prisma.expertNotification.create({
      data: {
        expertId,
        title: payload.title,
        message: payload.message,
        kind: payload.kind ?? 'ACTIVATION',
        dateIso: payload.dateIso ?? null,
      },
    });

    // realtime push
    this.gateway.emitToExpert(expertId, {
      id: created.id,
      title: created.title,
      message: created.message,
      kind: created.kind,
      dateIso: created.dateIso,
      createdAt: created.createdAt,
      isRead: created.isRead,
    });

    return created;
  }

  /* ---------------- Scheduler ----------------
     A cada minuto, verifica regras e dispara se "agora" bater em HH:mm
  */

  @Cron('*/1 * * * *')
  async tick() {
    const rules = await this.prisma.expertNotificationRule.findMany({
      where: { isActive: true },
    });

    for (const rule of rules) {
      const hhmm = nowInTzHHmm(rule.timezone || 'America/Sao_Paulo');
      if (!rule.times?.includes(hhmm)) continue;

      const todayIso = todayIsoInTz(rule.timezone || 'America/Sao_Paulo');

      // TODO: plugar com sua fonte real
      const activation = await this.getActivationOfDay(rule.expertId, todayIso);
      if (!activation) continue;

      // evita duplicado no mesmo dia/horário
      const already = await this.prisma.expertNotification.findFirst({
        where: {
          expertId: rule.expertId,
          kind: 'ACTIVATION',
          dateIso: todayIso,
          title: `Ativação de hoje (${hhmm})`,
        },
      });
      if (already) continue;

      await this.createAndPush(rule.expertId, {
        title: `Ativação de hoje (${hhmm})`,
        message: `Lembrete: hoje a ativação é "${activation.activation}".`,
        kind: 'ACTIVATION',
        dateIso: todayIso,
      });
    }
  }

  // ✅ TODO: plugar com sua fonte real.
  private async getActivationOfDay(expertId: string, dateIso: string): Promise<{ activation: string } | null> {
    return null;
  }
}
