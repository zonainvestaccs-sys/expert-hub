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
exports.IngestService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
function toUtcMidnight(dayYYYYMMDD) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYYYYMMDD)) {
        throw new Error('day deve ser YYYY-MM-DD');
    }
    return new Date(`${dayYYYYMMDD}T00:00:00.000Z`);
}
let IngestService = class IngestService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async upsertDailyMetrics(dto) {
        return this.ingest(dto);
    }
    async ingest(dto) {
        try {
            if (!dto?.expertId)
                throw new Error('expertId obrigatório');
            if (!dto?.day)
                throw new Error('day obrigatório');
            const expert = await this.prisma.user.findUnique({
                where: { id: dto.expertId },
                select: { id: true, role: true, email: true },
            });
            if (!expert)
                throw new Error('expertId não encontrado');
            if (expert.role !== 'EXPERT')
                throw new Error('expertId não é EXPERT');
            const day = toUtcMidnight(dto.day);
            const create = { expertId: dto.expertId, day };
            const update = {};
            const numericFields = [
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
            for (const f of numericFields) {
                const v = dto[f];
                if (typeof v === 'number' && Number.isFinite(v)) {
                    create[f] = v;
                    update[f] = v;
                }
            }
            if (typeof dto.source === 'string') {
                create.source = dto.source;
                update.source = dto.source;
            }
            if (dto.raw !== undefined) {
                create.raw = dto.raw;
                update.raw = dto.raw;
            }
            const row = await this.prisma.metricsDaily.upsert({
                where: { expertId_day: { expertId: dto.expertId, day } },
                create,
                update,
            });
            return {
                ok: true,
                expert: { id: expert.id, email: expert.email },
                metricsDaily: row,
            };
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Falha ao ingerir métricas');
        }
    }
};
exports.IngestService = IngestService;
exports.IngestService = IngestService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IngestService);
//# sourceMappingURL=ingest.service.js.map