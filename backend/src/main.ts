import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

function parseCorsOrigins(): string[] {
  // Se você setar CORS_ORIGINS na VPS, isso vira a fonte principal.
  // Ex: CORS_ORIGINS=https://expert.barretao.space,https://adminexpert.barretao.space
  const fromEnv = process.env.CORS_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (fromEnv && fromEnv.length > 0) return fromEnv;

  // Fallback (dev + produção) caso você NÃO use env:
  return [
    'http://localhost:3002', // admin-frontend (dev)
    'http://localhost:3003', // expert-frontend (dev)
    'https://expert.barretao.space',
    'https://adminexpert.barretao.space',
  ];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // importante quando está atrás de proxy (Traefik), ajuda em cookies/secure e IP real
  app.set('trust proxy', 1);

  const allowedOrigins = parseCorsOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      // Alguns clients (healthchecks, curl, server-to-server) podem não mandar Origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // servir uploads
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
}

bootstrap();
