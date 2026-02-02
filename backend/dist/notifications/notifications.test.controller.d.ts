import { NotificationsService } from './notifications.service';
export declare class NotificationsTestController {
    private readonly svc;
    constructor(svc: NotificationsService);
    ping(): {
        ok: boolean;
    };
    testPush(body: {
        expertId: string;
        title: string;
        message: string;
        kind?: string;
        dateIso?: string | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        expertId: string;
        title: string;
        message: string;
        kind: string;
        dateIso: string | null;
        isRead: boolean;
        readAt: Date | null;
    }>;
}
