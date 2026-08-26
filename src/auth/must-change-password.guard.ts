import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Se mustChangePassword=true, só permite me / change-password / logout
 * até a senha ser trocada.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      user?: { mustChangePassword?: boolean };
      method?: string;
      url?: string;
      originalUrl?: string;
    }>();

    if (!req.user?.mustChangePassword) return true;

    const method = (req.method || 'GET').toUpperCase();
    const url = `${req.originalUrl || req.url || ''}`.split('?')[0];

    const allowed =
      (method === 'GET' && /\/auth\/me\/?$/.test(url)) ||
      (method === 'POST' && /\/auth\/change-password\/?$/.test(url)) ||
      (method === 'POST' && /\/auth\/logout\/?$/.test(url));

    if (!allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'É necessário trocar a senha antes de continuar.',
        code: 'MUST_CHANGE_PASSWORD',
      });
    }
    return true;
  }
}
