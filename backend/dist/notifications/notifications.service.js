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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma.service");
const notifications_gateway_1 = require("./notifications.gateway");
function nowInTzHHmm(timezone) {
    const fmt = new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    return fmt.format(new Date());
}
function todayIsoInTz(timezone) {
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
let NotificationsService = class NotificationsService {
    prisma;
    gateway;
    constructor(prisma, gateway) {
        this.prisma = prisma;
        this.gateway = gateway;
    }
    async listExpertNotifications(expertId, opts) {
        const take = Math.min(Math.max(opts?.take ?? 30, 1), 200);
        const where = { expertId };
        if (opts?.unreadOnly)
            where.isRead = false;
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
    async markRead(expertId, notificationId) {
        const n = await this.prisma.expertNotification.findFirst({
            where: { id: notificationId, expertId },
        });
        if (!n)
            return { ok: true };
        if (n.isRead)
            return { ok: true };
        await this.prisma.expertNotification.update({
            where: { id: notificationId },
            data: { isRead: true, readAt: new Date() },
        });
        return { ok: true };
    }
    async markAllRead(expertId) {
        await this.prisma.expertNotification.updateMany({
            where: { expertId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        return { ok: true };
    }
    async getRule(expertId) {
        const rule = await this.prisma.expertNotificationRule.findFirst({ where: { expertId } });
        if (rule)
            return rule;
        return this.prisma.expertNotificationRule.create({
            data: { expertId, isActive: true, times: ['09:00', '18:00'], timezone: 'America/Sao_Paulo' },
        });
    }
    async upsertRule(expertId, data) {
        const times = (data.times ?? []).map((s) => String(s).trim()).filter(Boolean);
        for (const t of times) {
            if (!/^\d{2}:\d{2}$/.test(t))
                throw new Error(`Horário inválido: ${t}`);
            const [hh, mm] = t.split(':').map(Number);
            if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
                throw new Error(`Horário inválido: ${t}`);
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
    async createAndPush(expertId, payload) {
        const created = await this.prisma.expertNotification.create({
            data: {
                expertId,
                title: payload.title,
                message: payload.message,
                kind: payload.kind ?? 'ACTIVATION',
                dateIso: payload.dateIso ?? null,
            },
        });
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
    async tick() {
        const rules = await this.prisma.expertNotificationRule.findMany({
            where: { isActive: true },
        });
        for (const rule of rules) {
            const hhmm = nowInTzHHmm(rule.timezone || 'America/Sao_Paulo');
            if (!rule.times?.includes(hhmm))
                continue;
            const todayIso = todayIsoInTz(rule.timezone || 'America/Sao_Paulo');
            const activation = await this.getActivationOfDay(rule.expertId, todayIso);
            if (!activation)
                continue;
            const already = await this.prisma.expertNotification.findFirst({
                where: {
                    expertId: rule.expertId,
                    kind: 'ACTIVATION',
                    dateIso: todayIso,
                    title: `Ativação de hoje (${hhmm})`,
                },
            });
            if (already)
                continue;
            await this.createAndPush(rule.expertId, {
                title: `Ativação de hoje (${hhmm})`,
                message: `Lembrete: hoje a ativação é "${activation.activation}".`,
                kind: 'ACTIVATION',
                dateIso: todayIso,
            });
        }
    }
    async getActivationOfDay(expertId, dateIso) {
        return null;
    }
};
exports.NotificationsService = NotificationsService;
__decorate([
    (0, schedule_1.Cron)('*/1 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationsService.prototype, "tick", null);
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_gateway_1.NotificationsGateway])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map