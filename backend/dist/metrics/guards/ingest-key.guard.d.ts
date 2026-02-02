import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class IngestKeyGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
