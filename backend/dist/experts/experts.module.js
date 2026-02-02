"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpertsModule = void 0;
const common_1 = require("@nestjs/common");
const experts_controller_1 = require("./experts.controller");
const admin_experts_controller_1 = require("./admin-experts.controller");
const experts_service_1 = require("./experts.service");
const prisma_service_1 = require("../prisma.service");
let ExpertsModule = class ExpertsModule {
};
exports.ExpertsModule = ExpertsModule;
exports.ExpertsModule = ExpertsModule = __decorate([
    (0, common_1.Module)({
        controllers: [experts_controller_1.ExpertsController, admin_experts_controller_1.AdminExpertsController],
        providers: [experts_service_1.ExpertsService, prisma_service_1.PrismaService],
        exports: [experts_service_1.ExpertsService],
    })
], ExpertsModule);
//# sourceMappingURL=experts.module.js.map