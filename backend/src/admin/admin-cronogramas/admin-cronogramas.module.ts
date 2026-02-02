import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AppointmentsModule } from '../../appointments/appointments.module';
import { AdminCronogramasController } from './admin-cronogramas.controller';
import { AdminCronogramasService } from './admin-cronogramas.service';

@Module({
  imports: [AppointmentsModule],
  controllers: [AdminCronogramasController],
  providers: [AdminCronogramasService, PrismaService],
})
export class AdminCronogramasModule {}
