import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAppointmentDto, RecurrenceDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Prisma, RecurrenceFreq } from '@prisma/client';

type Range = { from: Date; to: Date };
type Scope = 'single' | 'series' | 'future';

function toDateStrict(iso: string, label: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${label} inválido`);
  return d;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function addMonthsUTC(d: Date, months: number) {
  const x = new Date(d.getTime());
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, lastDay));
  return x;
}

function startOfWeekUTC(d: Date) {
  // domingo = 0
  const day = d.getUTCDay();
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return addDaysUTC(x, -day);
}

function withSameTimeUTC(baseTime: Date, targetDate: Date) {
  const x = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      baseTime.getUTCHours(),
      baseTime.getUTCMinutes(),
      baseTime.getUTCSeconds(),
      baseTime.getUTCMilliseconds(),
    ),
  );
  return x;
}

function durationMs(start: Date, end?: Date | null) {
  if (!end) return null;
  const ms = end.getTime() - start.getTime();
  return ms > 0 ? ms : null;
}

function normalizeWeekdays(input?: number[]) {
  const arr = Array.isArray(input) ? input : [];
  const set = new Set(arr.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6));
  const out = Array.from(set).sort((a, b) => a - b);
  return out.length ? out : [0]; // default domingo
}

function mapFreq(freq: RecurrenceDto['freq']): RecurrenceFreq {
  if (freq === 'daily') return 'DAILY';
  if (freq === 'weekly') return 'WEEKLY';
  return 'MONTHLY';
}

function buildOccurrences(startAt: Date, endAt: Date | null, allDay: boolean, rule: RecurrenceDto) {
  const interval = Math.max(1, Math.floor(Number(rule.interval || 1)));
  const safeCount = clamp(Math.floor(Number(rule.count || 1)), 1, 365);
  const until = rule.mode === 'until' && rule.until ? toDateStrict(rule.until, 'until') : null;

  const dur = allDay ? null : durationMs(startAt, endAt);

  const out: Array<{ startAt: Date; endAt: Date | null; occurrenceIndex: number }> = [];

  const pushOcc = (s: Date, idx: number) => {
    let e: Date | null = null;
    if (!allDay && dur) e = new Date(s.getTime() + dur);
    out.push({ startAt: s, endAt: e, occurrenceIndex: idx });
  };

  const freq = rule.freq;

  if (freq === 'daily') {
    let cur = new Date(startAt.getTime());
    for (let i = 0; i < 365; i++) {
      if (rule.mode === 'count' && out.length >= safeCount) break;
      if (rule.mode === 'until' && until && cur.getTime() > until.getTime()) break;
      pushOcc(cur, out.length);
      cur = addDaysUTC(cur, interval);
    }
    return out;
  }

  if (freq === 'monthly') {
    let cur = new Date(startAt.getTime());
    for (let i = 0; i < 365; i++) {
      if (rule.mode === 'count' && out.length >= safeCount) break;
      if (rule.mode === 'until' && until && cur.getTime() > until.getTime()) break;
      pushOcc(cur, out.length);
      cur = addMonthsUTC(cur, interval);
    }
    return out;
  }

  // weekly
  const weekdays = normalizeWeekdays(rule.weekdays);
  const baseWeekStart = startOfWeekUTC(startAt);

  for (let weekIndex = 0; weekIndex < 365; weekIndex++) {
    const weekStart = addDaysUTC(baseWeekStart, weekIndex * 7 * interval);

    for (const wd of weekdays) {
      const day = addDaysUTC(weekStart, wd);
      const occStart = withSameTimeUTC(startAt, day);

      if (occStart.getTime() < startAt.getTime()) continue;

      if (rule.mode === 'until' && until && occStart.getTime() > until.getTime()) return out;
      if (rule.mode === 'count' && out.length >= safeCount) return out;

      pushOcc(occStart, out.length);
      if (out.length >= 365) return out;
    }
  }

  return out;
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(expertId: string, range: Range) {
    return this.prisma.appointment.findMany({
      where: { expertId, startAt: { gte: range.from, lt: range.to } },
      orderBy: { startAt: 'asc' },
    });
  }

  async create(expertId: string, dto: CreateAppointmentDto) {
    const title = String(dto.title || '').trim();
    if (!title) throw new BadRequestException('Informe um título');

    const startAt = toDateStrict(dto.startAt, 'startAt');
    const allDay = Boolean(dto.allDay);
    const endAt = dto.endAt ? toDateStrict(dto.endAt, 'endAt') : null;

    if (!allDay && endAt && endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('endAt deve ser maior que startAt');
    }

    // ✅ sem recorrência => cria 1
    if (!dto.recurrence?.enabled) {
      return this.prisma.appointment.create({
        data: {
          expertId,
          title,
          description: dto.description ?? null,
          location: dto.location ?? null,
          startAt,
          endAt: allDay ? null : endAt,
          allDay,
          color: dto.color ?? null,
          // se sua tabela tiver campos de série, deixam default:
          // seriesId: null,
          // occurrenceIndex: 0,
          // isException: false,
        } as any,
      });
    }

    // ✅ com recorrência => cria series + occurrences
    const rule = dto.recurrence;

    if (rule.mode === 'count' && !rule.count) throw new BadRequestException('recurrence.count obrigatório');
    if (rule.mode === 'until' && !rule.until) throw new BadRequestException('recurrence.until obrigatório');

    const freq = mapFreq(rule.freq);
    const interval = Math.max(1, Math.floor(Number(rule.interval || 1)));
    const safeCount = clamp(Math.floor(Number(rule.count || 1)), 1, 365);
    const weekdays = rule.freq === 'weekly' ? normalizeWeekdays(rule.weekdays) : [];

    const occurrences = buildOccurrences(startAt, endAt, allDay, {
      ...rule,
      interval,
      count: safeCount,
      weekdays,
    });

    if (!occurrences.length) throw new BadRequestException('Nenhuma ocorrência gerada');

    return this.prisma.$transaction(async (tx) => {
      const series = await tx.appointmentSeries.create({
        data: {
          expertId,
          title,
          description: dto.description ?? null,
          location: dto.location ?? null,
          startAt,
          endAt: allDay ? null : endAt,
          allDay,
          color: dto.color ?? null,
          freq,
          interval,
          endMode: rule.mode === 'count' ? ('COUNT' as any) : ('UNTIL' as any),
          count: rule.mode === 'count' ? safeCount : null,
          until: rule.mode === 'until' ? toDateStrict(rule.until!, 'until') : null,
          byWeekday: weekdays,
        } as any,
      });

      const createManyData: Prisma.AppointmentCreateManyInput[] = occurrences.map((o) => ({
        expertId,
        title,
        description: dto.description ?? null,
        location: dto.location ?? null,
        startAt: o.startAt,
        endAt: o.endAt,
        allDay,
        color: dto.color ?? null,
        seriesId: series.id,
        occurrenceIndex: o.occurrenceIndex,
        isException: false,
      })) as any;

      await tx.appointment.createMany({ data: createManyData });

      const created = await tx.appointment.findMany({
        where: { seriesId: series.id },
        orderBy: { startAt: 'asc' },
      });

      return { seriesId: series.id, items: created };
    });
  }

  async update(expertId: string, id: string, dto: UpdateAppointmentDto, scope: Scope = 'single') {
    const found = await this.prisma.appointment.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Compromisso não encontrado');
    if (found.expertId !== expertId) throw new ForbiddenException();

    const patch: Prisma.AppointmentUpdateInput = {};

    if (dto.title !== undefined) patch.title = String(dto.title).trim();
    if (dto.description !== undefined) patch.description = dto.description ?? null;
    if (dto.location !== undefined) patch.location = dto.location ?? null;
    if (dto.allDay !== undefined) patch.allDay = Boolean(dto.allDay);
    if (dto.color !== undefined) patch.color = dto.color ?? null;

    if (dto.startAt !== undefined) patch.startAt = toDateStrict(dto.startAt, 'startAt');
    if (dto.endAt !== undefined) patch.endAt = dto.endAt ? toDateStrict(dto.endAt, 'endAt') : null;

    const nextAllDay = (patch.allDay ?? found.allDay) as boolean;
    const nextStart = (patch.startAt ?? found.startAt) as Date;
    const nextEnd = (patch.endAt ?? found.endAt) as Date | null;

    if (!nextAllDay && nextEnd && nextEnd.getTime() <= nextStart.getTime()) {
      throw new BadRequestException('endAt deve ser maior que startAt');
    }
    if (nextAllDay) patch.endAt = null;

    // ✅ sem série ou single
    if (!found.seriesId || scope === 'single') {
      return this.prisma.appointment.update({
        where: { id },
        data: {
          ...patch,
          isException: found.seriesId ? true : (found as any).isException,
        } as any,
      });
    }

    // ✅ daqui pra baixo: TEM série
    const seriesId = found.seriesId as string;

    if (scope === 'series') {
      return this.prisma.$transaction(async (tx) => {
        await tx.appointment.updateMany({
          where: { seriesId, expertId },
          data: { ...patch } as any,
        });

        await tx.appointmentSeries.update({
          where: { id: seriesId },
          data: {
            title: (patch.title as any) ?? undefined,
            description: (patch.description as any) ?? undefined,
            location: (patch.location as any) ?? undefined,
            allDay: (patch.allDay as any) ?? undefined,
            color: (patch.color as any) ?? undefined,
          } as any,
        });

        return tx.appointment.findUnique({ where: { id } });
      });
    }

    // future: esta e próximas
    return this.prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: {
          seriesId,
          expertId,
          startAt: { gte: found.startAt },
        },
        data: patch as any,
      });

      return tx.appointment.findUnique({ where: { id } });
    });
  }

  async remove(expertId: string, id: string, scope: Scope = 'single') {
    const found = await this.prisma.appointment.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Compromisso não encontrado');
    if (found.expertId !== expertId) throw new ForbiddenException();

    if (!found.seriesId || scope === 'single') {
      await this.prisma.appointment.delete({ where: { id } });
      return { ok: true };
    }

    const seriesId = found.seriesId as string;

    if (scope === 'series') {
      await this.prisma.$transaction(async (tx) => {
        await tx.appointment.deleteMany({ where: { seriesId, expertId } });
        await tx.appointmentSeries.delete({ where: { id: seriesId } });
      });
      return { ok: true };
    }

    // future
    await this.prisma.appointment.deleteMany({
      where: {
        seriesId,
        expertId,
        startAt: { gte: found.startAt },
      },
    });

    return { ok: true };
  }

  // ✅ ADMIN: lista compromissos de todos experts (com filtro opcional)
  async listForAdmin(range: { from: string; to: string }, expertId?: string) {
    const from = toDateStrict(range.from, 'from');
    const to = toDateStrict(range.to, 'to');

    return this.prisma.appointment.findMany({
      where: {
        ...(expertId ? { expertId } : {}),
        startAt: { gte: from, lt: to },
      },
      include: {
        expert: {
          select: { id: true, email: true, photoUrl: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });
  }
}
