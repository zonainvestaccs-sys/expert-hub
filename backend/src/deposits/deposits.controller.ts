import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Controller('deposits')
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateDepositDto) {
    return this.depositsService.create(dto);
  }
}
