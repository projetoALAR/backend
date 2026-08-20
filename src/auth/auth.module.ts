import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { resolveJwtSecret } from './jwt-secret';
import { PrismaService } from '../prisma.service';
import { DocumentosModule } from '../documentos/documentos.module';
import { EquipeModule } from '../equipe/equipe.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { LoginLockoutService } from './login-lockout.service';
import { TotpService } from './totp.service';

@Module({
  imports: [
    DocumentosModule,
    EquipeModule,
    NotificacoesModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ||
            '7d') as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PrismaService,
    LoginLockoutService,
    TotpService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
