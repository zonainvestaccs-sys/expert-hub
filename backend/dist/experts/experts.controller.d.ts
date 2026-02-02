import { ExpertsService } from './experts.service';
export declare class ExpertsController {
    private readonly expertsService;
    constructor(expertsService: ExpertsService);
    overview(req: any, from?: string, to?: string): Promise<{
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
    me(req: any, from?: string, to?: string): Promise<{
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
    profile(req: any): Promise<{
        createdAt: string;
        notificationRule: any;
    }>;
    series(req: any, from?: string, to?: string, group?: 'day' | 'week' | 'month'): Promise<{
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
    leads(req: any, from?: string, to?: string, page?: string, pageSize?: string, q?: string, sortBy?: any, sortDir?: 'asc' | 'desc', tagIds?: string, fresh?: string): Promise<{
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
    activations(req: any, from?: string, to?: string, page?: string, pageSize?: string, q?: string, sortBy?: any, sortDir?: 'asc' | 'desc', fresh?: string): Promise<{
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
    tags(req: any): Promise<{
        items: {
            id: string;
            createdAt: Date;
            name: string;
            color: string;
        }[];
    }>;
    createTag(req: any, body: any): Promise<{
        ok: boolean;
        tag: {
            id: string;
            createdAt: Date;
            name: string;
            color: string;
        };
    }>;
    updateTag(req: any, tagId: string, body: any): Promise<{
        ok: boolean;
        tag: {
            id: string;
            createdAt: Date;
            name: string;
            color: string;
        };
    }>;
    deleteTag(req: any, tagId: string): Promise<{
        ok: boolean;
    }>;
    setLeadTagsPut(req: any, leadKey: string, body: any): Promise<{
        ok: boolean;
        leadKey: string;
        tagIds: string[];
    }>;
    setLeadTagsPost(req: any, leadKey: string, body: any): Promise<{
        ok: boolean;
        leadKey: string;
        tagIds: string[];
    }>;
    addLeadTag(req: any, leadKey: string, tagId: string): Promise<{
        ok: boolean;
        enabled: boolean;
    }>;
    removeLeadTag(req: any, leadKey: string, tagId: string): Promise<{
        ok: boolean;
        enabled: boolean;
    }>;
}
