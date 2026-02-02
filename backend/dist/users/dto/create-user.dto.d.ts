import { UserRole } from '@prisma/client';
export declare class CreateUserDto {
    email: string;
    password: string;
    role: UserRole;
    expertId?: string;
}
