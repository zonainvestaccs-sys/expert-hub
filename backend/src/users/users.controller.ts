import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

function ensureDir(path: string) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  list() {
    return this.usersService.list();
  }

  // ✅ Upload da foto do expert (ADMIN only)
  @Post(':id/photo')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = 'uploads/experts';
          ensureDir(dir);
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const id = req.params.id;
          const ext = extname(file.originalname || '').toLowerCase() || '.jpg';
          cb(null, `${id}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp)$/.test(file.mimetype);
        if (!ok) return cb(new BadRequestException('Arquivo inválido (png/jpg/jpeg/webp)'), false);
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadPhoto(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Envie um arquivo no campo "file"');

    const photoUrl = `/uploads/experts/${file.filename}`;
    return this.usersService.setPhoto(id, photoUrl);
  }
}
