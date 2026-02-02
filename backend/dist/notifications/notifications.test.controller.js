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
exports.NotificationsTestController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const notifications_service_1 = require("./notifications.service");
let NotificationsTestController = class NotificationsTestController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    ping() {
        return { ok: true };
    }
    async testPush(body) {
        const expertId = String(body?.expertId ?? '').trim();
        if (!expertId)
            throw new Error('expertId obrigatório');
        return this.svc.createAndPush(expertId, {
            title: String(body?.title ?? 'Teste').trim(),
            message: String(body?.message ?? '').trim(),
            kind: String(body?.kind ?? 'ACTIVATION').trim(),
            dateIso: body?.dateIso ?? null,
        });
    }
};
exports.NotificationsTestController = NotificationsTestController;
__decorate([
    (0, common_1.Get)('ping'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NotificationsTestController.prototype, "ping", null);
__decorate([
    (0, common_1.Post)('test-push'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsTestController.prototype, "testPush", null);
exports.NotificationsTestController = NotificationsTestController = __decorate([
    (0, common_1.Controller)('admin/notifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], NotificationsTestController);
//# sourceMappingURL=notifications.test.controller.js.map