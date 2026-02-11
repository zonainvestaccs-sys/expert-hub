import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ExpertsService } from './experts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('expert')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpertsController {
  constructor(private readonly expertsService: ExpertsService) {}

  @Get('overview')
  @Roles(UserRole.EXPERT)
  async overview(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.getExpertOverview(expertId, { from, to });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Get('me')
  @Roles(UserRole.EXPERT)
  async me(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    try {
      const expertId = req.user?.userId;

      // ✅ FIX: /expert/me deve devolver o PERFIL do expert (inclui whatsappBlastEnabled/whatsappBlastIframeUrl)
      // Mantive from/to na assinatura só pra não quebrar quem chama com query, mas aqui não é usado.
      void from;
      void to;

      return await this.expertsService.getExpertProfile(expertId);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Get('profile')
  @Roles(UserRole.EXPERT)
  async profile(@Req() req: any) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.getExpertProfile(expertId);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Get('series')
  @Roles(UserRole.EXPERT)
  async series(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('group') group?: 'day' | 'week' | 'month',
  ) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.getExpertSeries(expertId, { from, to, group: group ?? 'day' });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // ✅ Leads + TAG filter + sorting server-side
  // GET /expert/leads?from=&to=&page=&pageSize=&q=&sortBy=&sortDir=&tagIds=tag1,tag2&fresh=1
  @Get('leads')
  @Roles(UserRole.EXPERT)
  async leads(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
    @Query('sortBy') sortBy?: any,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('tagIds') tagIds?: string,
    @Query('fresh') fresh?: string,
  ) {
    try {
      const expertId = req.user?.userId;
      const ids = String(tagIds || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      return await this.expertsService.getExpertLeads(expertId, {
        from,
        to,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 25,
        q,
        sortBy,
        sortDir,
        tagIds: ids,
        fresh: fresh === '1' || fresh === 'true',
      });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // =========================
  // ✅ ATIVAÇÕES (por expert)
  // =========================
  // GET /expert/activations?from=&to=&page=&pageSize=&q=&sortBy=&sortDir=&fresh=1
  @Get('activations')
  @Roles(UserRole.EXPERT)
  async activations(
    @Req() req: any,
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
      const expertId = req.user?.userId;

      return await this.expertsService.getExpertActivations(expertId, {
        from,
        to,
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

  // =========================
  // ✅ TAGS (por expert)
  // =========================

  @Get('tags')
  @Roles(UserRole.EXPERT)
  async tags(@Req() req: any) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.listTags(expertId);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Post('tags')
  @Roles(UserRole.EXPERT)
  async createTag(@Req() req: any, @Body() body: any) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.createTag(expertId, body);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Patch('tags/:tagId')
  @Roles(UserRole.EXPERT)
  async updateTag(@Req() req: any, @Param('tagId') tagId: string, @Body() body: any) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.updateTag(expertId, tagId, body);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Delete('tags/:tagId')
  @Roles(UserRole.EXPERT)
  async deleteTag(@Req() req: any, @Param('tagId') tagId: string) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.deleteTag(expertId, tagId);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // ✅ BULK SET (compatível com seu expert-frontend)
  // PUT /expert/leads/:leadKey/tags  body: { tagIds: string[] }
  @Put('leads/:leadKey/tags')
  @Roles(UserRole.EXPERT)
  async setLeadTagsPut(@Req() req: any, @Param('leadKey') leadKey: string, @Body() body: any) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.setLeadTags(expertId, leadKey, body);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  // ✅ opcional: aceita POST também
  // POST /expert/leads/:leadKey/tags  body: { tagIds: string[] }
  @Post('leads/:leadKey/tags')
  @Roles(UserRole.EXPERT)
  async setLeadTagsPost(@Req() req: any, @Param('leadKey') leadKey: string, @Body() body: any) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.setLeadTags(expertId, leadKey, body);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Post('leads/:leadKey/tags/:tagId')
  @Roles(UserRole.EXPERT)
  async addLeadTag(@Req() req: any, @Param('leadKey') leadKey: string, @Param('tagId') tagId: string) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.setLeadTag(expertId, leadKey, tagId, true);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }

  @Delete('leads/:leadKey/tags/:tagId')
  @Roles(UserRole.EXPERT)
  async removeLeadTag(@Req() req: any, @Param('leadKey') leadKey: string, @Param('tagId') tagId: string) {
    try {
      const expertId = req.user?.userId;
      return await this.expertsService.setLeadTag(expertId, leadKey, tagId, false);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Invalid request');
    }
  }
}
