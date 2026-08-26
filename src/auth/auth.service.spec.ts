import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { DocumentosService } from '../documentos/documentos.service';
import { EquipeService } from '../equipe/equipe.service';
import { Role } from './roles';
import { LoginLockoutService } from './login-lockout.service';
import { TotpService } from './totp.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const notificacoesMock = {
  enviarEmailTransacional: jest.fn().mockResolvedValue(undefined),
  appPublicUrl: jest.fn().mockReturnValue('http://localhost:3000'),
  criarInbox: jest.fn().mockResolvedValue(undefined),
} as unknown as NotificacoesService;

describe('AuthService.changePassword', () => {
  let service: AuthService;
  const prisma = {
    usuario: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const documentos = { resolveSignedUrl: jest.fn() };
  const equipe = { ensureMembroForUsuario: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as JwtService,
      {} as ConfigService,
      documentos as unknown as DocumentosService,
      equipe as unknown as EquipeService,
      new LoginLockoutService(),
      new TotpService(),
      notificacoesMock,

      { assertPodeAdicionarUsuario: jest.fn() } as never,
    );
  });

  it('rejeita senha atual incorreta', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u1',
      senhaHash: 'hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.changePassword('u1', 'errada', 'NovaSenha12'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita nova senha igual à atual', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u1',
      senhaHash: 'hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.changePassword('u1', 'mesma-senha', 'mesma-senha'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('atualiza hash quando senha atual confere', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u1',
      senhaHash: 'hash-antigo',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash-novo');
    prisma.usuario.update.mockResolvedValue({});

    await expect(
      service.changePassword('u1', 'antiga-senha', 'NovaSenha12'),
    ).resolves.toEqual({ ok: true });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        senhaHash: 'hash-novo',
        mustChangePassword: false,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  });

  it('falha se usuário não existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword('missing', 'a', 'NovaSenha12'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.createUserByAdmin', () => {
  it('sincroniza membro na equipe após criar usuário', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'u2',
          nome: 'Ana',
          email: 'ana@alar.com.br',
          role: Role.ASSISTENTE,
          fotoUrl: null,
          criadoEm: new Date(),
          senhaHash: 'x',
        }),
      },
      preferencia: { create: jest.fn() },
    };
    const documentos = {
      resolveSignedUrl: jest.fn(),
    };
    const equipe = {
      ensureMembroForUsuario: jest.fn().mockResolvedValue({}),
    };

    (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

    const service = new AuthService(
      prisma as unknown as PrismaService,
      { sign: jest.fn() } as unknown as JwtService,
      {} as ConfigService,
      documentos as unknown as DocumentosService,
      equipe as unknown as EquipeService,
      new LoginLockoutService(),
      new TotpService(),
      notificacoesMock,

      { assertPodeAdicionarUsuario: jest.fn() } as never,
    );

    const result = await service.createUserByAdmin({
      nome: 'Ana',
      email: 'ana@alar.com.br',
      senha: 'AlarSenha1x',
      role: Role.ASSISTENTE,
    });

    expect(result.user.email).toBe('ana@alar.com.br');
    expect(equipe.ensureMembroForUsuario).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'u2',
        email: 'ana@alar.com.br',
        role: Role.ASSISTENTE,
      }),
    );
  });
});

