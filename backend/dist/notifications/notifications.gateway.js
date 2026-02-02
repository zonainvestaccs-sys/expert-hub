"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
let NotificationsGateway = class NotificationsGateway {
    jwt;
    server;
    constructor(jwt) {
        this.jwt = jwt;
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
                '';
            if (!token)
                return client.disconnect(true);
            const payload = this.jwt.verify(token);
            const userId = String(payload?.sub ?? payload?.userId ?? '');
            const role = String(payload?.role ?? '');
            if (!userId || role !== 'EXPERT')
                return client.disconnect(true);
            client.join(`expert:${userId}`);
        }
        catch {
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
    }
    ping(client, body) {
        client.emit('pong', body ?? {});
    }
    emitToExpert(expertId, payload) {
        this.server.to(`expert:${expertId}`).emit('notification', payload);
    }
    emitEventToExpert(expertId, event, payload) {
        this.server.to(`expert:${expertId}`).emit(event, payload);
    }
    emitUnreadToExpert(expertId, payload) {
        this.emitEventToExpert(expertId, 'notification:unread', payload);
    }
};
exports.NotificationsGateway = NotificationsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('ping'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], NotificationsGateway.prototype, "ping", null);
exports.NotificationsGateway = NotificationsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*', credentials: true },
        namespace: '/ws',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], NotificationsGateway);
//# sourceMappingURL=notifications.gateway.js.map