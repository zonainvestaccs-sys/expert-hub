import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  /**
   * Onde os uploads ficam no disco
   * backend/uploads/users/<userId>/<file>
   */
  private baseDir = path.resolve(process.cwd(), 'uploads');

  private async ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
  }

  private safeExt(originalName: string) {
    const ext = path.extname(originalName || '').toLowerCase();
    // permite só extensões comuns
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    return allowed.has(ext) ? ext : '.jpg';
  }

  /**
   * Salva a foto do expert no disco e retorna a URL pública
   * Ex: /uploads/users/<userId>/<filename>
   */
  async saveUserPhoto(params: { userId: string; file: Express.Multer.File }) {
    const { userId, file } = params;

    if (!userId) throw new BadRequestException('userId obrigatório');
    if (!file) throw new BadRequestException('Arquivo obrigatório');

    // limite básico (vc pode ler de env depois)
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) throw new BadRequestException('Arquivo muito grande (máx 5MB)');

    const ext = this.safeExt(file.originalname);
    const fileName = `${Date.now()}_${randomUUID()}${ext}`;

    const dir = path.join(this.baseDir, 'users', userId);
    await this.ensureDir(dir);

    const abs = path.join(dir, fileName);
    await fs.writeFile(abs, file.buffer);

    // URL pública que vamos servir no Nest (main.ts)
    const publicUrl = `/uploads/users/${userId}/${fileName}`;

    return { publicUrl, fileName };
  }
}
