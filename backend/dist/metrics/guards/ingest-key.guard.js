"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestKeyGuard = void 0;
const common_1 = require("@nestjs/common");
let IngestKeyGuard = class IngestKeyGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const expected = (process.env.METRICS_INGEST_KEY || '').trim();
        if (!expected) {
            throw new common_1.ForbiddenException('METRICS_INGEST_KEY não configurada no .env');
        }
        const provided = req.headers['x-ingest-key'] ||
            req.headers['X-INGEST-KEY'];
        if (!provided || String(provided).trim() !== expected) {
            throw new common_1.ForbiddenException('Chave de ingestão inválida');
        }
        return true;
    }
};
exports.IngestKeyGuard = IngestKeyGuard;
exports.IngestKeyGuard = IngestKeyGuard = __decorate([
    (0, common_1.Injectable)()
], IngestKeyGuard);
//# sourceMappingURL=ingest-key.guard.js.map