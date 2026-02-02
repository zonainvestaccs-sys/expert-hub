import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { IngestKeyGuard } from './guards/ingest-key.guard';
import { IngestMetricsDto } from './dto/ingest-metrics.dto';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post('ingest')
  @UseGuards(IngestKeyGuard)
  ingest(@Body() dto: IngestMetricsDto) {
    return this.metricsService.ingest(dto);
  }
}
