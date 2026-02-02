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
exports.ExpertNotificationsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const notifications_service_1 = require("./notifications.service");
let ExpertNotificationsController = class ExpertNotificationsController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    async list(req, unread, take) {
        const expertId = String(req.user?.sub ?? req.user?.userId ?? '');
        return this.svc.listExpertNotifications(expertId, {
            unreadOnly: unread === '1' || unread === 'true',
            take: take ? Number(take) : 30,
        });
    }
    async readOne(req, id) {
        const expertId = String(req.user?.sub ?? req.user?.userId ?? '');
        return this.svc.markRead(expertId, id);
    }
    async readAll(req) {
        const expertId = String(req.user?.sub ?? req.user?.userId ?? '');
        return this.svc.markAllRead(expertId);
    }
};
exports.ExpertNotificationsController = ExpertNotificationsController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('unread')),
    __param(2, (0, common_1.Query)('take')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ExpertNotificationsController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id/read'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExpertNotificationsController.prototype, "readOne", null);
__decorate([
    (0, common_1.Patch)('read-all'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.EXPERT),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExpertNotificationsController.prototype, "readAll", null);
exports.ExpertNotificationsController = ExpertNotificationsController = __decorate([
    (0, common_1.Controller)('expert/notifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], ExpertNotificationsController);
//# sourceMappingURL=notifications.expert.controller.js.map