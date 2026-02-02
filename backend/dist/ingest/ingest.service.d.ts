import { PrismaService } from '../prisma.service';
export type UpsertDailyMetricsDto = {
    expertId: string;
    day: string;
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
export declare class IngestService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    upsertDailyMetrics(dto: UpsertDailyMetricsDto): Promise<{
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
    ingest(dto: UpsertDailyMetricsDto): Promise<{
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
