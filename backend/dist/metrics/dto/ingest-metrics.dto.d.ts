export declare class IngestMetricsDto {
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
    raw?: Record<string, any>;
}
