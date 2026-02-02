// src/metrics/metrics.module.ts
import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsIngestService } from './metrics.ingest.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsIngestService, PrismaService],
  exports: [MetricsService, MetricsIngestService],
})
export class MetricsModule {}
