"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
function toDateStrict(iso, label) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        throw new common_1.BadRequestException(`${label} inválido`);
    return d;
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function addDaysUTC(d, days) {
    const x = new Date(d.getTime());
    x.setUTCDate(x.getUTCDate() + days);
    return x;
}
function addMonthsUTC(d, months) {
    const x = new Date(d.getTime());
    const day = x.getUTCDate();
    x.setUTCDate(1);
    x.setUTCMonth(x.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
    x.setUTCDate(Math.min(day, lastDay));
    return x;
}
function startOfWeekUTC(d) {
    const day = d.getUTCDay();
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    return addDaysUTC(x, -day);
}
function withSameTimeUTC(baseTime, targetDate) {
    const x = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), baseTime.getUTCHours(), baseTime.getUTCMinutes(), baseTime.getUTCSeconds(), baseTime.getUTCMilliseconds()));
    return x;
}
function durationMs(start, end) {
    if (!end)
        return null;
    const ms = end.getTime() - start.getTime();
    return ms > 0 ? ms : null;
}
function normalizeWeekdays(input) {
    const arr = Array.isArray(input) ? input : [];
    const set = new Set(arr.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6));
    const out = Array.from(set).sort((a, b) => a - b);
    return out.length ? out : [0];
}
function mapFreq(freq) {
    if (freq === 'daily')
        return 'DAILY';
    if (freq === 'weekly')
        return 'WEEKLY';
    return 'MONTHLY';
}
function buildOccurrences(startAt, endAt, allDay, rule) {
    const interval = Math.max(1, Math.floor(Number(rule.interval || 1)));
    const safeCount = clamp(Math.floor(Number(rule.count || 1)), 1, 365);
    const until = rule.mode === 'until' && rule.until ? toDateStrict(rule.until, 'until') : null;
    const dur = allDay ? null : durationMs(startAt, endAt);
    const out = [];
    const pushOcc = (s, idx) => {
        let e = null;
        if (!allDay && dur)
            e = new Date(s.getTime() + dur);
        out.push({ startAt: s, endAt: e, occurrenceIndex: idx });
    };
    const freq = rule.freq;
    if (freq === 'daily') {
        let cur = new Date(startAt.getTime());
        for (let i = 0; i < 365; i++) {
            if (rule.mode === 'count' && out.length >= safeCount)
                break;
            if (rule.mode === 'until' && until && cur.getTime() > until.getTime())
                break;
            pushOcc(cur, out.length);
            cur = addDaysUTC(cur, interval);
        }
        return out;
    }
    if (freq === 'monthly') {
        let cur = new Date(startAt.getTime());
        for (let i = 0; i < 365; i++) {
            if (rule.mode === 'count' && out.length >= safeCount)
                break;
            if (rule.mode === 'until' && until && cur.getTime() > until.getTime())
                break;
            pushOcc(cur, out.length);
            cur = addMonthsUTC(cur, interval);
        }
        return out;
    }
    const weekdays = normalizeWeekdays(rule.weekdays);
    const baseWeekStart = startOfWeekUTC(startAt);
    for (let weekIndex = 0; weekIndex < 365; weekIndex++) {
        const weekStart = addDaysUTC(baseWeekStart, weekIndex * 7 * interval);
        for (const wd of weekdays) {
            const day = addDaysUTC(weekStart, wd);
            const occStart = withSameTimeUTC(startAt, day);
            if (occStart.getTime() < startAt.getTime())
                continue;
            if (rule.mode === 'until' && until && occStart.getTime() > until.getTime())
                return out;
            if (rule.mode === 'count' && out.length >= safeCount)
                return out;
            pushOcc(occStart, out.length);
            if (out.length >= 365)
                return out;
        }
    }
    return out;
}
let AppointmentsService = class AppointmentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(expertId, range) {
        return this.prisma.appointment.findMany({
            where: { expertId, startAt: { gte: range.from, lt: range.to } },
            orderBy: { startAt: 'asc' },
        });
    }
    async create(expertId, dto) {
        const title = String(dto.title || '').trim();
        if (!title)
            throw new common_1.BadRequestException('Informe um título');
        const startAt = toDateStrict(dto.startAt, 'startAt');
        const allDay = Boolean(dto.allDay);
        const endAt = dto.endAt ? toDateStrict(dto.endAt, 'endAt') : null;
        if (!allDay && endAt && endAt.getTime() <= startAt.getTime()) {
            throw new common_1.BadRequestException('endAt deve ser maior que startAt');
        }
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
                },
            });
        }
        const rule = dto.recurrence;
        if (rule.mode === 'count' && !rule.count)
            throw new common_1.BadRequestException('recurrence.count obrigatório');
        if (rule.mode === 'until' && !rule.until)
            throw new common_1.BadRequestException('recurrence.until obrigatório');
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
        if (!occurrences.length)
            throw new common_1.BadRequestException('Nenhuma ocorrência gerada');
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
                    endMode: rule.mode === 'count' ? 'COUNT' : 'UNTIL',
                    count: rule.mode === 'count' ? safeCount : null,
                    until: rule.mode === 'until' ? toDateStrict(rule.until, 'until') : null,
                    byWeekday: weekdays,
                },
            });
            const createManyData = occurrences.map((o) => ({
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
            }));
            await tx.appointment.createMany({ data: createManyData });
            const created = await tx.appointment.findMany({
                where: { seriesId: series.id },
                orderBy: { startAt: 'asc' },
            });
            return { seriesId: series.id, items: created };
        });
    }
    async update(expertId, id, dto, scope = 'single') {
        const found = await this.prisma.appointment.findUnique({ where: { id } });
        if (!found)
            throw new common_1.NotFoundException('Compromisso não encontrado');
        if (found.expertId !== expertId)
            throw new common_1.ForbiddenException();
        const patch = {};
        if (dto.title !== undefined)
            patch.title = String(dto.title).trim();
        if (dto.description !== undefined)
            patch.description = dto.description ?? null;
        if (dto.location !== undefined)
            patch.location = dto.location ?? null;
        if (dto.allDay !== undefined)
            patch.allDay = Boolean(dto.allDay);
        if (dto.color !== undefined)
            patch.color = dto.color ?? null;
        if (dto.startAt !== undefined)
            patch.startAt = toDateStrict(dto.startAt, 'startAt');
        if (dto.endAt !== undefined)
            patch.endAt = dto.endAt ? toDateStrict(dto.endAt, 'endAt') : null;
        const nextAllDay = (patch.allDay ?? found.allDay);
        const nextStart = (patch.startAt ?? found.startAt);
        const nextEnd = (patch.endAt ?? found.endAt);
        if (!nextAllDay && nextEnd && nextEnd.getTime() <= nextStart.getTime()) {
            throw new common_1.BadRequestException('endAt deve ser maior que startAt');
        }
        if (nextAllDay)
            patch.endAt = null;
        if (!found.seriesId || scope === 'single') {
            return this.prisma.appointment.update({
                where: { id },
                data: {
                    ...patch,
                    isException: found.seriesId ? true : found.isException,
                },
            });
        }
        const seriesId = found.seriesId;
        if (scope === 'series') {
            return this.prisma.$transaction(async (tx) => {
                await tx.appointment.updateMany({
                    where: { seriesId, expertId },
                    data: { ...patch },
                });
                await tx.appointmentSeries.update({
                    where: { id: seriesId },
                    data: {
                        title: patch.title ?? undefined,
                        description: patch.description ?? undefined,
                        location: patch.location ?? undefined,
                        allDay: patch.allDay ?? undefined,
                        color: patch.color ?? undefined,
                    },
                });
                return tx.appointment.findUnique({ where: { id } });
            });
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.appointment.updateMany({
                where: {
                    seriesId,
                    expertId,
                    startAt: { gte: found.startAt },
                },
                data: patch,
            });
            return tx.appointment.findUnique({ where: { id } });
        });
    }
    async remove(expertId, id, scope = 'single') {
        const found = await this.prisma.appointment.findUnique({ where: { id } });
        if (!found)
            throw new common_1.NotFoundException('Compromisso não encontrado');
        if (found.expertId !== expertId)
            throw new common_1.ForbiddenException();
        if (!found.seriesId || scope === 'single') {
            await this.prisma.appointment.delete({ where: { id } });
            return { ok: true };
        }
        const seriesId = found.seriesId;
        if (scope === 'series') {
            await this.prisma.$transaction(async (tx) => {
                await tx.appointment.deleteMany({ where: { seriesId, expertId } });
                await tx.appointmentSeries.delete({ where: { id: seriesId } });
            });
            return { ok: true };
        }
        await this.prisma.appointment.deleteMany({
            where: {
                seriesId,
                expertId,
                startAt: { gte: found.startAt },
            },
        });
        return { ok: true };
    }
    async listForAdmin(range, expertId) {
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
};
exports.AppointmentsService = AppointmentsService;
exports.AppointmentsService = AppointmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AppointmentsService);
//# sourceMappingURL=appointments.service.js.map