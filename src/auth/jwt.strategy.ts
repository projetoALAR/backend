import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { Role } from './roles';
import { resolveJwtSecret } from './jwt-secret';

export type JwtPayload = {
  sub: string;
  email: string;
  role?: Role;
  typ?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.typ === '2fa') {
      throw new UnauthorizedException('Complete o 2FA para acessar');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const {
      senhaHash: _senhaHash,
      totpSecret: _totpSecret,
      totpPendingSecret: _totpPendingSecret,
      totpRecoveryHashes: _totpRecoveryHashes,
      ...user
    } = usuario;
    void _senhaHash;
    void _totpSecret;
    void _totpPendingSecret;
    void _totpRecoveryHashes;
    return user;
  }
}
