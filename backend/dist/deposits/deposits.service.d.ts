import { PrismaService } from '../prisma.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
export declare class DepositsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateDepositDto): import("@prisma/client").Prisma.Prisma__DepositClient<{
        id: string;
        createdAt: Date;
        expertId: string;
        amountCents: number;
        currency: string;
        status: import("@prisma/client").$Enums.DepositStatus;
        providerTxId: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
