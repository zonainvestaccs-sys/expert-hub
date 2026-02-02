import { NotificationsService } from './notifications.service';
export declare class ExpertNotificationsController {
    private readonly svc;
    constructor(svc: NotificationsService);
    list(req: any, unread?: string, take?: string): Promise<{
        items: {
            id: string;
            createdAt: Date;
            expertId: string;
            title: string;
            message: string;
            kind: string;
            dateIso: string | null;
            isRead: boolean;
            readAt: Date | null;
        }[];
        unreadCount: number;
    }>;
    readOne(req: any, id: string): Promise<{
        ok: boolean;
    }>;
    readAll(req: any): Promise<{
        ok: boolean;
    }>;
}
