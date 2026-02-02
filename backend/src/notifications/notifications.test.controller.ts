import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsTestController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('ping')
  @Roles(UserRole.ADMIN)
  ping() {
    return { ok: true };
  }

  @Post('test-push')
  @Roles(UserRole.ADMIN)
  async testPush(
    @Body() body: { expertId: string; title: string; message: string; kind?: string; dateIso?: string | null },
  ) {
    const expertId = String(body?.expertId ?? '').trim();
    if (!expertId) throw new Error('expertId obrigatório');

    return this.svc.createAndPush(expertId, {
      title: String(body?.title ?? 'Teste').trim(),
      message: String(body?.message ?? '').trim(),
      kind: String(body?.kind ?? 'ACTIVATION').trim(),
      dateIso: body?.dateIso ?? null,
    });
  }
}
