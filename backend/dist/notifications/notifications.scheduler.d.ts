import { ExpertsService } from '../experts/experts.service';
import { NotificationsGateway } from './notifications.gateway';
export declare class NotificationsScheduler {
    private readonly expertsService;
    private readonly gateway;
    constructor(expertsService: ExpertsService, gateway: NotificationsGateway);
    tick(): Promise<void>;
}
