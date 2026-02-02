// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { ExpertsModule } from './experts/experts.module';
import { LeadsModule } from './leads/leads.module';
import { DepositsModule } from './deposits/deposits.module';
import { MetricsModule } from './metrics/metrics.module';
import { IngestModule } from './ingest/ingest.module';
import { StorageModule } from './storage/storage.module';

import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from './notifications/notifications.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AdminCronogramasModule } from './admin/admin-cronogramas/admin-cronogramas.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    AdminModule,
    ExpertsModule,
    LeadsModule,
    DepositsModule,
    MetricsModule,
    IngestModule,
    StorageModule,

    // ✅ TEM QUE CHAMAR
    ScheduleModule.forRoot(),

    // ✅ Notificações
    NotificationsModule,

    // ✅ Cronograma (expert)
    AppointmentsModule,

    // ✅ Cronogramas (admin)
    AdminCronogramasModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
