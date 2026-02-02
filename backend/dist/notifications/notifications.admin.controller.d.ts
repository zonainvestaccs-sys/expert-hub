import { NotificationsService } from './notifications.service';
export declare class AdminNotificationsController {
    private readonly svc;
    constructor(svc: NotificationsService);
    get(expertId: string): Promise<{
        id: string;
        createdAt: Date;
        expertId: string;
        isActive: boolean;
        updatedAt: Date;
        times: string[];
        timezone: string;
    }>;
    update(expertId: string, body: {
        isActive?: boolean;
        times?: string[];
        timezone?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        expertId: string;
        isActive: boolean;
        updatedAt: Date;
        times: string[];
        timezone: string;
    }>;
}
