import { TotpService } from './totp.service';
import { Secret, TOTP } from 'otpauth';

describe('TotpService', () => {
  const service = new TotpService();

  it('valida código gerado pelo mesmo segredo', () => {
    const secret = service.createSecret();
    const token = new TOTP({
      issuer: 'Alar',
      label: 'admin@alar.com.br',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    }).generate();

    expect(service.verifyCode(secret, token, 'admin@alar.com.br')).toBe(true);
    expect(service.verifyCode(secret, '000000', 'admin@alar.com.br')).toBe(
      false,
    );
  });

  it('consome código de recuperação uma vez', async () => {
    const codes = service.generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    const hashes = await service.hashRecoveryCodes(codes);
    const remaining = await service.consumeRecoveryCode(hashes, codes[0]);
    expect(remaining).toHaveLength(7);
    const again = await service.consumeRecoveryCode(remaining!, codes[0]);
    expect(again).toBeNull();
  });
});
