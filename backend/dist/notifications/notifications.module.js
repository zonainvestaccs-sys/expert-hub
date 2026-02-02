"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const auth_module_1 = require("../auth/auth.module");
const experts_module_1 = require("../experts/experts.module");
const notifications_gateway_1 = require("./notifications.gateway");
const notifications_service_1 = require("./notifications.service");
const notifications_scheduler_1 = require("./notifications.scheduler");
const notifications_admin_controller_1 = require("./notifications.admin.controller");
const notifications_expert_controller_1 = require("./notifications.expert.controller");
const notifications_test_controller_1 = require("./notifications.test.controller");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            experts_module_1.ExpertsModule,
        ],
        controllers: [
            notifications_admin_controller_1.AdminNotificationsController,
            notifications_expert_controller_1.ExpertNotificationsController,
            notifications_test_controller_1.NotificationsTestController,
        ],
        providers: [
            prisma_service_1.PrismaService,
            notifications_gateway_1.NotificationsGateway,
            notifications_service_1.NotificationsService,
            notifications_scheduler_1.NotificationsScheduler,
        ],
        exports: [notifications_service_1.NotificationsService, notifications_gateway_1.NotificationsGateway],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map