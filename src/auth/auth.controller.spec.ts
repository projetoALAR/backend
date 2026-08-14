import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Role } from './roles';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    me: jest.fn(),
    changePassword: jest.fn(),
    listUsers: jest.fn(),
    createUserByAdmin: jest.fn(),
    verifyTwoFactorLogin: jest.fn(),
    twoFactorStatus: jest.fn(),
    setupTwoFactor: jest.fn(),
    enableTwoFactor: jest.fn(),
    disableTwoFactor: jest.fn(),
    adminDisableTwoFactor: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: AuditoriaService,
          useValue: { registrar: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    controller = module.get(AuthController);
  });

  it('login delega ao AuthService', async () => {
    authService.login.mockResolvedValue({ accessToken: 't' });
    await expect(
      controller.login({ email: 'a@alar.com.br', senha: 'senha1234' }),
    ).resolves.toEqual({ accessToken: 't' });
    expect(authService.login).toHaveBeenCalledWith({
      email: 'a@alar.com.br',
      senha: 'senha1234',
    });
  });

  it('me usa o id do usuário autenticado', async () => {
    authService.me.mockResolvedValue({ id: 'u1', role: Role.ADMIN });
    await expect(controller.me({ id: 'u1' })).resolves.toEqual({
      id: 'u1',
      role: Role.ADMIN,
    });
    expect(authService.me).toHaveBeenCalledWith('u1');
  });

  it('changePassword encaminha senhas', async () => {
    authService.changePassword.mockResolvedValue({ ok: true });
    await expect(
      controller.changePassword(
        { id: 'u1' },
        { senhaAtual: 'antiga', novaSenha: 'nova-senha' },
      ),
    ).resolves.toEqual({ ok: true });
    expect(authService.changePassword).toHaveBeenCalledWith(
      'u1',
      'antiga',
      'nova-senha',
    );
  });

  it('logout retorna ok', () => {
    expect(controller.logout()).toEqual({ ok: true });
  });

  it('createUser e listUsers delegam (admin)', async () => {
    authService.listUsers.mockResolvedValue([]);
    authService.createUserByAdmin.mockResolvedValue({
      user: { id: 'u2', nome: 'Bob', email: 'bob@alar.com.br' },
    });
    await expect(controller.listUsers()).resolves.toEqual([]);
    await expect(
      controller.createUser(
        {
          nome: 'Bob',
          email: 'bob@alar.com.br',
          senha: 'senha1234',
          role: Role.ASSISTENTE,
        },
        { id: 'admin', nome: 'Admin', email: 'admin@alar.com.br' },
      ),
    ).resolves.toEqual({
      user: { id: 'u2', nome: 'Bob', email: 'bob@alar.com.br' },
    });
  });

  it('verifyTwoFactor encaminha token e código', async () => {
    authService.verifyTwoFactorLogin.mockResolvedValue({ access_token: 't' });
    await expect(
      controller.verifyTwoFactor({
        preAuthToken: 'pre',
        code: '123456',
      }),
    ).resolves.toEqual({ access_token: 't' });
    expect(authService.verifyTwoFactorLogin).toHaveBeenCalledWith(
      'pre',
      '123456',
    );
  });

  describe('gerenciamento próprio de 2FA', () => {
    const advogado = {
      id: 'adv1',
      role: Role.ADVOGADO,
      nome: 'Ana Advogada',
      email: 'ana@alar.com.br',
    };

    it('advogado consegue gerar o QR de setup do próprio 2FA', async () => {
      authService.setupTwoFactor.mockResolvedValue({
        secret: 'SECRET',
        otpauthUrl: 'otpauth://...',
        qrDataUrl: 'data:image/png;base64,...',
      });

      await expect(
        controller.setupTwoFactor({ id: advogado.id }),
      ).resolves.toEqual({
        secret: 'SECRET',
        otpauthUrl: 'otpauth://...',
        qrDataUrl: 'data:image/png;base64,...',
      });
      expect(authService.setupTwoFactor).toHaveBeenCalledWith(advogado.id);
    });

    it('advogado consegue ativar o próprio 2FA', async () => {
      authService.enableTwoFactor.mockResolvedValue({
        ok: true,
        recoveryCodes: ['abc123'],
      });

      await expect(
        controller.enableTwoFactor({ code: '123456' }, advogado),
      ).resolves.toEqual({ ok: true, recoveryCodes: ['abc123'] });
      expect(authService.enableTwoFactor).toHaveBeenCalledWith(
        advogado.id,
        '123456',
      );
    });

    it('advogado consegue desativar o próprio 2FA', async () => {
      authService.disableTwoFactor.mockResolvedValue({ ok: true });

      await expect(
        controller.disableTwoFactor(
          { senha: 'senha-atual', code: '123456' },
          advogado,
        ),
      ).resolves.toEqual({ ok: true });
      expect(authService.disableTwoFactor).toHaveBeenCalledWith(
        advogado.id,
        'senha-atual',
        '123456',
      );
    });

    it('assistente não elegível falha ao tentar ativar 2FA', async () => {
      const assistente = {
        id: 'ass1',
        role: Role.ASSISTENTE,
        nome: 'Bea Assistente',
        email: 'bea@alar.com.br',
      };
      authService.enableTwoFactor.mockRejectedValue(
        new ForbiddenException(
          '2FA está disponível para administradores e advogados',
        ),
      );

      await expect(
        controller.enableTwoFactor({ code: '123456' }, assistente),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(authService.enableTwoFactor).toHaveBeenCalledWith(
        assistente.id,
        '123456',
      );
    });
  });

  describe('recuperação de 2FA por admin', () => {
    it('admin desativa 2FA de outro usuário e registra auditoria', async () => {
      authService.adminDisableTwoFactor.mockResolvedValue({ ok: true });
      const admin = {
        id: 'admin1',
        role: Role.ADMIN,
        nome: 'Admin',
        email: 'admin@alar.com.br',
      };

      await expect(
        controller.adminDisableTwoFactor('u-perdeu-acesso', admin),
      ).resolves.toEqual({ ok: true });
      expect(authService.adminDisableTwoFactor).toHaveBeenCalledWith(
        'u-perdeu-acesso',
      );
    });
  });
});
