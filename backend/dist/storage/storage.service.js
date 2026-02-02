"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
let StorageService = class StorageService {
    baseDir = path.resolve(process.cwd(), 'uploads');
    async ensureDir(dir) {
        await fs_1.promises.mkdir(dir, { recursive: true });
    }
    safeExt(originalName) {
        const ext = path.extname(originalName || '').toLowerCase();
        const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);
        return allowed.has(ext) ? ext : '.jpg';
    }
    async saveUserPhoto(params) {
        const { userId, file } = params;
        if (!userId)
            throw new common_1.BadRequestException('userId obrigatório');
        if (!file)
            throw new common_1.BadRequestException('Arquivo obrigatório');
        const maxBytes = 5 * 1024 * 1024;
        if (file.size > maxBytes)
            throw new common_1.BadRequestException('Arquivo muito grande (máx 5MB)');
        const ext = this.safeExt(file.originalname);
        const fileName = `${Date.now()}_${(0, crypto_1.randomUUID)()}${ext}`;
        const dir = path.join(this.baseDir, 'users', userId);
        await this.ensureDir(dir);
        const abs = path.join(dir, fileName);
        await fs_1.promises.writeFile(abs, file.buffer);
        const publicUrl = `/uploads/users/${userId}/${fileName}`;
        return { publicUrl, fileName };
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)()
], StorageService);
//# sourceMappingURL=storage.service.js.map