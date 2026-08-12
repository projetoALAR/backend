import { HttpStatus, Injectable } from '@nestjs/common';
import { HttpException } from '@nestjs/common';

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

type Attempt = { fails: number; lockedUntil: number };

@Injectable()
export class LoginLockoutService {
  private readonly attempts = new Map<string, Attempt>();

  assertNotLocked(email: string) {
    const key = email.trim().toLowerCase();
    const rec = this.attempts.get(key);
    if (!rec?.lockedUntil) return;
    const remaining = rec.lockedUntil - Date.now();
    if (remaining <= 0) {
      this.attempts.delete(key);
      return;
    }
    const min = Math.max(1, Math.ceil(remaining / 60_000));
    throw new HttpException(
      `Muitas tentativas de login. Tente novamente em ${min} min.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  registerFailure(email: string) {
    const key = email.trim().toLowerCase();
    const rec = this.attempts.get(key) ?? { fails: 0, lockedUntil: 0 };
    rec.fails += 1;
    if (rec.fails >= MAX_FAILS) {
      rec.lockedUntil = Date.now() + LOCK_MS;
    }
    this.attempts.set(key, rec);
  }

  registerSuccess(email: string) {
    this.attempts.delete(email.trim().toLowerCase());
  }

  /** Só para testes. */
  reset() {
    this.attempts.clear();
  }
}
