import { MetricsService } from './metrics.service';
import { IngestMetricsDto } from './dto/ingest-metrics.dto';
export declare class MetricsController {
    private readonly metricsService;
    constructor(metricsService: MetricsService);
    ingest(dto: IngestMetricsDto): Promise<{
        ok: boolean;
        expert: {
            id: string;
            email: string;
        };
        metricsDaily: {
            id: string;
            createdAt: Date;
            expertId: string;
            source: string | null;
            day: Date;
            leadsTotal: number;
            leadsActive: number;
            depositsCount: number;
            depositsTotalCents: number;
            ftdCount: number;
            revCents: number;
            salesCents: number;
            salesCount: number;
            trafficCents: number;
            raw: import("@prisma/client/runtime/client").JsonValue | null;
            updatedAt: Date;
        };
    }>;
}
