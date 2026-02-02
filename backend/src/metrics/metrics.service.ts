// src/metrics/metrics.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { IngestMetricsDto } from './dto/ingest-metrics.dto';

function toUtcMidnight(dayYYYYMMDD: string): Date {
  // salva como 00:00:00Z do dia
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYYYYMMDD)) {
    throw new Error('day inválido (use YYYY-MM-DD)');
  }
  return new Date(`${dayYYYYMMDD}T00:00:00.000Z`);
}

function hasAnyMetric(dto: IngestMetricsDto) {
  const keys: Array<keyof IngestMetricsDto> = [
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
  return keys.some((k) => typeof dto[k] === 'number' && Number.isFinite(dto[k] as number));
}

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(dto: IngestMetricsDto) {
    if (!dto.expertId) throw new BadRequestException('expertId obrigatório');
    if (!dto.day) throw new BadRequestException('day obrigatório (YYYY-MM-DD)');

    if (!hasAnyMetric(dto) && !dto.source && !dto.raw) {
      throw new BadRequestException('Envie pelo menos 1 métrica (ou source/raw)');
    }

    // garante que o expert existe (e opcionalmente que é EXPERT)
    const user = await this.prisma.user.findUnique({
      where: { id: dto.expertId },
      select: { id: true, role: true, email: true },
    });

    if (!user) throw new BadRequestException('expertId não encontrado');
    // se vc quiser permitir ADMIN também, tira esse if
    if (user.role !== 'EXPERT') throw new BadRequestException('expertId não é um EXPERT');

    let day: Date;
    try {
      day = toUtcMidnight(dto.day);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'day inválido');
    }

    // build de create/update (SET parcial: só altera o que vc mandar)
    const updateData: any = {};
    const createData: any = {
      expertId: dto.expertId,
      day,
    };

    const fields: Array<keyof IngestMetricsDto> = [
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

    for (const f of fields) {
      const v = dto[f];
      if (typeof v === 'number' && Number.isFinite(v)) {
        updateData[f] = v;
        createData[f] = v;
      }
    }

    if (typeof dto.source === 'string') {
      updateData.source = dto.source;
      createData.source = dto.source;
    }

    if (dto.raw && typeof dto.raw === 'object') {
      updateData.raw = dto.raw;
      createData.raw = dto.raw;
    }

    const row = await this.prisma.metricsDaily.upsert({
      where: {
        expertId_day: {
          expertId: dto.expertId,
          day,
        },
      },
      create: createData,
      update: updateData,
    });

    return {
      ok: true,
      expert: { id: user.id, email: user.email },
      metricsDaily: row,
    };
  }
}
