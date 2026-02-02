import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
export declare class AuthController {
    private readonly authService;
    private readonly prisma;
    constructor(authService: AuthService, prisma: PrismaService);
    login(body: {
        email: string;
        password: string;
    }): Promise<{
        access_token: string;
    }>;
    me(req: any): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        photoUrl: string | null;
    } | null>;
}
