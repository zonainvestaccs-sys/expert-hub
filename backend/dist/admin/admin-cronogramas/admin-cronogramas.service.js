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
exports.AdminCronogramasService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const appointments_service_1 = require("../../appointments/appointments.service");
function toDateStrict(iso, label) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        throw new common_1.BadRequestException(`${label} inválido`);
    return d;
}
let AdminCronogramasService = class AdminCronogramasService {
    prisma;
    appointments;
    constructor(prisma, appointments) {
        this.prisma = prisma;
        this.appointments = appointments;
    }
    async list(args) {
        const from = toDateStrict(args.from, 'from');
        const to = toDateStrict(args.to, 'to');
        if (to.getTime() <= from.getTime()) {
            throw new common_1.BadRequestException('to deve ser maior que from');
        }
        const expertId = args.expertId && args.expertId !== 'ALL' ? args.expertId : undefined;
        const items = await this.prisma.appointment.findMany({
            where: {
                ...(expertId ? { expertId } : {}),
                startAt: { gte: from, lt: to },
            },
            include: {
                expert: {
                    select: {
                        id: true,
                        email: true,
                        photoUrl: true,
                        role: true,
                        isActive: true,
                    },
                },
            },
            orderBy: { startAt: 'asc' },
        });
        return (items || []).map((it) => ({
            id: it.id,
            expertId: it.expertId,
            expertEmail: it.expert?.email ?? '',
            expertPhotoUrl: it.expert?.photoUrl ?? null,
            expertIsActive: it.expert?.isActive ?? true,
            title: it.title,
            description: it.description ?? null,
            location: it.location ?? null,
            startAt: it.startAt.toISOString(),
            endAt: it.endAt ? it.endAt.toISOString() : null,
            allDay: it.allDay,
            color: it.color ?? null,
            seriesId: it.seriesId ?? null,
            occurrenceIndex: it.occurrenceIndex ?? null,
            isException: it.isException ?? false,
        }));
    }
    async create(dto) {
        const expertId = String(dto.expertId || '').trim();
        if (!expertId)
            throw new common_1.BadRequestException('expertId obrigatório');
        const expert = await this.prisma.user.findUnique({
            where: { id: expertId },
            select: { id: true, role: true, isActive: true, email: true, photoUrl: true },
        });
        if (!expert)
            throw new common_1.NotFoundException('Expert não encontrado');
        if (expert.role !== 'EXPERT')
            throw new common_1.BadRequestException('expertId não pertence a um EXPERT');
        const { expertId: _ignore, ...rest } = dto;
        return this.appointments.create(expertId, rest);
    }
};
exports.AdminCronogramasService = AdminCronogramasService;
exports.AdminCronogramasService = AdminCronogramasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        appointments_service_1.AppointmentsService])
], AdminCronogramasService);
//# sourceMappingURL=admin-cronogramas.service.js.map