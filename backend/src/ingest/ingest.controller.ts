import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { IngestService } from './ingest.service';

type IngestMetricsDto = {
  secret: string;
  expertId: string;
  day: string; // YYYY-MM-DD
  source?: string;
  metrics: {
    leadsTotal?: number;
    leadsActive?: number;
    depositsCount?: number;
    depositsTotalCents?: number;
    ftdCount?: number;
    revCents?: number;
    salesCents?: number;
    salesCount?: number;
    trafficCents?: number;
  };
  raw?: any;
};

@Controller('ingest')
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  @Post('metrics')
  async upsertDaily(@Body() dto: IngestMetricsDto) {
    const secret = process.env.INGEST_SECRET || '';
    if (!secret || dto.secret !== secret) {
      throw new UnauthorizedException('Invalid ingest secret');
    }

    return this.ingest.upsertDailyMetrics(dto);
  }
}
