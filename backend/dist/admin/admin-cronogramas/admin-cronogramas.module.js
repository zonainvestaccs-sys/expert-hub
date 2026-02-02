"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCronogramasModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const appointments_module_1 = require("../../appointments/appointments.module");
const admin_cronogramas_controller_1 = require("./admin-cronogramas.controller");
const admin_cronogramas_service_1 = require("./admin-cronogramas.service");
let AdminCronogramasModule = class AdminCronogramasModule {
};
exports.AdminCronogramasModule = AdminCronogramasModule;
exports.AdminCronogramasModule = AdminCronogramasModule = __decorate([
    (0, common_1.Module)({
        imports: [appointments_module_1.AppointmentsModule],
        controllers: [admin_cronogramas_controller_1.AdminCronogramasController],
        providers: [admin_cronogramas_service_1.AdminCronogramasService, prisma_service_1.PrismaService],
    })
], AdminCronogramasModule);
//# sourceMappingURL=admin-cronogramas.module.js.map