import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLeadDto) {
    // O schema exige a relação `expert` (User) obrigatória
    // então conectamos via relation, em vez de tentar jogar expertId direto.
    return this.prisma.lead.create({
      data: {
        expert: { connect: { id: dto.expertId } },

        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,

        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        utmTerm: dto.utmTerm,

        fbclid: dto.fbclid,
        externalId: dto.externalId,
      },
    });
  }
}
