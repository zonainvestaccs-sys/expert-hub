import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(body: CreateUserDto): Promise<{
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
    uploadPhoto(id: string, file?: Express.Multer.File): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        role: import("@prisma/client").$Enums.UserRole;
        isActive: boolean;
        photoUrl: string | null;
    }>;
}
