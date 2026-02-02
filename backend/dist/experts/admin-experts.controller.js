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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminExpertsController = void 0;
const common_1 = require("@nestjs/common");
const experts_service_1 = require("./experts.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
let AdminExpertsController = class AdminExpertsController {
    expertsService;
    constructor(expertsService) {
        this.expertsService = expertsService;
    }
    async profile(expertId) {
        try {
            return await this.expertsService.getExpertProfile(expertId);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async leads(expertId, from, to, page, pageSize, q, sortBy, sortDir, fresh) {
        try {
            return await this.expertsService.getExpertLeads(expertId, {
                from: from || undefined,
                to: to || undefined,
                page: page ? Number(page) : 1,
                pageSize: pageSize ? Number(pageSize) : 25,
                q,
                sortBy,
                sortDir,
                fresh: fresh === '1' || fresh === 'true',
            });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async activations(expertId, from, to, page, pageSize, q, sortBy, sortDir, fresh) {
        try {
            return await this.expertsService.getExpertActivations(expertId, {
                from: from || undefined,
                to: to || undefined,
                page: page ? Number(page) : 1,
                pageSize: pageSize ? Number(pageSize) : 25,
                q,
                sortBy,
                sortDir,
                fresh: fresh === '1' || fresh === 'true',
            });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async getRule(expertId) {
        try {
            return await this.expertsService.getExpertNotificationRule(expertId);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async upsertRule(expertId, body) {
        try {
            return await this.expertsService.upsertExpertNotificationRule(expertId, body);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
};
exports.AdminExpertsController = AdminExpertsController;
__decorate([
    (0, common_1.Get)(':expertId/profile'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminExpertsController.prototype, "profile", null);
__decorate([
    (0, common_1.Get)(':expertId/leads'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __param(5, (0, common_1.Query)('q')),
    __param(6, (0, common_1.Query)('sortBy')),
    __param(7, (0, common_1.Query)('sortDir')),
    __param(8, (0, common_1.Query)('fresh')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], AdminExpertsController.prototype, "leads", null);
__decorate([
    (0, common_1.Get)(':expertId/activations'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __param(5, (0, common_1.Query)('q')),
    __param(6, (0, common_1.Query)('sortBy')),
    __param(7, (0, common_1.Query)('sortDir')),
    __param(8, (0, common_1.Query)('fresh')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], AdminExpertsController.prototype, "activations", null);
__decorate([
    (0, common_1.Get)(':expertId/notification-rule'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminExpertsController.prototype, "getRule", null);
__decorate([
    (0, common_1.Patch)(':expertId/notification-rule'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminExpertsController.prototype, "upsertRule", null);
exports.AdminExpertsController = AdminExpertsController = __decorate([
    (0, common_1.Controller)('admin/experts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [experts_service_1.ExpertsService])
], AdminExpertsController);
//# sourceMappingURL=admin-experts.controller.js.map