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
});
