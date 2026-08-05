import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { Role } from './roles';

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  fotoUrl: string | null;
  criadoEm: Date;
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureAdminUser();
  }

  private isPublicRegisterAllowed(): boolean {
    const raw = (
      this.config.get<string>('AUTH_ALLOW_PUBLIC_REGISTER') || 'false'
    ).toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  private async ensureAdminUser() {
    const count = await this.prisma.usuario.count();
    if (count > 0) return;

    const password = this.config.get<string>('AUTH_ADMIN_PASSWORD');
    if (!password || password.trim().length < 8) {
      this.logger.warn(
        'Nenhum usuário no banco e AUTH_ADMIN_PASSWORD ausente ou com menos de 8 caracteres — admin não foi criado.',
      );
      return;
    }

    const email =
      this.config.get<string>('AUTH_ADMIN_EMAIL') || 'admin@alar.com.br';
    const nome = this.config.get<string>('AUTH_ADMIN_NOME') || 'Administrador';

    const senhaHash = await bcrypt.hash(password, 10);
    const usuario = await this.prisma.usuario.create({
      data: { nome, email, senhaHash, role: Role.ADMIN },
    });

    await this.prisma.preferencia.upsert({
      where: { usuarioId: usuario.id },
      create: { usuarioId: usuario.id, nome, email },
      update: { nome, email },
    });

    this.logger.log(`Usuário admin bootstrap criado: ${email}`);
  }

  private toAuthUser(usuario: {
    id: string;
    nome: string;
    email: string;
    role: Role;
    fotoUrl: string | null;
    criadoEm: Date;
  }): AuthUser {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      fotoUrl: usuario.fotoUrl,
      criadoEm: usuario.criadoEm,
    };
  }

  private signToken(user: AuthUser) {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async register(dados: {
    nome: string;
    email: string;
    senha: string;
    role?: Role;
  }) {
    if (!this.isPublicRegisterAllowed()) {
      throw new ForbiddenException(
        'Cadastro público desabilitado. Peça a um administrador para criar sua conta.',
      );
    }

    const user = await this.createUser({
      nome: dados.nome,
      email: dados.email,
      senha: dados.senha,
      role: Role.ASSISTENTE,
    });

    return {
      access_token: this.signToken(user),
      user,
    };
  }

  async createUserByAdmin(dados: {
    nome: string;
    email: string;
    senha: string;
    role?: Role;
  }) {
    const role = dados.role ?? Role.ASSISTENTE;
    if (!Object.values(Role).includes(role)) {
      throw new BadRequestException('Papel inválido');
    }

    const user = await this.createUser({
      nome: dados.nome,
      email: dados.email,
      senha: dados.senha,
      role,
    });

    return { user };
  }

  private async createUser(dados: {
    nome: string;
    email: string;
    senha: string;
    role: Role;
  }): Promise<AuthUser> {
    const email = dados.email.trim().toLowerCase();
    if (!dados.senha || dados.senha.length < 8) {
      throw new BadRequestException('A senha deve ter pelo menos 8 caracteres');
    }

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
        role: dados.role,
      },
    });

    await this.prisma.preferencia.create({
      data: {
        usuarioId: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
    });

    return this.toAuthUser(usuario);
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

  async listUsers() {
    const usuarios = await this.prisma.usuario.findMany({
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        fotoUrl: true,
        criadoEm: true,
      },
    });
    return usuarios;
  }
}
