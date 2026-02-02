import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Injectable()
export class DepositsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDepositDto) {
    return this.prisma.deposit.create({
      data: {
        expertId: dto.expertId,
        amountCents: dto.amountCents,
        currency: dto.currency ?? 'BRL',
        status: dto.status ?? 'CONFIRMED',
        providerTxId: dto.providerTxId,
      },
    });
  }
}
