import { ExpertsService } from './experts.service';
export declare class AdminExpertsController {
    private readonly expertsService;
    constructor(expertsService: ExpertsService);
    profile(expertId: string): Promise<{
        createdAt: string;
        notificationRule: any;
    }>;
    leads(expertId: string, from?: string, to?: string, page?: string, pageSize?: string, q?: string, sortBy?: any, sortDir?: 'asc' | 'desc', fresh?: string): Promise<{
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
    activations(expertId: string, from?: string, to?: string, page?: string, pageSize?: string, q?: string, sortBy?: any, sortDir?: 'asc' | 'desc', fresh?: string): Promise<{
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
    getRule(expertId: string): Promise<{
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
    upsertRule(expertId: string, body: any): Promise<{
        createdAt: string;
        updatedAt: string;
        expertId: string;
        id: string;
        isActive: boolean;
        times: string[];
        timezone: string;
    }>;
}
