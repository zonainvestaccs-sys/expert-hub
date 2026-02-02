import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AppointmentsService } from '../../appointments/appointments.service';
import { CreateAdminAppointmentDto } from './dto/create-admin-appointment.dto';

type ListArgs = {
  from: string;
  to: string;
  expertId?: string; // 'ALL' | <id>
};

function toDateStrict(iso: string, label: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${label} inválido`);
  return d;
}

@Injectable()
export class AdminCronogramasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointments: AppointmentsService,
  ) {}

  async list(args: ListArgs) {
    const from = toDateStrict(args.from, 'from');
    const to = toDateStrict(args.to, 'to');

    if (to.getTime() <= from.getTime()) {
      throw new BadRequestException('to deve ser maior que from');
    }

    const expertId = args.expertId && args.expertId !== 'ALL' ? args.expertId : undefined;

    const items = await this.prisma.appointment.findMany({
      where: {
        ...(expertId ? { expertId } : {}),
        startAt: { gte: from, lt: to },
      },
      include: {
        expert: {
          select: {
            id: true,
            email: true,
            photoUrl: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    // ✅ Retorna FLAT (igual seu frontend espera: expertEmail/expertPhotoUrl)
    return (items || []).map((it) => ({
      id: it.id,
      expertId: it.expertId,
      expertEmail: it.expert?.email ?? '',
      expertPhotoUrl: it.expert?.photoUrl ?? null,
      expertIsActive: it.expert?.isActive ?? true,

      title: it.title,
      description: it.description ?? null,
      location: it.location ?? null,
      startAt: it.startAt.toISOString(),
      endAt: it.endAt ? it.endAt.toISOString() : null,
      allDay: it.allDay,
      color: it.color ?? null,

      seriesId: (it as any).seriesId ?? null,
      occurrenceIndex: (it as any).occurrenceIndex ?? null,
      isException: (it as any).isException ?? false,
    }));
  }

  async create(dto: CreateAdminAppointmentDto) {
    const expertId = String(dto.expertId || '').trim();
    if (!expertId) throw new BadRequestException('expertId obrigatório');

    const expert = await this.prisma.user.findUnique({
      where: { id: expertId },
      select: { id: true, role: true, isActive: true, email: true, photoUrl: true },
    });

    if (!expert) throw new NotFoundException('Expert não encontrado');
    if (expert.role !== 'EXPERT') throw new BadRequestException('expertId não pertence a um EXPERT');

    // ✅ Reusa a lógica completa (inclui recorrência) do AppointmentsService
    const { expertId: _ignore, ...rest } = dto as any;
    return this.appointments.create(expertId, rest);
  }
}
