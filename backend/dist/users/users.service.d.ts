import { PrismaService } from '../prisma.service';
type CreateUserInput = {
    email: string;
    password: string;
    role: 'ADMIN' | 'EXPERT';
};
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(input: CreateUserInput): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        photoUrl: string | null;
    }>;
    list(): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        photoUrl: string | null;
    }[]>;
    setPhoto(userId: string, photoUrl: string): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        photoUrl: string | null;
    }>;
}
export {};
