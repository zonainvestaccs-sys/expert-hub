import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

type CreateUserInput = {
  email: string;
  password: string;
  role: 'ADMIN' | 'EXPERT';
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateUserInput) {
    const email = input.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email já existe');

    const passwordHash = await bcrypt.hash(input.password, 10);

    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: input.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        photoUrl: true,
      },
    });
  }

  async list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        photoUrl: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setPhoto(userId: string, photoUrl: string) {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        photoUrl: true,
      },
    });
  }
}
