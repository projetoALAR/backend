/**
 * Garante --use-system-ca em processos filhos (ex.: nest --watch).
 * Necessário no Windows quando antivírus/proxy quebra o TLS do Node com o Supabase.
 */
const { spawn } = require('child_process');

const extra = '--use-system-ca';
const prev = process.env.NODE_OPTIONS || '';
if (!prev.includes('use-system-ca')) {
  process.env.NODE_OPTIONS = prev ? `${prev} ${extra}` : extra;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Uso: node scripts/run-with-system-ca.js <comando> [...args]');
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
