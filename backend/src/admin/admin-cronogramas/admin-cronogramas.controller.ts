import { Body, Controller, Get, Post, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminCronogramasService } from './admin-cronogramas.service';
import { CreateAdminAppointmentDto } from './dto/create-admin-appointment.dto';

@Controller('admin/cronogramas')
@UseGuards(AuthGuard('jwt'))
export class AdminCronogramasController {
  constructor(private readonly service: AdminCronogramasService) {}

  private assertAdmin(req: any) {
    if (req?.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Acesso negado');
    }
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('expertId') expertId?: string, // 'ALL' | <id>
  ) {
    this.assertAdmin(req);

    // frontend sempre deve mandar from/to
    if (!from || !to) return [];

    return this.service.list({ from, to, expertId });
  }

  // ✅ Admin cria agendamento para um expert específico
  @Post()
  async create(@Req() req: any, @Body() dto: CreateAdminAppointmentDto) {
    this.assertAdmin(req);
    return this.service.create(dto);
  }
}
