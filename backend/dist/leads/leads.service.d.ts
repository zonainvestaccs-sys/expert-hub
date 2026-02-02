import { PrismaService } from '../prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
export declare class LeadsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateLeadDto): import("@prisma/client").Prisma.Prisma__LeadClient<{
        id: string;
        createdAt: Date;
        expertId: string;
        email: string | null;
        name: string | null;
        phone: string | null;
        source: string | null;
        utmSource: string | null;
        utmMedium: string | null;
        utmCampaign: string | null;
        utmContent: string | null;
        utmTerm: string | null;
        fbclid: string | null;
        externalId: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
