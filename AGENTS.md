# AGENTS.md

## visão do projeto
- backend `NestJS` em `src/` com módulos que cobrem clientes, processos, compromissos, documentos e dashboard.
- `Prisma` em `prisma/schema.prisma`, `prisma/migrations/*/migration.sql`, `src/prisma.service.ts` e `prisma.config.ts`; as migrações incluem `prisma/migrations/20260617011115_init_clientes/`, `prisma/migrations/20260715165434_add_tabela_processos/`, `prisma/migrations/20260716143223_add_tabela_compromissos/` e `prisma/migrations/20260716152330_add_tabela_documentos/`.
- testes com `Jest` em `src/**/*.spec.ts` e `test/app.e2e-spec.ts`.
- `src/dashboard/` concentra a camada de painel e agregação de dados do sistema.
- upload de arquivos em `src/documentos/` usa `@nestjs/platform-express`, `multer` e `@supabase/supabase-js`.

## comandos principais
```bash
npm install
npm run start:dev
npm run build
```

```bash
npm run lint
npm run test
npm run test:e2e
```

```bash
npx prisma migrate dev
npx prisma generate
```

## convenções de código
- use `@nestjs/common` decorators como `@Controller()`, `@Get()`, `@Post()`, `@Put()` e `@Delete()`.
- siga o padrão de módulos em `src/*/*.module.ts`: controller + service + `PrismaService`.
- importe tipos do `@prisma/client` como `Prisma` ou `Prisma as PrismaTypes`.
- preserve os contratos usados em `src/clientes/`, `src/processos/`, `src/compromissos/` e `src/documentos/`.
- mantenha `tsconfig.json` em `strictNullChecks` e evite introduzir `any` novo.
- mantenha comentários e textos em `pt-BR` quando tocar nestes arquivos.

## testes
- espelhe o arquivo sob teste em `*.spec.ts`.
- use `Test.createTestingModule()` e `supertest` para e2e em `test/`.
- ao mudar `prisma/schema.prisma`, valide `npx prisma generate` e `npm run test`.

## integrações
- respeite `ConfigModule.forRoot({ isGlobal: true })` em `src/app.module.ts`.
- mantenha `MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } })` em `src/documentos/documentos.module.ts`.
- use `dotenv/config` em `src/prisma.service.ts` e `prisma.config.ts` para ler `DIRECT_URL`.
- preserve `@prisma/adapter-pg` e `pg` ao alterar acesso ao banco.

## agente
- responda em `pt-BR`.
- cite arquivos como `src/...`, `prisma/...` e `test/...` ao propor mudanças.

<!-- caliber:managed:pre-commit -->
## Before Committing

**IMPORTANT:** Before every git commit, you MUST ensure Caliber syncs agent configs with the latest code changes.

First, check if the pre-commit hook is already installed:
```bash
grep -q "caliber" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"
```

- If **hook-active**: the hook handles sync automatically — just commit normally. Tell the user: "Caliber will sync your agent configs automatically via the pre-commit hook."
- If **no-hook**: run Caliber manually before committing:
  1. Tell the user: "Caliber: Syncing agent configs with your latest changes..."
  2. Run: `caliber refresh && git add CLAUDE.md .claude/ .cursor/ .cursorrules .github/copilot-instructions.md .github/instructions/ AGENTS.md CALIBER_LEARNINGS.md .agents/ .opencode/ 2>/dev/null`
  3. After it completes, briefly tell the user what Caliber updated. Then proceed with the commit.

**Valid `caliber refresh` options:** `--quiet` (suppress output) and `--dry-run` (preview without writing). Do not pass any other flags — options like `--auto-approve`, `--debug`, or `--force` do not exist and will cause errors.

**`caliber config`** takes no flags — it runs an interactive provider setup. Do not pass `--provider`, `--api-key`, or `--endpoint`.

If `caliber` is not found, read `.agents/skills/setup-caliber/SKILL.md` and follow its instructions to install Caliber.
<!-- /caliber:managed:pre-commit -->

<!-- caliber:managed:learnings -->
## Session Learnings

Read `CALIBER_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
<!-- /caliber:managed:learnings -->

<!-- caliber:managed:model-config -->
## Model Configuration

Recommended default: `claude-sonnet-4-6` with high effort (stronger reasoning; higher cost and latency than smaller models).
Smaller/faster models trade quality for speed and cost — pick what fits the task.
Pin your choice (`/model` in Claude Code, or `CALIBER_MODEL` when using Caliber with an API provider) so upstream default changes do not silently change behavior.

<!-- /caliber:managed:model-config -->

<!-- caliber:managed:sync -->
## Context Sync

This project uses [Caliber](https://github.com/caliber-ai-org/ai-setup) to keep AI agent configs in sync across Claude Code, Cursor, Copilot, and Codex.
Configs update automatically before each commit via `caliber refresh`.
If the pre-commit hook is not set up, read `.agents/skills/setup-caliber/SKILL.md` and follow the setup instructions.
<!-- /caliber:managed:sync -->
