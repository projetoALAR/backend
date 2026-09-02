/**
 * Valida .env.staging sem imprimir secrets.
 * Uso: npm run staging:check
 */
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.staging');

const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'AUTH_ADMIN_EMAIL',
  'AUTH_ADMIN_PASSWORD',
];

const recommended = ['CORS_ORIGINS', 'APP_URL', 'AUTH_ADMIN_NOME'];

function main() {
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.staging não existe.');
    console.error('   cp .env.staging.example .env.staging');
    process.exit(1);
  }

  require('dotenv').config({ path: envPath });

  let ok = true;
  for (const key of required) {
    const v = (process.env[key] || '').trim();
    if (!v || v.includes('YOUR_PROJECT') || v.includes('troque')) {
      console.error(`❌ ${key} — vazio ou placeholder`);
      ok = false;
    } else {
      console.log(`✓ ${key}`);
    }
  }

  for (const key of recommended) {
    const v = (process.env[key] || '').trim();
    if (!v) {
      console.warn(`⚠ ${key} — recomendado para links/e-mail`);
    } else {
      console.log(`✓ ${key}`);
    }
  }

  const url = (
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    ''
  ).toLowerCase();
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    console.warn(
      '⚠ DATABASE aponta a localhost — staging deveria ser outro projeto Supabase.',
    );
  } else if (url.includes('supabase')) {
    console.log('✓ Banco remoto Supabase (staging)');
  }

  if (!ok) {
    process.exit(1);
  }
  console.log('\n✅ .env.staging parece válido. Próximo: npm run staging:migrate');
}

main();
