import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  fotoUrl: string | null;
  criadoEm: Date;
};

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureAdminUser();
  }

  private async ensureAdminUser() {
    const count = await this.prisma.usuario.count();
    if (count > 0) return;

    const email =
      this.config.get<string>('AUTH_ADMIN_EMAIL') || 'admin@alar.com.br';
    const password =
      this.config.get<string>('AUTH_ADMIN_PASSWORD') || 'admin123';
    const nome = this.config.get<string>('AUTH_ADMIN_NOME') || 'Administrador';

    const senhaHash = await bcrypt.hash(password, 10);
    const usuario = await this.prisma.usuario.create({
      data: { nome, email, senhaHash },
    });

    await this.prisma.preferencia.upsert({
      where: { usuarioId: usuario.id },
      create: { usuarioId: usuario.id, nome, email },
      update: { nome, email },
    });
  }

  private toAuthUser(usuario: {
    id: string;
    nome: string;
    email: string;
    fotoUrl: string | null;
    criadoEm: Date;
  }): AuthUser {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      fotoUrl: usuario.fotoUrl,
      criadoEm: usuario.criadoEm,
    };
  }

  private signToken(user: AuthUser) {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
    });
  }

  async register(dados: { nome: string; email: string; senha: string }) {
    const email = dados.email.trim().toLowerCase();
    const existing = await this.prisma.usuario.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const senhaHash = await bcrypt.hash(dados.senha, 10);
    const usuario = await this.prisma.usuario.create({
      data: {
        nome: dados.nome.trim(),
        email,
        senhaHash,
      },
    });

    await this.prisma.preferencia.create({
      data: {
        usuarioId: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
    });

    const user = this.toAuthUser(usuario);
    return {
      access_token: this.signToken(user),
      user,
    };
  }

  async login(dados: { email: string; senha: string }) {
    const email = dados.email.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(dados.senha, usuario.senhaHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const user = this.toAuthUser(usuario);
    return {
      access_token: this.signToken(user),
      user,
    };
  }

  async me(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });
    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return this.toAuthUser(usuario);
  }
}