describe('AuthService.login lockout', () => {
  it('bloqueia após 5 senhas erradas', async () => {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          nome: 'Ana',
          email: 'ana@alar.com.br',
          senhaHash: 'hash',
          role: Role.ASSISTENTE,
          fotoUrl: null,
          criadoEm: new Date(),
        }),
      },
    };
    const lockout = new LoginLockoutService();
    const service = new AuthService(
      prisma as unknown as PrismaService,
      { sign: jest.fn() } as unknown as JwtService,
      {} as ConfigService,
      { resolveSignedUrl: jest.fn() } as unknown as DocumentosService,
      { ensureMembroForUsuario: jest.fn() } as unknown as EquipeService,
      lockout,
      new TotpService(),
      notificacoesMock,

      { assertPodeAdicionarUsuario: jest.fn() } as never,
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    for (let i = 0; i < 5; i++) {
      await expect(
        service.login({ email: 'ana@alar.com.br', senha: 'errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    await expect(
      service.login({ email: 'ana@alar.com.br', senha: 'errada' }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});

describe('AuthService.login 2FA', () => {
  it('pede 2FA quando admin tem TOTP ativo', async () => {
    const sign = jest.fn().mockReturnValue('pre-2fa');
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          nome: 'Admin',
          email: 'admin@alar.com.br',
          senhaHash: 'hash',
          role: Role.ADMIN,
          fotoUrl: null,
          totpEnabled: true,
          totpSecret: 'SECRET',
          criadoEm: new Date(),
        }),
      },
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      { sign } as unknown as JwtService,
      {} as ConfigService,
      { resolveSignedUrl: jest.fn() } as unknown as DocumentosService,
      { ensureMembroForUsuario: jest.fn() } as unknown as EquipeService,
      new LoginLockoutService(),
      new TotpService(),
      notificacoesMock,

      { assertPodeAdicionarUsuario: jest.fn() } as never,
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({ email: 'admin@alar.com.br', senha: 'ok' }),
    ).resolves.toEqual({
      requires2fa: true,
      preAuthToken: 'pre-2fa',
    });
    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({ typ: '2fa', sub: 'u1' }),
      { expiresIn: '5m' },
    );
  });

  it('pede 2FA quando advogado tem TOTP ativo', async () => {
    const sign = jest.fn().mockReturnValue('pre-2fa');
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u2',
          nome: 'Ana',
          email: 'ana@alar.com.br',
          senhaHash: 'hash',
          role: Role.ADVOGADO,
          fotoUrl: null,
          totpEnabled: true,
          totpSecret: 'SECRET',
          criadoEm: new Date(),
        }),
      },
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      { sign } as unknown as JwtService,
      {} as ConfigService,
      { resolveSignedUrl: jest.fn() } as unknown as DocumentosService,
      { ensureMembroForUsuario: jest.fn() } as unknown as EquipeService,
      new LoginLockoutService(),
      new TotpService(),
      notificacoesMock,

      { assertPodeAdicionarUsuario: jest.fn() } as never,
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({ email: 'ana@alar.com.br', senha: 'ok' }),
    ).resolves.toEqual({
      requires2fa: true,
      preAuthToken: 'pre-2fa',
    });
  });

  it('rejeita token 2FA inválido', async () => {
    const service = new AuthService(
      {} as PrismaService,
      {
        verify: jest.fn(() => {
          throw new Error('jwt malformed');
        }),
      } as unknown as JwtService,
      {} as ConfigService,
      { resolveSignedUrl: jest.fn() } as unknown as DocumentosService,
      { ensureMembroForUsuario: jest.fn() } as unknown as EquipeService,
      new LoginLockoutService(),
      new TotpService(),
      notificacoesMock,

      { assertPodeAdicionarUsuario: jest.fn() } as never,
    );

    await expect(
      service.verifyTwoFactorLogin('bad', '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('advogado com 2FA ativo consegue concluir o login (não é restrito a admin)', async () => {
    const verify = jest.fn().mockReturnValue({
      sub: 'u2',
      email: 'ana@alar.com.br',
      typ: '2fa',
    });
    const sign = jest.fn().mockReturnValue('access-token');
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u2',
          nome: 'Ana',
          email: 'ana@alar.com.br',
          senhaHash: 'hash',
          role: Role.ADVOGADO,
          fotoUrl: null,
          totpEnabled: true,
          totpSecret: 'SECRET',
          totpRecoveryHashes: [],
          criadoEm: new Date(),
        }),
      },
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      { verify, sign } as unknown as JwtService,
      {} as ConfigService,
      { resolveSignedUrl: jest.fn() } as unknown as DocumentosService,
      { ensureMembroForUsuario: jest.fn() } as unknown as EquipeService,
      new LoginLockoutService(),
      { verifyCode: jest.fn().mockReturnValue(true) } as unknown as TotpService,
      notificacoesMock,

      { assertPodeAdicionarUsuario: jest.fn() } as never,
    );

    await expect(
      service.verifyTwoFactorLogin('pre-2fa', '123456'),
    ).resolves.toEqual({
      access_token: 'access-token',
      user: expect.objectContaining({ id: 'u2', role: Role.ADVOGADO }),
    });
  });
});

