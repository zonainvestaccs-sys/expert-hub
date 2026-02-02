// src/experts/experts.module.ts
import { Module } from '@nestjs/common';
import { ExpertsController } from './experts.controller';
import { AdminExpertsController } from './admin-experts.controller';
import { ExpertsService } from './experts.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ExpertsController, AdminExpertsController],
  providers: [ExpertsService, PrismaService],
  exports: [ExpertsService], // ✅ IMPORTANTE
})
export class ExpertsModule {}
