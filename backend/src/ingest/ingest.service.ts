// src/ingest/ingest.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type UpsertDailyMetricsDto = {
  expertId: string;
  day: string; // YYYY-MM-DD

  leadsTotal?: number;
  leadsActive?: number;

  depositsCount?: number;
  depositsTotalCents?: number;

  ftdCount?: number;

  revCents?: number;

  salesCents?: number;
  salesCount?: number;

  trafficCents?: number;

  source?: string;
  raw?: any;
};

function toUtcMidnight(dayYYYYMMDD: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYYYYMMDD)) {
    throw new Error('day deve ser YYYY-MM-DD');
  }
  return new Date(`${dayYYYYMMDD}T00:00:00.000Z`);
}

@Injectable()
export class IngestService {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ compat com teu controller atual
  async upsertDailyMetrics(dto: UpsertDailyMetricsDto) {
    return this.ingest(dto);
  }

  // ✅ nome "mais limpo" se vc quiser usar depois
  async ingest(dto: UpsertDailyMetricsDto) {
    try {
      if (!dto?.expertId) throw new Error('expertId obrigatório');
      if (!dto?.day) throw new Error('day obrigatório');

      const expert = await this.prisma.user.findUnique({
        where: { id: dto.expertId },
        select: { id: true, role: true, email: true },
      });

      if (!expert) throw new Error('expertId não encontrado');
      if (expert.role !== 'EXPERT') throw new Error('expertId não é EXPERT');

      const day = toUtcMidnight(dto.day);

      const create: any = { expertId: dto.expertId, day };
      const update: any = {};

      const numericFields: Array<keyof UpsertDailyMetricsDto> = [
        'leadsTotal',
        'leadsActive',
        'depositsCount',
        'depositsTotalCents',
        'ftdCount',
        'revCents',
        'salesCents',
        'salesCount',
        'trafficCents',
      ];

      for (const f of numericFields) {
        const v = dto[f];
        if (typeof v === 'number' && Number.isFinite(v)) {
          create[f] = v;
          update[f] = v;
        }
      }

      if (typeof dto.source === 'string') {
        create.source = dto.source;
        update.source = dto.source;
      }

      if (dto.raw !== undefined) {
        create.raw = dto.raw;
        update.raw = dto.raw;
      }

      const row = await this.prisma.metricsDaily.upsert({
        where: { expertId_day: { expertId: dto.expertId, day } },
        create,
        update,
      });

      return {
        ok: true,
        expert: { id: expert.id, email: expert.email },
        metricsDaily: row,
      };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Falha ao ingerir métricas');
    }
  }
}
