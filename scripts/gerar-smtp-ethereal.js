/**
 * Gera credenciais SMTP grátis (Ethereal) para colar no .env do backend.
 * Uso: npm run smtp:ethereal
 */
const nodemailer = require('nodemailer');

async function main() {
  const account = await nodemailer.createTestAccount();
  const secure = account.smtp.secure === true;
  console.log(`
# --- Alar: SMTP de teste (Ethereal, grátis) ---
# 1) Cole no workspace-juridico-backend/.env
# 2) Reinicie a API (npm run start:dev)
# 3) Login admin → Configurações → Enviar e-mail de teste
# 4) Abra a caixa em https://ethereal.email/login
#    usuário: ${account.user}
#    senha:   ${account.pass}

SMTP_HOST=${account.smtp.host}
SMTP_PORT=${account.smtp.port}
SMTP_SECURE=${secure}
SMTP_USER=${account.user}
SMTP_PASS=${account.pass}
SMTP_FROM="Alar Dev <${account.user}>"
APP_URL=http://localhost:3000
`);
}

main().catch((err) => {
  console.error('Falha ao criar conta Ethereal:', err);
  process.exit(1);
});
