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
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
function toUtcMidnight(dayYYYYMMDD) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYYYYMMDD)) {
        throw new Error('day inválido (use YYYY-MM-DD)');
    }
    return new Date(`${dayYYYYMMDD}T00:00:00.000Z`);
}
function hasAnyMetric(dto) {
    const keys = [
        'leadsTotal',
        'leadsActive',
        'depositsCount',
        'depositsTotalCents',
        'ftdCount',
        'revCents',
        'salesCents',
        'salesCount',
        'trafficCents',
    ];
    return keys.some((k) => typeof dto[k] === 'number' && Number.isFinite(dto[k]));
}
let MetricsService = class MetricsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ingest(dto) {
        if (!dto.expertId)
            throw new common_1.BadRequestException('expertId obrigatório');
        if (!dto.day)
            throw new common_1.BadRequestException('day obrigatório (YYYY-MM-DD)');
        if (!hasAnyMetric(dto) && !dto.source && !dto.raw) {
            throw new common_1.BadRequestException('Envie pelo menos 1 métrica (ou source/raw)');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: dto.expertId },
            select: { id: true, role: true, email: true },
        });
        if (!user)
            throw new common_1.BadRequestException('expertId não encontrado');
        if (user.role !== 'EXPERT')
            throw new common_1.BadRequestException('expertId não é um EXPERT');
        let day;
        try {
            day = toUtcMidnight(dto.day);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'day inválido');
        }
        const updateData = {};
        const createData = {
            expertId: dto.expertId,
            day,
        };
        const fields = [
            'leadsTotal',
            'leadsActive',
            'depositsCount',
            'depositsTotalCents',
            'ftdCount',
            'revCents',
            'salesCents',
            'salesCount',
            'trafficCents',
        ];
        for (const f of fields) {
            const v = dto[f];
            if (typeof v === 'number' && Number.isFinite(v)) {
                updateData[f] = v;
                createData[f] = v;
            }
        }
        if (typeof dto.source === 'string') {
            updateData.source = dto.source;
            createData.source = dto.source;
        }
        if (dto.raw && typeof dto.raw === 'object') {
            updateData.raw = dto.raw;
            createData.raw = dto.raw;
        }
        const row = await this.prisma.metricsDaily.upsert({
            where: {
                expertId_day: {
                    expertId: dto.expertId,
                    day,
                },
            },
            create: createData,
            update: updateData,
        });
        return {
            ok: true,
            expert: { id: user.id, email: user.email },
            metricsDaily: row,
        };
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map