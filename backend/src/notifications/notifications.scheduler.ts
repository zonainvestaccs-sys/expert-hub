import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpertsService } from '../experts/experts.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsScheduler {
  constructor(
    private readonly expertsService: ExpertsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  // a cada minuto
  @Cron('* * * * *')
  async tick() {
    const { actions } = await this.expertsService.runNotificationsTickNow();

    for (const a of actions) {
      const res = await this.expertsService.createActivationNotificationIfNeeded({
        expertId: a.expertId,
        dateIso: a.dateIso,
        hhmm: a.hhmm,
        fresh: true,
      });

      // se criou, empurra pro expert em tempo real
      const created = (res as any)?.created;
      if (created?.id) {
        // ✅ evento padrão já é "notification"
        this.gateway.emitToExpert(a.expertId, created);

        // ✅ evento de unread separado
        this.gateway.emitUnreadToExpert(a.expertId, { bump: 1 });
        // (ou: this.gateway.emitEventToExpert(a.expertId, 'notification:unread', { bump: 1 });)
      }
    }
  }
}
