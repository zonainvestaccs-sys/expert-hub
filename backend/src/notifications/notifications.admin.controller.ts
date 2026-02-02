import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';

@Controller('admin/experts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminNotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get(':expertId/notification-rule')
  @Roles(UserRole.ADMIN)
  async get(@Param('expertId') expertId: string) {
    return this.svc.getRule(expertId);
  }

  @Patch(':expertId/notification-rule')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('expertId') expertId: string,
    @Body() body: { isActive?: boolean; times?: string[]; timezone?: string },
  ) {
    return this.svc.upsertRule(expertId, body);
  }
}
