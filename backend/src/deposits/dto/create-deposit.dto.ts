import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { $Enums } from '@prisma/client';

export class CreateDepositDto {
  @IsString()
  expertId: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum($Enums.DepositStatus)
  status?: $Enums.DepositStatus;

  @IsOptional()
  @IsString()
  providerTxId?: string;
}
