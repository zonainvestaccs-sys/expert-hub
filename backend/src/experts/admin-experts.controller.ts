import { BadRequestException, Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ExpertsService } from './experts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/experts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminExpertsController {
  constructor(private readonly expertsService: ExpertsService) {}

  // ✅ Admin vê profile do expert (email + foto etc)
  // GET /admin/experts/:expertId/profile
  @Get(':expertId/profile')
  @Roles(UserRole.ADMIN)
  async profile(@Param('expertId') expertId: string) {
    try {
      return await this.expertsService.getExpertProfile(expertId);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // ✅ Admin vê leads de qualquer expert
  // GET /admin/experts/:expertId/leads?from=&to=&page=&pageSize=&q=&sortBy=&sortDir=&fresh=1
  @Get(':expertId/leads')
  @Roles(UserRole.ADMIN)
  async leads(
    @Param('expertId') expertId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('sortBy') sortBy?: any,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('fresh') fresh?: string,
  ) {
    try {
      return await this.expertsService.getExpertLeads(expertId, {
        from: from || undefined,
        to: to || undefined,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 25,
        q,
        sortBy,
        sortDir,
        fresh: fresh === '1' || fresh === 'true',
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // ✅ Admin vê ativações de qualquer expert
  // GET /admin/experts/:expertId/activations?from=&to=&page=&pageSize=&q=&sortBy=&sortDir=&fresh=1
  @Get(':expertId/activations')
  @Roles(UserRole.ADMIN)
  async activations(
    @Param('expertId') expertId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('sortBy') sortBy?: any,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('fresh') fresh?: string,
  ) {
    try {
      return await this.expertsService.getExpertActivations(expertId, {
        from: from || undefined,
        to: to || undefined,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 25,
        q,
        sortBy,
        sortDir,
        fresh: fresh === '1' || fresh === 'true',
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // ✅ Admin lê regra de notificação do expert
  // GET /admin/experts/:expertId/notification-rule
  @Get(':expertId/notification-rule')
  @Roles(UserRole.ADMIN)
  async getRule(@Param('expertId') expertId: string) {
    try {
      return await this.expertsService.getExpertNotificationRule(expertId);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // ✅ Admin salva regra de notificação do expert
  // PATCH /admin/experts/:expertId/notification-rule { isActive, timezone, times: ["09:00","13:30"] }
  @Patch(':expertId/notification-rule')
  @Roles(UserRole.ADMIN)
  async upsertRule(@Param('expertId') expertId: string, @Body() body: any) {
    try {
      return await this.expertsService.upsertExpertNotificationRule(expertId, body);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }
}
