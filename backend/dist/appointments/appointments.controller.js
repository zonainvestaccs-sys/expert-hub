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
exports.AppointmentsController = void 0;
const common_1 = require("@nestjs/common");
const appointments_service_1 = require("./appointments.service");
const create_appointment_dto_1 = require("./dto/create-appointment.dto");
const update_appointment_dto_1 = require("./dto/update-appointment.dto");
const passport_1 = require("@nestjs/passport");
function parseScope(scope) {
    if (scope === 'series')
        return 'series';
    if (scope === 'future')
        return 'future';
    return 'single';
}
function parseDateStrict(v, label) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime()))
        throw new common_1.BadRequestException(`${label} inválido`);
    return d;
}
let AppointmentsController = class AppointmentsController {
    service;
    constructor(service) {
        this.service = service;
    }
    getExpertId(req) {
        const id = req?.user?.userId;
        if (!id)
            throw new common_1.BadRequestException('Usuário inválido');
        return id;
    }
    async list(req, from, to) {
        const expertId = this.getExpertId(req);
        if (!from || !to)
            return [];
        const fromDate = parseDateStrict(from, 'from');
        const toDate = parseDateStrict(to, 'to');
        if (toDate.getTime() <= fromDate.getTime()) {
            throw new common_1.BadRequestException('to deve ser maior que from');
        }
        return this.service.list(expertId, { from: fromDate, to: toDate });
    }
    async create(req, dto) {
        const expertId = this.getExpertId(req);
        return this.service.create(expertId, dto);
    }
    async update(req, id, dto, scope) {
        const expertId = this.getExpertId(req);
        return this.service.update(expertId, id, dto, parseScope(scope));
    }
    async remove(req, id, scope) {
        const expertId = this.getExpertId(req);
        return this.service.remove(expertId, id, parseScope(scope));
    }
};
exports.AppointmentsController = AppointmentsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_appointment_dto_1.CreateAppointmentDto]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('scope')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_appointment_dto_1.UpdateAppointmentDto, String]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('scope')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "remove", null);
exports.AppointmentsController = AppointmentsController = __decorate([
    (0, common_1.Controller)('appointments'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [appointments_service_1.AppointmentsService])
], AppointmentsController);
//# sourceMappingURL=appointments.controller.js.map