import { ExpertsService } from '../experts/experts.service';
export declare class ExpertNotificationsController {
    private readonly expertsService;
    constructor(expertsService: ExpertsService);
    list(req: any, page?: string, pageSize?: string, unreadOnly?: string): Promise<{
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
    readOne(req: any, id: string): Promise<{
        ok: boolean;
        already: boolean;
    } | {
        ok: boolean;
        already?: undefined;
    }>;
    readAll(req: any): Promise<{
        ok: boolean;
    }>;
}
