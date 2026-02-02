import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class IngestKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const expected = (process.env.METRICS_INGEST_KEY || '').trim();
    if (!expected) {
      throw new ForbiddenException('METRICS_INGEST_KEY não configurada no .env');
    }

    const provided =
      (req.headers['x-ingest-key'] as string | undefined) ||
      (req.headers['X-INGEST-KEY'] as string | undefined);

    if (!provided || String(provided).trim() !== expected) {
      throw new ForbiddenException('Chave de ingestão inválida');
    }

    return true;
  }
}
