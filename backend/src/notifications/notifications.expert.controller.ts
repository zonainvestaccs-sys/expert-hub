import { Controller, Get, Param, Patch, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';

@Controller('expert/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpertNotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @Roles(UserRole.EXPERT)
  async list(@Req() req: any, @Query('unread') unread?: string, @Query('take') take?: string) {
    const expertId = String(req.user?.sub ?? req.user?.userId ?? '');
    return this.svc.listExpertNotifications(expertId, {
      unreadOnly: unread === '1' || unread === 'true',
      take: take ? Number(take) : 30,
    });
  }

  @Patch(':id/read')
  @Roles(UserRole.EXPERT)
  async readOne(@Req() req: any, @Param('id') id: string) {
    const expertId = String(req.user?.sub ?? req.user?.userId ?? '');
    return this.svc.markRead(expertId, id);
  }

  @Patch('read-all')
  @Roles(UserRole.EXPERT)
  async readAll(@Req() req: any) {
    const expertId = String(req.user?.sub ?? req.user?.userId ?? '');
    return this.svc.markAllRead(expertId);
  }
}
