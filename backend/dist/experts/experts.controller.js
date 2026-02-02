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
exports.ExpertsController = void 0;
const common_1 = require("@nestjs/common");
const experts_service_1 = require("./experts.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
let ExpertsController = class ExpertsController {
    expertsService;
    constructor(expertsService) {
        this.expertsService = expertsService;
    }
    async overview(req, from, to) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.getExpertOverview(expertId, { from, to });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async me(req, from, to) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.getExpertOverview(expertId, { from, to });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async profile(req) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.getExpertProfile(expertId);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async series(req, from, to, group) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.getExpertSeries(expertId, { from, to, group: group ?? 'day' });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async leads(req, from, to, page, pageSize, q, sortBy, sortDir, tagIds, fresh) {
        try {
            const expertId = req.user?.userId;
            const ids = String(tagIds || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            return await this.expertsService.getExpertLeads(expertId, {
                from,
                to,
                page: page ? Number(page) : 1,
                pageSize: pageSize ? Number(pageSize) : 25,
                q,
                sortBy,
                sortDir,
                tagIds: ids,
                fresh: fresh === '1' || fresh === 'true',
            });
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async activations(req, from, to, page, pageSize, q, sortBy, sortDir, fresh) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.getExpertActivations(expertId, {
                from,
                to,
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
    async tags(req) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.listTags(expertId);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async createTag(req, body) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.createTag(expertId, body);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async updateTag(req, tagId, body) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.updateTag(expertId, tagId, body);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async deleteTag(req, tagId) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.deleteTag(expertId, tagId);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async setLeadTagsPut(req, leadKey, body) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.setLeadTags(expertId, leadKey, body);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async setLeadTagsPost(req, leadKey, body) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.setLeadTags(expertId, leadKey, body);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async addLeadTag(req, leadKey, tagId) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.setLeadTag(expertId, leadKey, tagId, true);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
    async removeLeadTag(req, leadKey, tagId) {
        try {
            const expertId = req.user?.userId;
            return await this.expertsService.setLeadTag(expertId, leadKey, tagId, false);
        }
        catch (e) {
            throw new common_1.BadRequestException(e?.message || 'Invalid request');
        }
    }
};
exports.ExpertsController = ExpertsController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "profile", null);
__decorate([
    (0, common_1.Get)('series'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('group')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "series", null);
__decorate([
    (0, common_1.Get)('leads'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __param(5, (0, common_1.Query)('q')),
    __param(6, (0, common_1.Query)('sortBy')),
    __param(7, (0, common_1.Query)('sortDir')),
    __param(8, (0, common_1.Query)('tagIds')),
    __param(9, (0, common_1.Query)('fresh')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "leads", null);
__decorate([
    (0, common_1.Get)('activations'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __param(5, (0, common_1.Query)('q')),
    __param(6, (0, common_1.Query)('sortBy')),
    __param(7, (0, common_1.Query)('sortDir')),
    __param(8, (0, common_1.Query)('fresh')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "activations", null);
__decorate([
    (0, common_1.Get)('tags'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "tags", null);
__decorate([
    (0, common_1.Post)('tags'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "createTag", null);
__decorate([
    (0, common_1.Patch)('tags/:tagId'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('tagId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "updateTag", null);
__decorate([
    (0, common_1.Delete)('tags/:tagId'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('tagId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "deleteTag", null);
__decorate([
    (0, common_1.Put)('leads/:leadKey/tags'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('leadKey')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "setLeadTagsPut", null);
__decorate([
    (0, common_1.Post)('leads/:leadKey/tags'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('leadKey')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "setLeadTagsPost", null);
__decorate([
    (0, common_1.Post)('leads/:leadKey/tags/:tagId'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('leadKey')),
    __param(2, (0, common_1.Param)('tagId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "addLeadTag", null);
__decorate([
    (0, common_1.Delete)('leads/:leadKey/tags/:tagId'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('leadKey')),
    __param(2, (0, common_1.Param)('tagId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ExpertsController.prototype, "removeLeadTag", null);
exports.ExpertsController = ExpertsController = __decorate([
    (0, common_1.Controller)('expert'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [experts_service_1.ExpertsService])
], ExpertsController);
//# sourceMappingURL=experts.controller.js.map