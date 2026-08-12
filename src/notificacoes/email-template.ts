export type EmailTemplateOptions = {
  titulo: string;
  corpo: string;
  link?: string;
  linkRotulo?: string;
  appUrl?: string;
};

const BRAND = {
  name: 'Alar',
  tagline: 'Gestão jurídica inteligente',
  primary: '#1E3A8A',
  primaryLight: '#EFF6FF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function corpoParaHtml(corpo: string): string {
  return escapeHtml(corpo)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.text};">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/** Layout HTML compatível com clientes de e-mail (tabelas + estilos inline). */
export function montarEmailAlar(opcoes: EmailTemplateOptions): {
  html: string;
  text: string;
} {
  const { titulo, corpo, link, linkRotulo, appUrl } = opcoes;
  const appLink = appUrl || 'http://localhost:3000';
  const ctaHref = link?.startsWith('http') ? link : link ? `${appLink.replace(/\/$/, '')}${link.startsWith('/') ? link : `/${link}`}` : appLink;
  const ctaLabel = linkRotulo || (link ? 'Abrir no Alar' : 'Acessar o Alar');

  const text = [titulo, '', corpo, link ? `\n${ctaLabel}: ${ctaHref}` : `\n${appLink}`]
    .filter(Boolean)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.primaryLight};font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.primaryLight};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND.primary};padding:24px 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;text-align:center;vertical-align:middle;font-size:22px;font-weight:700;color:#ffffff;">A</td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${BRAND.name}</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:2px;">${BRAND.tagline}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:${BRAND.text};">${escapeHtml(titulo)}</h1>
              ${corpoParaHtml(corpo)}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:8px;">
                <tr>
                  <td style="border-radius:8px;background:${BRAND.primary};">
                    <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(ctaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
                Este e-mail foi enviado automaticamente pelo ${BRAND.name}.
                Ajuste suas preferências de notificação nas configurações do sistema.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}
