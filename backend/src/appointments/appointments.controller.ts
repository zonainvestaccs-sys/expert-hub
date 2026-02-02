import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AuthGuard } from '@nestjs/passport';

type Scope = 'single' | 'series' | 'future';

function parseScope(scope?: string): Scope {
  if (scope === 'series') return 'series';
  if (scope === 'future') return 'future';
  return 'single';
}

function parseDateStrict(v: string, label: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${label} inválido`);
  return d;
}

@Controller('appointments')
@UseGuards(AuthGuard('jwt'))
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  private getExpertId(req: any) {
    // JwtStrategy retorna { userId, role }
    const id = req?.user?.userId;
    if (!id) throw new BadRequestException('Usuário inválido');
    return id;
  }

  @Get()
  async list(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const expertId = this.getExpertId(req);

    // Mantém compatível com o frontend (quando ainda não tem range)
    if (!from || !to) return [];

    const fromDate = parseDateStrict(from, 'from');
    const toDate = parseDateStrict(to, 'to');

    if (toDate.getTime() <= fromDate.getTime()) {
      throw new BadRequestException('to deve ser maior que from');
    }

    return this.service.list(expertId, { from: fromDate, to: toDate });
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateAppointmentDto) {
    const expertId = this.getExpertId(req);
    return this.service.create(expertId, dto);
  }

  // scope: single | future | series
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @Query('scope') scope?: string,
  ) {
    const expertId = this.getExpertId(req);
    return this.service.update(expertId, id, dto, parseScope(scope));
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string, @Query('scope') scope?: string) {
    const expertId = this.getExpertId(req);
    return this.service.remove(expertId, id, parseScope(scope));
  }
}
