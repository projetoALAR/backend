# SMTP e paywall (piloto)

## SMTP produção — Resend

No Railway:

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_SUA_API_KEY
SMTP_FROM=Alar <onboarding@resend.dev>
SMTP_SECURE=false
APP_URL=https://SEU-FRONT.vercel.app
```

1. Conta em https://resend.com → API Key  
2. Cole as vars → redeploy  
3. Admin → Configurações → **Enviar e-mail de teste**

Local: `npm run smtp:ethereal`.

## Paywall

| Piloto | Cobrança |
|--------|----------|
| `REQUIRE_SUBSCRIPTION=false` (Railway) | `true` + `ASAAS_*` |
| `NEXT_PUBLIC_REQUIRE_SUBSCRIPTION=false` (Vercel) | `true` |

Os dois lados iguais. O card em Configurações mostra se estão alinhados.

Guia completo de deploy: pasta do monorepo `DEPLOY.md` §7.
