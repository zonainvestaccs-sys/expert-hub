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
exports.NotificationsScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const experts_service_1 = require("../experts/experts.service");
const notifications_gateway_1 = require("./notifications.gateway");
let NotificationsScheduler = class NotificationsScheduler {
    expertsService;
    gateway;
    constructor(expertsService, gateway) {
        this.expertsService = expertsService;
        this.gateway = gateway;
    }
    async tick() {
        const { actions } = await this.expertsService.runNotificationsTickNow();
        for (const a of actions) {
            const res = await this.expertsService.createActivationNotificationIfNeeded({
                expertId: a.expertId,
                dateIso: a.dateIso,
                hhmm: a.hhmm,
                fresh: true,
            });
            const created = res?.created;
            if (created?.id) {
                this.gateway.emitToExpert(a.expertId, created);
                this.gateway.emitUnreadToExpert(a.expertId, { bump: 1 });
            }
        }
    }
};
exports.NotificationsScheduler = NotificationsScheduler;
__decorate([
    (0, schedule_1.Cron)('* * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationsScheduler.prototype, "tick", null);
exports.NotificationsScheduler = NotificationsScheduler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [experts_service_1.ExpertsService,
        notifications_gateway_1.NotificationsGateway])
], NotificationsScheduler);
//# sourceMappingURL=notifications.scheduler.js.map