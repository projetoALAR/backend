/**
 * Smoke de backup do Postgres (pg_dump + verificação com pg_restore -l).
 * NÃO restaura dados — só comprova que o dump sai íntegro.
 *
 * Uso: npm run backup:smoke
 * Requer: pg_dump e pg_restore no PATH + DIRECT_URL (ou DATABASE_URL) no .env
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function which(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(probe, [cmd], { encoding: 'utf8' });
  return r.status === 0;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: false,
    ...opts,
  });
  return r;
}

function main() {
  const url = (
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    ''
  ).trim();

  if (!url) {
    console.error(
      'Falha: defina DIRECT_URL (preferível) ou DATABASE_URL no .env do backend.',
    );
    process.exit(1);
  }

  if (url.includes('pgbouncer') || url.includes('pooler')) {
    console.warn(
      'Aviso: a URL parece ser pooler. Prefira DIRECT_URL (conexão direta) para pg_dump.',
    );
  }

  if (!which('pg_dump') || !which('pg_restore')) {
    console.error(`
pg_dump / pg_restore não encontrados no PATH.

Instale o cliente PostgreSQL e tente de novo:
  - Windows: https://www.postgresql.org/download/windows/ (marque "Command Line Tools")
  - macOS: brew install libpq && brew link --force libpq
  - Linux: sudo apt install postgresql-client

Alternativa sem CLI: no painel Supabase → Settings → Database → Backups.
`);
    process.exit(2);
  }

  const outDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(outDir, `alar-smoke-${stamp}.dump`);

  console.log(`Backup smoke → ${outFile}`);
  const dump = run('pg_dump', [url, '-Fc', '-f', outFile]);
  if (dump.status !== 0) {
    console.error(dump.stderr || dump.stdout || 'pg_dump falhou');
    process.exit(dump.status || 1);
  }

  const stat = fs.statSync(outFile);
  if (stat.size < 100) {
    console.error(`Dump suspeito (só ${stat.size} bytes). Abortando.`);
    process.exit(1);
  }

  const list = run('pg_restore', ['-l', outFile]);
  if (list.status !== 0) {
    console.error(list.stderr || 'pg_restore -l falhou — dump pode estar corrompido');
    process.exit(list.status || 1);
  }

  const linhas = (list.stdout || '')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith(';'));
  console.log(`
OK — smoke de backup concluído.
  Arquivo: ${outFile}
  Tamanho: ${(stat.size / 1024).toFixed(1)} KB
  Entradas no TOC: ${linhas.length}

Próximo (manual, ambiente seguro — NÃO rode em produção compartilhada):
  pg_restore --clean --if-exists -d "$DIRECT_URL" "${outFile}"

O arquivo fica em backups/ (gitignored). Apague dumps antigos quando não precisar.
`);
}

main();
