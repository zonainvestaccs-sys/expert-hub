import { IngestService } from './ingest.service';
type IngestMetricsDto = {
    secret: string;
    expertId: string;
    day: string;
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
export declare class IngestController {
    private readonly ingest;
    constructor(ingest: IngestService);
    upsertDaily(dto: IngestMetricsDto): Promise<{
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
export {};
