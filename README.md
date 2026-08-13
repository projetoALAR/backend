<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

**Alar API** — backend NestJS do workspace jurídico (Prisma, JWT, RBAC, Supabase Storage).

Setup completo na raiz do projeto: `../README.md`. Use `.env.example` como base.

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Autenticação (JWT) e papéis (RBAC)

Variáveis de ambiente do backend (veja também `.env.example`):

- `JWT_SECRET` — segredo para assinar tokens (obrigatório em produção)
- `JWT_EXPIRES_IN` — validade do token (padrão: `7d`)
- `CORS_ORIGINS` — origens do frontend separadas por vírgula (ex.: `http://localhost:3000`)
- `AUTH_ADMIN_EMAIL` — e-mail do admin criado no primeiro boot (padrão: `admin@alar.com.br`)
- `AUTH_ADMIN_PASSWORD` — senha do admin (**mínimo 8 caracteres**; sem ela o admin não é criado)
- `AUTH_ADMIN_NOME` — nome do admin (padrão: `Administrador`)
- `AUTH_ALLOW_PUBLIC_REGISTER` — `true` libera `POST /v1/auth/register` (padrão: `false`)

### Papéis

| Papel | Permissões |
|-------|------------|
| `ADMIN` | Acesso total, gestão de equipe e criação de usuários (`POST /v1/auth/usuarios`) |
| `ADVOGADO` | CRUD de clientes/processos/documentos; leitura de equipe |
| `ASSISTENTE` | Leitura geral; upload de documentos e compromissos; sem exclusão crítica |

**Equipe ↔ usuário:** `MembroEquipe.usuarioId` liga o cartão da equipe à conta de login. Criar usuário (admin/register) cria/atualiza o membro; criar membro com e-mail novo exige senha e cria o `Usuario`. Remover da equipe não apaga a conta.

No primeiro start, se a tabela `Usuario` estiver vazia **e** `AUTH_ADMIN_PASSWORD` estiver definida, o admin é criado com papel `ADMIN`.

Endpoints públicos: `POST /v1/auth/login`, `POST /v1/auth/register` (se liberado), `GET /`, `GET /health`. Rotas de negócio ficam em `/v1`. Demais rotas exigem `Authorization: Bearer <token>`.

Troca de senha: `POST /v1/auth/change-password` com `{ senhaAtual, novaSenha }` (autenticado). Logout: `POST /v1/auth/logout` (contrato; o JWT é stateless — o frontend limpa o cookie httpOnly).

Rate limit: login (10/min) e register (5/min). Helmet e CORS configuráveis estão ativos.

### Chat IA (OpenAI-compatible)

- `OPENAI_API_KEY` — chave da API (obrigatória em uso real)
- `OPENAI_BASE_URL` — opcional (padrão `https://api.openai.com/v1`; use Groq/outro compatível)
- `OPENAI_MODEL` — opcional (padrão `gpt-4o-mini`)
- `CHAT_ALLOW_MOCK` — `true` libera respostas de demonstração com prefixo `[Modo demonstração]` quando não há chave; padrão: desligado (API retorna 503)

### E-mail (SMTP)

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `SMTP_SECURE=true` para TLS implícito

Sem SMTP, avisos ainda vão para a caixa de mensagens (`/inbox` / página Mensagens).

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
