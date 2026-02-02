import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace(/^Bearer\s+/i, '') ||
        '';

      if (!token) return client.disconnect(true);

      const payload: any = this.jwt.verify(token);
      const userId = String(payload?.sub ?? payload?.userId ?? '');
      const role = String(payload?.role ?? '');

      // Só expert conecta pra canal expert
      if (!userId || role !== 'EXPERT') return client.disconnect(true);

      client.join(`expert:${userId}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // nada especial
  }

  // opcional: ping/pong
  @SubscribeMessage('ping')
  ping(@ConnectedSocket() client: Socket, @MessageBody() body: any) {
    client.emit('pong', body ?? {});
  }

  /**
   * ✅ Mantém compatibilidade:
   * Continua emitindo no evento "notification"
   */
  emitToExpert(expertId: string, payload: any) {
    this.server.to(`expert:${expertId}`).emit('notification', payload);
  }

  /**
   * ✅ Novo: permite escolher o nome do evento (ex: "notification:unread")
   * Sem quebrar o método antigo.
   */
  emitEventToExpert(expertId: string, event: string, payload: any) {
    this.server.to(`expert:${expertId}`).emit(event, payload);
  }

  /**
   * ✅ Helper opcional para sino/unread
   */
  emitUnreadToExpert(expertId: string, payload: { bump: number }) {
    this.emitEventToExpert(expertId, 'notification:unread', payload);
  }
}
