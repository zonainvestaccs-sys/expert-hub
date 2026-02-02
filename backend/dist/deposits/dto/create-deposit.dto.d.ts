import { $Enums } from '@prisma/client';
export declare class CreateDepositDto {
    expertId: string;
    amountCents: number;
    currency?: string;
    status?: $Enums.DepositStatus;
    providerTxId?: string;
}
