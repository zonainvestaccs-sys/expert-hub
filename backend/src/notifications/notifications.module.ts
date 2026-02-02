// src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ExpertsModule } from '../experts/experts.module';

import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsScheduler } from './notifications.scheduler';

import { AdminNotificationsController } from './notifications.admin.controller';
import { ExpertNotificationsController } from './notifications.expert.controller';
import { NotificationsTestController } from './notifications.test.controller';

@Module({
  imports: [
    AuthModule,
    ExpertsModule, // ✅ precisa disso (Scheduler injeta ExpertsService)
  ],
  controllers: [
    AdminNotificationsController,
    ExpertNotificationsController,
    NotificationsTestController,
  ],
  providers: [
    PrismaService,
    NotificationsGateway,
    NotificationsService,
    NotificationsScheduler, // ✅ sem isso o cron NÃO roda
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
