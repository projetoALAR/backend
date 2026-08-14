import { LoginLockoutService } from './login-lockout.service';
import { HttpException } from '@nestjs/common';

describe('LoginLockoutService', () => {
  let service: LoginLockoutService;

  beforeEach(() => {
    service = new LoginLockoutService();
  });

  it('libera após sucesso', () => {
    service.registerFailure('a@alar.com.br');
    service.registerSuccess('a@alar.com.br');
    expect(() => service.assertNotLocked('a@alar.com.br')).not.toThrow();
  });

  it('bloqueia após 5 falhas', () => {
    for (let i = 0; i < 5; i++) {
      service.registerFailure('a@alar.com.br');
    }
    expect(() => service.assertNotLocked('a@alar.com.br')).toThrow(
      HttpException,
    );
  });
});
