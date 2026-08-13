const { writeFileSync } = require('fs');
const { resolve } = require('path');

const url = process.env.OPENAPI_URL || 'http://127.0.0.1:3001/docs-json';

async function main() {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Swagger indisponível em ${url} (${res.status}). Suba a API com npm run start:dev.`,
    );
  }
  const json = await res.text();
  const out = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(out, json);
  console.log(`OpenAPI gravado em ${out}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
