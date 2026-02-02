import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private prisma;
    private jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
    login(email: string, password: string): Promise<{
        access_token: string;
    }>;
    me(userId: string): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        photoUrl: string | null;
    }>;
}
