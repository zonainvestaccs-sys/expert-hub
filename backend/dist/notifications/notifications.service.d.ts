import { PrismaService } from '../prisma.service';
import { NotificationsGateway } from './notifications.gateway';
export declare class NotificationsService {
    private readonly prisma;
    private readonly gateway;
    constructor(prisma: PrismaService, gateway: NotificationsGateway);
    listExpertNotifications(expertId: string, opts?: {
        unreadOnly?: boolean;
        take?: number;
    }): Promise<{
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
    markRead(expertId: string, notificationId: string): Promise<{
        ok: boolean;
    }>;
    markAllRead(expertId: string): Promise<{
        ok: boolean;
    }>;
    getRule(expertId: string): Promise<{
        id: string;
        createdAt: Date;
        expertId: string;
        isActive: boolean;
        updatedAt: Date;
        times: string[];
        timezone: string;
    }>;
    upsertRule(expertId: string, data: {
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
    createAndPush(expertId: string, payload: {
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
    tick(): Promise<void>;
    private getActivationOfDay;
}
