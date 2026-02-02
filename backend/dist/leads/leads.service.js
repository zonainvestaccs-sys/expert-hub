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
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let LeadsService = class LeadsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(dto) {
        return this.prisma.lead.create({
            data: {
                expert: { connect: { id: dto.expertId } },
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                source: dto.source,
                utmSource: dto.utmSource,
                utmMedium: dto.utmMedium,
                utmCampaign: dto.utmCampaign,
                utmContent: dto.utmContent,
                utmTerm: dto.utmTerm,
                fbclid: dto.fbclid,
                externalId: dto.externalId,
            },
        });
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadsService);
//# sourceMappingURL=leads.service.js.map