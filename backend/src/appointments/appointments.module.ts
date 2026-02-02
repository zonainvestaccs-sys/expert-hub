// src/appointments/appointments.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, PrismaService],
  exports: [AppointmentsService], // ✅ obrigatório para outros módulos injetarem AppointmentsService
})
export class AppointmentsModule {}
