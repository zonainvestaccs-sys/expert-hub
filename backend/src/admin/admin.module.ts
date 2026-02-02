import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma.service';
import { ExpertsModule } from '../experts/experts.module';
import { AdminCronogramasModule } from './admin-cronogramas/admin-cronogramas.module';

@Module({
  imports: [
    ExpertsModule,
    AdminCronogramasModule, // ✅ IMPORTANTE
  ],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
})
export class AdminModule {}
