import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
export declare class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwt;
    server: Server;
    constructor(jwt: JwtService);
    handleConnection(client: Socket): Promise<Socket<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any> | undefined>;
    handleDisconnect(client: Socket): void;
    ping(client: Socket, body: any): void;
    emitToExpert(expertId: string, payload: any): void;
    emitEventToExpert(expertId: string, event: string, payload: any): void;
    emitUnreadToExpert(expertId: string, payload: {
        bump: number;
    }): void;
}
