import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
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

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

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
      data: { senhaHash: 'hash-novo' },
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
    );

    await expect(
      service.verifyTwoFactorLogin('bad', '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
