// src/admin/admin.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // =========================
  // ✅ OVERVIEW GERAL
  // GET /admin/overview?from&to&expertId
  // =========================
  @Get('overview')
  @Roles(UserRole.ADMIN)
  async overview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('expertId') expertId?: string,
  ) {
    try {
      return await this.adminService.overview({ from, to, expertId });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ SÉRIE (ADMIN) - CONSOLIDADO OU POR EXPERT
  // GET /admin/series?from&to&group=day|week|month&expertId=ALL|<id>
  // ✅ Retorna points com: revBRL, depositsBRL, leadsTotal, ftdCount
  // =========================
  @Get('series')
  @Roles(UserRole.ADMIN)
  async series(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('group') group?: 'day' | 'week' | 'month',
    @Query('expertId') expertId?: string,
  ) {
    try {
      return await this.adminService.series({ from, to, group, expertId });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ LISTAR EXPERTS
  // GET /admin/experts
  // =========================
  @Get('experts')
  @Roles(UserRole.ADMIN)
  async listExperts() {
    try {
      return await this.adminService.listExperts();
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ CRIAR EXPERT
  // POST /admin/experts
  // =========================
  @Post('experts')
  @Roles(UserRole.ADMIN)
  async createExpert(@Body() body: any) {
    try {
      return await this.adminService.createExpert(body);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ OVERVIEW DO EXPERT
  // GET /admin/experts/:expertId/overview?from&to
  // =========================
  @Get('experts/:expertId/overview')
  @Roles(UserRole.ADMIN)
  async expertOverview(
    @Param('expertId') expertId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    try {
      return await this.adminService.expertOverview(expertId, { from, to });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ SÉRIE DO EXPERT
  // GET /admin/experts/:expertId/series?from&to&group=day|week|month
  // =========================
  @Get('experts/:expertId/series')
  @Roles(UserRole.ADMIN)
  async expertSeries(
    @Param('expertId') expertId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('group') group?: 'day' | 'week' | 'month',
  ) {
    try {
      return await this.adminService.expertSeries(expertId, { from, to, group });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ LEADS DO EXPERT
  // GET /admin/experts/:expertId/leads?from&to&page&pageSize&q&status&sortBy&sortDir
  // =========================
  @Get('experts/:expertId/leads')
  @Roles(UserRole.ADMIN)
  async expertLeads(
    @Param('expertId') expertId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    try {
      return await this.adminService.expertLeads(expertId, {
        from,
        to,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 25,
        q,
        status,
        sortBy,
        sortDir,
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ EDITAR EXPERT
  // PATCH /admin/experts/:expertId
  // =========================
  @Patch('experts/:expertId')
  @Roles(UserRole.ADMIN)
  async updateExpert(@Param('expertId') expertId: string, @Body() body: any) {
    try {
      return await this.adminService.updateExpert(expertId, body);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ TROCAR SENHA EXPERT
  // PATCH /admin/experts/:expertId/password
  // body: { password }
  // =========================
  @Patch('experts/:expertId/password')
  @Roles(UserRole.ADMIN)
  async updateExpertPassword(@Param('expertId') expertId: string, @Body() body: any) {
    try {
      return await this.adminService.updateExpertPassword(expertId, String(body?.password || ''));
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ UPLOAD FOTO EXPERT
  // POST /admin/experts/:expertId/photo (multipart/form-data "file")
  // =========================
  @Post('experts/:expertId/photo')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async updateExpertPhoto(@Param('expertId') expertId: string, @UploadedFile() file?: Express.Multer.File) {
    try {
      return await this.adminService.updateExpertPhoto(expertId, file);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }
}