describe('AuthService 2FA setup', () => {
  const prisma = {
    usuario: { findUnique: jest.fn() },
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    {} as JwtService,
    {} as ConfigService,
    { resolveSignedUrl: jest.fn() } as unknown as DocumentosService,
    { ensureMembroForUsuario: jest.fn() } as unknown as EquipeService,
    new LoginLockoutService(),
    new TotpService(),
    notificacoesMock,

    { assertPodeAdicionarUsuario: jest.fn() } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('libera status 2FA para advogado', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u2',
      role: Role.ADVOGADO,
      totpEnabled: false,
    });
    await expect(service.twoFactorStatus('u2')).resolves.toEqual({
      enabled: false,
    });
  });

  it('bloqueia setup 2FA para assistente', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u3',
      role: Role.ASSISTENTE,
      totpEnabled: false,
    });
    await expect(service.setupTwoFactor('u3')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('AuthService.adminDisableTwoFactor', () => {
  const prisma = {
    usuario: { findUnique: jest.fn(), update: jest.fn() },
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    {} as JwtService,
    {} as ConfigService,
    { resolveSignedUrl: jest.fn() } as unknown as DocumentosService,
    { ensureMembroForUsuario: jest.fn() } as unknown as EquipeService,
    new LoginLockoutService(),
    new TotpService(),
    notificacoesMock,

    { assertPodeAdicionarUsuario: jest.fn() } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('admin desativa 2FA de outro usuário sem exigir senha/código', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u2',
      role: Role.ADVOGADO,
      totpEnabled: true,
      totpSecret: 'SECRET',
      totpRecoveryHashes: ['hash1'],
    });
    prisma.usuario.update.mockResolvedValue({});

    await expect(service.adminDisableTwoFactor('u2')).resolves.toEqual({
      ok: true,
    });
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: {
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabled: false,
        totpRecoveryHashes: [],
      },
    });
  });

  it('falha se o usuário alvo não existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(
      service.adminDisableTwoFactor('inexistente'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('falha se o usuário alvo não tem 2FA ativo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u3',
      role: Role.ADVOGADO,
      totpEnabled: false,
    });
    await expect(service.adminDisableTwoFactor('u3')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('AuthService admin senha', () => {
  const prisma = {
    usuario: { findUnique: jest.fn(), update: jest.fn() },
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    {} as JwtService,
    {} as ConfigService,
    { resolveSignedUrl: jest.fn() } as unknown as DocumentosService,
    { ensureMembroForUsuario: jest.fn() } as unknown as EquipeService,
    new LoginLockoutService(),
    new TotpService(),
    notificacoesMock,

    { assertPodeAdicionarUsuario: jest.fn() } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('adminEnviarLinkReset marca troca e envia e-mail', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u2',
      nome: 'Ana',
      email: 'ana@alar.com.br',
    });
    prisma.usuario.update.mockResolvedValue({});
    ;(
      notificacoesMock.enviarEmailTransacional as jest.Mock
    ).mockResolvedValue({ queuedInboxOnly: true, devPreviewLink: 'http://x' });

    const result = await service.adminEnviarLinkReset('u2');
    expect(result.ok).toBe(true);
    expect(result.devResetLink).toBe('http://x');
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u2' },
        data: expect.objectContaining({ mustChangePassword: true }),
      }),
    );
  });

  it('adminDefinirSenhaTemporaria atualiza hash e convite', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u2',
      nome: 'Ana',
      email: 'ana@alar.com.br',
    });
    prisma.usuario.update.mockResolvedValue({});
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hash-novo');

    await expect(
      service.adminDefinirSenhaTemporaria('u2', 'AlarTrocar123'),
    ).resolves.toEqual({ ok: true });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: expect.objectContaining({
        senhaHash: 'hash-novo',
        mustChangePassword: true,
      }),
    });
    expect(notificacoesMock.enviarEmailTransacional).toHaveBeenCalled();
  });
});

describe('AuthService forgot/reset password', () => {
  const prisma = {
    usuario: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    {} as JwtService,
    {} as ConfigService,
    { resolveSignedUrl: jest.fn() } as unknown as DocumentosService,
    { ensureMembroForUsuario: jest.fn() } as unknown as EquipeService,
    new LoginLockoutService(),
    new TotpService(),
    notificacoesMock,

    { assertPodeAdicionarUsuario: jest.fn() } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('forgotPassword não revela e-mail inexistente', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(service.forgotPassword('x@alar.com.br')).resolves.toEqual({
      ok: true,
    });
    expect(notificacoesMock.enviarEmailTransacional).not.toHaveBeenCalled();
  });

  it('forgotPassword grava token e envia e-mail', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u1',
      nome: 'Ana',
      email: 'ana@alar.com.br',
    });
    prisma.usuario.update.mockResolvedValue({});
    ;(
      notificacoesMock.enviarEmailTransacional as jest.Mock
    ).mockResolvedValue({ queuedInboxOnly: true });

    await expect(service.forgotPassword('ana@alar.com.br')).resolves.toEqual({
      ok: true,
    });
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetExpires: expect.any(Date),
        }),
      }),
    );
    expect(notificacoesMock.enviarEmailTransacional).toHaveBeenCalled();
  });

  it('resetPassword rejeita token inválido', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(
      service.resetPassword('token-inexistente-com-20c', 'AlarNovaSenha1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resetPassword atualiza hash e limpa flag', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.usuario.update.mockResolvedValue({});
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('hash-reset');

    await expect(
      service.resetPassword('token-valido-com-20chars!', 'AlarNovaSenha1'),
    ).resolves.toEqual({ ok: true });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        senhaHash: 'hash-reset',
        mustChangePassword: false,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  });
});
