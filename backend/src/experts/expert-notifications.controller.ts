import { BadRequestException, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertsService } from '../experts/experts.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('expert/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpertNotificationsController {
  constructor(private readonly expertsService: ExpertsService) {}

  // GET /expert/notifications?page=1&pageSize=20&unreadOnly=0
  @Get()
  @Roles(UserRole.EXPERT)
  async list(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    try {
      const expertId = String(req?.user?.id || '');
      return await this.expertsService.listExpertNotifications(expertId, {
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
        unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // PATCH /expert/notifications/:id/read
  @Patch(':id/read')
  @Roles(UserRole.EXPERT)
  async readOne(@Req() req: any, @Param('id') id: string) {
    try {
      const expertId = String(req?.user?.id || '');
      return await this.expertsService.markNotificationRead(expertId, id);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // PATCH /expert/notifications/read-all
  @Patch('read-all')
  @Roles(UserRole.EXPERT)
  async readAll(@Req() req: any) {
    try {
      const expertId = String(req?.user?.id || '');
      return await this.expertsService.markAllNotificationsRead(expertId);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }
}
