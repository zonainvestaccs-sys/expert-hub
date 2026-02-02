"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const admin_module_1 = require("./admin/admin.module");
const experts_module_1 = require("./experts/experts.module");
const leads_module_1 = require("./leads/leads.module");
const deposits_module_1 = require("./deposits/deposits.module");
const metrics_module_1 = require("./metrics/metrics.module");
const ingest_module_1 = require("./ingest/ingest.module");
const storage_module_1 = require("./storage/storage.module");
const schedule_1 = require("@nestjs/schedule");
const notifications_module_1 = require("./notifications/notifications.module");
const appointments_module_1 = require("./appointments/appointments.module");
const admin_cronogramas_module_1 = require("./admin/admin-cronogramas/admin-cronogramas.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            admin_module_1.AdminModule,
            experts_module_1.ExpertsModule,
            leads_module_1.LeadsModule,
            deposits_module_1.DepositsModule,
            metrics_module_1.MetricsModule,
            ingest_module_1.IngestModule,
            storage_module_1.StorageModule,
            schedule_1.ScheduleModule.forRoot(),
            notifications_module_1.NotificationsModule,
            appointments_module_1.AppointmentsModule,
            admin_cronogramas_module_1.AdminCronogramasModule,
        ],
        providers: [prisma_service_1.PrismaService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map