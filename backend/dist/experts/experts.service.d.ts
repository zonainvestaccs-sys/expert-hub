import { PrismaService } from '../prisma.service';
type LeadsSortBy = 'date' | 'firstDeposit' | 'deposits' | 'rev' | 'withdrawals' | 'gains' | 'losses' | 'balance' | 'email' | 'wpp';
type ActivationsSortBy = 'date' | 'activation' | 'ftd' | 'deposit' | 'rev';
export declare class ExpertsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private leadsCache;
    private leadsCacheTtlMs;
    private activationsCache;
    private activationsCacheTtlMs;
    private metricsCsvCache;
    private metricsCsvCacheTtlMs;
    private revSaquesCsvCache;
    private revSaquesCsvCacheTtlMs;
    getExpertOverview(expertId: string, params?: {
        from?: string;
        to?: string;
    }): Promise<{
        period: {
            from: string;
            to: string;
        };
        kpis: {
            leadsTotal: number;
            leadsActive: number;
            depositsCount: number;
            depositsTotalCents: number;
            ftdCount: number;
            revCents: number;
            revWithdrawalsCents: number;
            salesCents: number;
            salesCount: number;
            trafficCents: number;
        };
    }>;
    getExpertProfile(expertId: string): Promise<{
        createdAt: string;
        notificationRule: any;
    }>;
    getExpertSeries(expertId: string, params: {
        from?: string;
        to?: string;
        group?: 'day' | 'week' | 'month';
    }): Promise<{
        period: {
            from: string;
            to: string;
        };
        group: "day";
        points: {
            label: string;
            leadsTotal: number;
            leadsActive: number;
            depositsBRL: number;
            ftdCount: number;
            revBRL: number;
            salesBRL: number;
            salesCount: number;
            trafficBRL: number;
        }[];
    } | {
        period: {
            from: string;
            to: string;
        };
        group: "week" | "month";
        points: any[];
    }>;
    listTags(expertId: string): Promise<{
        items: {
            id: string;
            createdAt: Date;
            name: string;
            color: string;
        }[];
    }>;
    createTag(expertId: string, body: any): Promise<{
        ok: boolean;
        tag: {
            id: string;
            createdAt: Date;
            name: string;
            color: string;
        };
    }>;
    updateTag(expertId: string, tagId: string, body: any): Promise<{
        ok: boolean;
        tag: {
            id: string;
            createdAt: Date;
            name: string;
            color: string;
        };
    }>;
    deleteTag(expertId: string, tagId: string): Promise<{
        ok: boolean;
    }>;
    setLeadTag(expertId: string, leadKey: string, tagId: string, enabled: boolean): Promise<{
        ok: boolean;
        enabled: boolean;
    }>;
    setLeadTags(expertId: string, leadKey: string, body: any): Promise<{
        ok: boolean;
        leadKey: string;
        tagIds: string[];
    }>;
    getExpertLeads(expertId: string, params: {
        from?: string;
        to?: string;
        page: number;
        pageSize: number;
        q?: string;
        sortBy?: LeadsSortBy;
        sortDir?: 'asc' | 'desc';
        fresh?: boolean;
        tagIds?: string[];
    }): Promise<{
        source: string;
        period: {
            from: string | null;
            to: string | null;
        };
        page: number;
        pageSize: number;
        total: number;
        items: never[];
        warning: string;
        csvUrl?: undefined;
    } | {
        source: string;
        period: {
            from: string | null;
            to: string | null;
        };
        page: number;
        pageSize: number;
        total: number;
        items: {
            leadKey: string;
            tags: {
                id: string;
                name: string;
                color: string;
            }[];
            id: string;
            date: string;
            dateLabel: string;
            email: string;
            wpp: string;
            firstDeposit: number;
            deposits: number;
            rev: number;
            withdrawals: number;
            gains: number;
            losses: number;
            balance: number;
            raw?: any;
        }[];
        csvUrl: string;
        warning?: undefined;
    }>;
    getExpertActivations(expertId: string, params: {
        from?: string;
        to?: string;
        page: number;
        pageSize: number;
        q?: string;
        sortBy?: ActivationsSortBy;
        sortDir?: 'asc' | 'desc';
        fresh?: boolean;
    }): Promise<{
        source: string;
        period: {
            from: string | null;
            to: string | null;
        };
        page: number;
        pageSize: number;
        total: number;
        items: never[];
        warning: string;
        csvUrl?: undefined;
    } | {
        source: string;
        period: {
            from: string | null;
            to: string | null;
        };
        page: number;
        pageSize: number;
        total: number;
        items: {
            id: string;
            date: string;
            dateLabel: string;
            activation: string;
            description: string;
            ftd: number;
            deposit: number;
            rev: number;
            raw?: any;
        }[];
        csvUrl: string;
        warning?: undefined;
    }>;
    getExpertNotificationRule(expertId: string): Promise<{
        expertId: string;
        isActive: boolean;
        times: never[];
        timezone: string;
        createdAt: null;
        updatedAt: null;
    } | {
        createdAt: string;
        updatedAt: string;
        expertId: string;
        id: string;
        isActive: boolean;
        times: string[];
        timezone: string;
    }>;
    upsertExpertNotificationRule(expertId: string, body: any): Promise<{
        createdAt: string;
        updatedAt: string;
        expertId: string;
        id: string;
        isActive: boolean;
        times: string[];
        timezone: string;
    }>;
    listExpertNotifications(expertId: string, params: {
        page: number;
        pageSize: number;
        unreadOnly?: boolean;
    }): Promise<{
        page: number;
        pageSize: number;
        total: number;
        unreadCount: number;
        items: {
            createdAt: string;
            readAt: string | null;
            id: string;
            title: string;
            message: string;
            kind: string;
            dateIso: string | null;
            isRead: boolean;
        }[];
    }>;
    markNotificationRead(expertId: string, notificationId: string): Promise<{
        ok: boolean;
        already: boolean;
    } | {
        ok: boolean;
        already?: undefined;
    }>;
    markAllNotificationsRead(expertId: string): Promise<{
        ok: boolean;
    }>;
    createActivationNotificationIfNeeded(params: {
        expertId: string;
        dateIso: string;
        hhmm: string;
        fresh?: boolean;
    }): Promise<{
        ok: boolean;
        skipped: string;
        id?: undefined;
        created?: undefined;
    } | {
        ok: boolean;
        skipped: string;
        id: string;
        created?: undefined;
    } | {
        ok: boolean;
        created: {
            createdAt: string;
            id: string;
            title: string;
            message: string;
            kind: string;
            dateIso: string | null;
            isRead: boolean;
        };
        skipped?: undefined;
        id?: undefined;
    }>;
    runNotificationsTickNow(): Promise<{
        actions: {
            expertId: string;
            timezone: string;
            dateIso: string;
            hhmm: string;
        }[];
    }>;
    private getMetricsCsvConfig;
    private getRevSaquesCsvConfig;
    private loadMetricsCsvRows;
    private loadRevSaquesCsvRows;
    private revSaqueCentsByMonth;
    private sumRevSaqueByMonthInRange;
}
export {};
