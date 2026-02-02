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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const admin_service_1 = require("./admin.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const platform_express_1 = require("@nestjs/platform-express");
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    async overview(from, to, expertId) {
        try {
            return await this.adminService.overview({ from, to, expertId });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async series(from, to, group, expertId) {
        try {
            return await this.adminService.series({ from, to, group, expertId });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async listExperts() {
        try {
            return await this.adminService.listExperts();
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async createExpert(body) {
        try {
            return await this.adminService.createExpert(body);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async expertOverview(expertId, from, to) {
        try {
            return await this.adminService.expertOverview(expertId, { from, to });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async expertSeries(expertId, from, to, group) {
        try {
            return await this.adminService.expertSeries(expertId, { from, to, group });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async expertLeads(expertId, from, to, page, pageSize, q, status, sortBy, sortDir) {
        try {
            return await this.adminService.expertLeads(expertId, {
                from,
                to,
                page: page ? Number(page) : 1,
                pageSize: pageSize ? Number(pageSize) : 25,
                q,
                status,
                sortBy,
                sortDir,
            });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async updateExpert(expertId, body) {
        try {
            return await this.adminService.updateExpert(expertId, body);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async updateExpertPassword(expertId, body) {
        try {
            return await this.adminService.updateExpertPassword(expertId, String(body?.password || ''));
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async updateExpertPhoto(expertId, file) {
        try {
            return await this.adminService.updateExpertPhoto(expertId, file);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('expertId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('series'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('group')),
    __param(3, (0, common_1.Query)('expertId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "series", null);
__decorate([
    (0, common_1.Get)('experts'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listExperts", null);
__decorate([
    (0, common_1.Post)('experts'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createExpert", null);
__decorate([
    (0, common_1.Get)('experts/:expertId/overview'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "expertOverview", null);
__decorate([
    (0, common_1.Get)('experts/:expertId/series'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('group')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "expertSeries", null);
__decorate([
    (0, common_1.Get)('experts/:expertId/leads'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __param(5, (0, common_1.Query)('q')),
    __param(6, (0, common_1.Query)('status')),
    __param(7, (0, common_1.Query)('sortBy')),
    __param(8, (0, common_1.Query)('sortDir')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "expertLeads", null);
__decorate([
    (0, common_1.Patch)('experts/:expertId'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateExpert", null);
__decorate([
    (0, common_1.Patch)('experts/:expertId/password'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('expertId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateExpertPassword", null);
__decorate([
    (0, common_1.Post)('experts/:expertId/photo'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('expertId')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateExpertPhoto", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map