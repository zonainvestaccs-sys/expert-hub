import { PrismaService } from '../prisma.service';
export declare class MetricsIngestService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    cronTick(): Promise<void>;
    ingestAllExperts(opts?: {
        fresh?: boolean;
    }): Promise<{
        ok: number;
        skipped: number;
        failed: number;
    }>;
    ingestOneExpertFromUrl(expertId: string, url: string, opts?: {
        fresh?: boolean;
    }): Promise<{
        ok: boolean;
        upserts: number;
    }>;
}
