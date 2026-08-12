import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';

const ISSUER = 'Alar';
const RECOVERY_COUNT = 8;

@Injectable()
export class TotpService {
  createSecret(): string {
    return new Secret({ size: 20 }).base32;
  }

  otpauthUrl(email: string, secretBase32: string): string {
    return this.build(email, secretBase32).toString();
  }

  async qrDataUrl(otpauth: string): Promise<string> {
    return QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
  }

  verifyCode(secretBase32: string, code: string, email = 'user'): boolean {
    const token = (code ?? '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(token)) return false;
    const delta = this.build(email, secretBase32).validate({
      token,
      window: 1,
    });
    return delta !== null;
  }

  generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_COUNT }, () => {
      const hex = randomBytes(4).toString('hex').toUpperCase();
      return `${hex.slice(0, 4)}-${hex.slice(4)}`;
    });
  }

  normalizeRecovery(code: string): string {
    return (code ?? '').replace(/[\s-]/g, '').toUpperCase();
  }

  async hashRecoveryCodes(codes: string[]): Promise<string[]> {
    return Promise.all(
      codes.map((c) => bcrypt.hash(this.normalizeRecovery(c), 10)),
    );
  }

  async consumeRecoveryCode(
    hashes: string[],
    code: string,
  ): Promise<string[] | null> {
    const normalized = this.normalizeRecovery(code);
    if (normalized.length < 8) return null;
    for (let i = 0; i < hashes.length; i++) {
      const ok = await bcrypt.compare(normalized, hashes[i]);
      if (ok) {
        return hashes.filter((_, j) => j !== i);
      }
    }
    return null;
  }

  private build(email: string, secretBase32: string): TOTP {
    return new TOTP({
      issuer: ISSUER,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secretBase32),
    });
  }
}
