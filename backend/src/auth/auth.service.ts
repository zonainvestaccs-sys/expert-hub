import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    return {
      access_token: this.jwt.sign({ sub: user.id, role: user.role }),
    };
  }

  /**
   * ✅ Retorna dados do user logado pro front
   */
  async me(userId: string) {
    if (!userId) throw new UnauthorizedException('Token inválido');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        photoUrl: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo ou inexistente');
    }

    return user;
  }
}
