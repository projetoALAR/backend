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
import { DocumentosService } from '../documentos/documentos.service';
import { EquipeService } from '../equipe/equipe.service';
import { LoginLockoutService } from './login-lockout.service';
import { assertSenhaForte } from './password-policy';

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
    private readonly documentos: DocumentosService,
    private readonly equipe: EquipeService,
    private readonly lockout: LoginLockoutService,
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
    if (!password || !password.trim()) {
      this.logger.warn(
        'Nenhum usuário no banco e AUTH_ADMIN_PASSWORD ausente — admin não foi criado.',
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
    await this.equipe.ensureMembroForUsuario({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: Role.ADMIN,
    });
  }

  private async toAuthUser(usuario: {
    id: string;
    nome: string;
    email: string;
    role: Role;
    fotoUrl: string | null;
    criadoEm: Date;
  }): Promise<AuthUser> {
    const fotoUrl = usuario.fotoUrl
      ? await this.documentos.resolveSignedUrl(usuario.fotoUrl)
      : null;
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      fotoUrl,
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
    assertSenhaForte(dados.senha);

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

    const authUser = await this.toAuthUser(usuario);
    await this.equipe.ensureMembroForUsuario({
      id: authUser.id,
      nome: authUser.nome,
      email: authUser.email,
      role: authUser.role,
    });
    return authUser;
  }

  async login(dados: { email: string; senha: string }) {
    const email = dados.email.trim().toLowerCase();
    this.lockout.assertNotLocked(email);

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      this.lockout.registerFailure(email);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(dados.senha, usuario.senhaHash);
    if (!ok) {
      this.lockout.registerFailure(email);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.lockout.registerSuccess(email);
    const user = await this.toAuthUser(usuario);
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

  async changePassword(userId: string, senhaAtual: string, novaSenha: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });
    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const ok = await bcrypt.compare(senhaAtual, usuario.senhaHash);
    if (!ok) {
      throw new BadRequestException('Senha atual incorreta');
    }

    if (senhaAtual === novaSenha) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    assertSenhaForte(novaSenha);

    await this.prisma.usuario.update({
      where: { id: userId },
      data: { senhaHash: await bcrypt.hash(novaSenha, 10) },
    });

    return { ok: true };
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
    return Promise.all(
      usuarios.map(async (u) => ({
        ...u,
        fotoUrl: u.fotoUrl
          ? await this.documentos.resolveSignedUrl(u.fotoUrl)
          : null,
      })),
    );
  }
}
