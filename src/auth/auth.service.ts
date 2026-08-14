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
import { TotpService } from './totp.service';

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  fotoUrl: string | null;
  criadoEm: Date;
  totpEnabled: boolean;
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
    private readonly totp: TotpService,
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
    totpEnabled?: boolean;
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
      totpEnabled: !!usuario.totpEnabled,
    };
  }

  private signToken(user: AuthUser) {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private signPre2faToken(user: { id: string; email: string; role: Role }) {
    return this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        typ: '2fa',
      },
      { expiresIn: '5m' },
    );
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

    if (usuario.totpEnabled) {
      return {
        requires2fa: true as const,
        preAuthToken: this.signPre2faToken(usuario),
      };
    }

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

  async twoFactorStatus(userId: string) {
    const usuario = await this.requireTotpEligible(userId);
    return { enabled: !!usuario.totpEnabled };
  }

  async setupTwoFactor(userId: string) {
    const usuario = await this.requireTotpEligible(userId);
    const secret = this.totp.createSecret();
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { totpPendingSecret: secret },
    });
    const otpauthUrl = this.totp.otpauthUrl(usuario.email, secret);
    return {
      secret,
      otpauthUrl,
      qrDataUrl: await this.totp.qrDataUrl(otpauthUrl),
    };
  }

  async enableTwoFactor(userId: string, code: string) {
    const usuario = await this.requireTotpEligible(userId);
    const pending = usuario.totpPendingSecret;
    if (!pending) {
      throw new BadRequestException(
        'Gere um QR Code antes de confirmar o 2FA.',
      );
    }
    if (!this.totp.verifyCode(pending, code, usuario.email)) {
      throw new BadRequestException('Código 2FA inválido');
    }

    const recoveryCodes = this.totp.generateRecoveryCodes();
    const totpRecoveryHashes = await this.totp.hashRecoveryCodes(recoveryCodes);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        totpSecret: pending,
        totpPendingSecret: null,
        totpEnabled: true,
        totpRecoveryHashes,
      },
    });

    return { ok: true, recoveryCodes };
  }

  async disableTwoFactor(userId: string, senha: string, code: string) {
    const usuario = await this.requireTotpEligible(userId);
    if (!usuario.totpEnabled || !usuario.totpSecret) {
      throw new BadRequestException('2FA não está ativo nesta conta');
    }

    const senhaOk = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaOk) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const totpOk = this.totp.verifyCode(
      usuario.totpSecret,
      code,
      usuario.email,
    );
    const remaining = totpOk
      ? usuario.totpRecoveryHashes
      : await this.totp.consumeRecoveryCode(usuario.totpRecoveryHashes, code);
    if (!totpOk && remaining === null) {
      throw new BadRequestException('Código 2FA inválido');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabled: false,
        totpRecoveryHashes: [],
      },
    });

    return { ok: true };
  }

  /** Via de suporte/recuperação: ADMIN desativa o 2FA de outro usuário sem senha/código. */
  async adminDisableTwoFactor(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });
    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    if (!usuario.totpEnabled) {
      throw new BadRequestException('2FA não está ativo nesta conta');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabled: false,
        totpRecoveryHashes: [],
      },
    });

    return { ok: true };
  }

  async verifyTwoFactorLogin(preAuthToken: string, code: string) {
    let payload: { sub?: string; email?: string; typ?: string };
    try {
      payload = this.jwt.verify(preAuthToken);
    } catch {
      throw new UnauthorizedException('Sessão 2FA expirada. Entre de novo.');
    }

    if (payload.typ !== '2fa' || !payload.sub || !payload.email) {
      throw new UnauthorizedException('Token 2FA inválido');
    }

    const email = payload.email.trim().toLowerCase();
    this.lockout.assertNotLocked(email);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });
    if (
      !usuario ||
      usuario.email !== email ||
      (usuario.role !== Role.ADMIN && usuario.role !== Role.ADVOGADO) ||
      !usuario.totpEnabled ||
      !usuario.totpSecret
    ) {
      this.lockout.registerFailure(email);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const totpOk = this.totp.verifyCode(
      usuario.totpSecret,
      code,
      usuario.email,
    );
    let recoveryHashes = usuario.totpRecoveryHashes;
    if (!totpOk) {
      const remaining = await this.totp.consumeRecoveryCode(
        recoveryHashes,
        code,
      );
      if (remaining === null) {
        this.lockout.registerFailure(email);
        throw new UnauthorizedException('Código 2FA inválido');
      }
      recoveryHashes = remaining;
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { totpRecoveryHashes: recoveryHashes },
      });
    }

    this.lockout.registerSuccess(email);
    const user = await this.toAuthUser(usuario);
    return {
      access_token: this.signToken(user),
      user,
    };
  }

  private async requireTotpEligible(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });
    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    if (usuario.role !== Role.ADMIN && usuario.role !== Role.ADVOGADO) {
      throw new ForbiddenException(
        '2FA está disponível para administradores e advogados',
      );
    }
    return usuario;
  }
}
