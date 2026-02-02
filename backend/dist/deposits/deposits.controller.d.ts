import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
export declare class DepositsController {
    private readonly depositsService;
    constructor(depositsService: DepositsService);
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
