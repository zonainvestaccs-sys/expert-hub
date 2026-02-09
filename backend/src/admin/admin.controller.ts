// src/admin/admin.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { memoryStorage } from 'multer';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // =========================
  // ✅ OVERVIEW / SERIES
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
  // ✅ EXPERTS (ADMIN)
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

  @Post('experts')
  @Roles(UserRole.ADMIN)
  async createExpert(@Body() body: any) {
    try {
      return await this.adminService.createExpert(body);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

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

  @Patch('experts/:expertId')
  @Roles(UserRole.ADMIN)
  async updateExpert(@Param('expertId') expertId: string, @Body() body: any) {
    try {
      return await this.adminService.updateExpert(expertId, body);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Patch('experts/:expertId/password')
  @Roles(UserRole.ADMIN)
  async updateExpertPassword(@Param('expertId') expertId: string, @Body() body: any) {
    try {
      return await this.adminService.updateExpertPassword(expertId, String(body?.password || ''));
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Post('experts/:expertId/photo')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async updateExpertPhoto(@Param('expertId') expertId: string, @UploadedFile() file?: Express.Multer.File) {
    try {
      return await this.adminService.updateExpertPhoto(expertId, file);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅✅✅ UTILIDADES - PASTAS
  // =========================

  @Get('utility-folders')
  @Roles(UserRole.ADMIN)
  async listUtilityFolders() {
    try {
      // se existir listUtilityFoldersTree usa ele, senão listUtilityFolders
      const svc: any = this.adminService as any;
      if (typeof svc.listUtilityFoldersTree === 'function') return await svc.listUtilityFoldersTree();
      return await svc.listUtilityFolders();
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Post('utility-folders')
  @Roles(UserRole.ADMIN)
  async createUtilityFolder(@Body() body: any) {
    try {
      const svc: any = this.adminService as any;
      return await svc.createUtilityFolder({
        name: String(body?.name || ''),
        parentId: body?.parentId ? String(body.parentId) : null,
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Patch('utility-folders/:id')
  @Roles(UserRole.ADMIN)
  async updateUtilityFolder(@Param('id') id: string, @Body() body: any) {
    try {
      const svc: any = this.adminService as any;
      return await svc.updateUtilityFolder(id, {
        name: String(body?.name || ''),
        parentId: body?.parentId ? String(body.parentId) : null,
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Delete('utility-folders/:id')
  @Roles(UserRole.ADMIN)
  async deleteUtilityFolder(@Param('id') id: string) {
    try {
      const svc: any = this.adminService as any;
      return await svc.deleteUtilityFolder(id);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Post('utility-folders/reorder')
  @Roles(UserRole.ADMIN)
  async reorderFolders(@Body() body: any) {
    try {
      const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds.map(String) : [];
      const svc: any = this.adminService as any;
      if (typeof svc.reorderFolders === 'function') return await svc.reorderFolders(orderedIds);
      return { ok: true };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅✅✅ UTILIDADES - TAGS
  // =========================

  @Get('utility-tags')
  @Roles(UserRole.ADMIN)
  async listUtilityTags() {
    try {
      return await this.adminService.listUtilityTags();
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Post('utility-tags')
  @Roles(UserRole.ADMIN)
  async createUtilityTag(@Body() body: any) {
    try {
      return await this.adminService.createUtilityTag({
        name: String(body?.name || ''),
        color: body?.color ? String(body.color) : null,
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Patch('utility-tags/:id')
  @Roles(UserRole.ADMIN)
  async updateUtilityTag(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.adminService.updateUtilityTag(id, {
        name: String(body?.name || ''),
        color: body?.color ? String(body.color) : null,
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Delete('utility-tags/:id')
  @Roles(UserRole.ADMIN)
  async deleteUtilityTag(@Param('id') id: string) {
    try {
      return await this.adminService.deleteUtilityTag(id);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅✅✅ UTILIDADES - LIST / CREATE / UPDATE / DELETE / REORDER
  // =========================

  @Get('utilities')
  @Roles(UserRole.ADMIN)
  async listUtilities(
    @Query('folderId') folderId?: string,
    @Query('tagIds') tagIds?: string,
    @Query('q') q?: string,
  ) {
    try {
      const tags = String(tagIds || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

      return await this.adminService.listUtilities({
        folderId: folderId ? String(folderId) : '',
        tagIds: tags,
        q: q ? String(q) : '',
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Post('utilities')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createUtility(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: any) {
    try {
      const tagIds = String(body?.tagIds || '')
        .split(',')
        .map((x: string) => x.trim())
        .filter(Boolean);

      return await this.adminService.createUtility(
        {
          name: String(body?.name || ''),
          url: String(body?.url || ''),
          description: String(body?.description || ''),
          folderId: String(body?.folderId || ''),
          tagIds,
        },
        file,
      );
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Patch('utilities/:id')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async updateUtility(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
  ) {
    try {
      const tagIds = String(body?.tagIds || '')
        .split(',')
        .map((x: string) => x.trim())
        .filter(Boolean);

      return await this.adminService.updateUtility(
        id,
        {
          name: body?.name != null ? String(body.name) : undefined,
          url: body?.url != null ? String(body.url) : undefined,
          description: body?.description != null ? String(body.description) : undefined,
          folderId: body?.folderId != null ? String(body.folderId) : undefined,
          tagIds: body?.tagIds != null ? tagIds : undefined,
        },
        file,
      );
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Delete('utilities/:id')
  @Roles(UserRole.ADMIN)
  async deleteUtility(@Param('id') id: string) {
    try {
      return await this.adminService.deleteUtility(id);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Post('utilities/reorder')
  @Roles(UserRole.ADMIN)
  async reorderUtilities(@Body() body: any) {
    try {
      const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds.map(String) : [];
      return await this.adminService.reorderUtilities(orderedIds);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Post('utilities/:id/move')
  @Roles(UserRole.ADMIN)
  async moveUtility(@Param('id') id: string, @Body() body: any) {
    try {
      const folderId = body?.folderId != null ? String(body.folderId) : null;
      const svc: any = this.adminService as any;
      if (typeof svc.moveUtility === 'function') return await svc.moveUtility(id, folderId);
      return { ok: true };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }
}
