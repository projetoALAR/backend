import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export const SENHA_DEMO = 'AlarAdminChangeMe1';

type UsuarioResumo = {
  id: string;
  nome: string;
  email: string;
  role: Role;
};

export async function garantirUsuario(
  prisma: PrismaClient,
  dados: { nome: string; email: string; role: Role },
): Promise<UsuarioResumo> {
  const email = dados.email.trim().toLowerCase();
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    const atualizado = await prisma.usuario.update({
      where: { id: existente.id },
      data: { nome: dados.nome, role: dados.role },
      select: { id: true, nome: true, email: true, role: true },
    });
    await prisma.preferencia.upsert({
      where: { usuarioId: atualizado.id },
      create: {
        usuarioId: atualizado.id,
        nome: atualizado.nome,
        email: atualizado.email,
      },
      update: { nome: atualizado.nome, email: atualizado.email },
    });
    return atualizado;
  }

  const criado = await prisma.usuario.create({
    data: {
      nome: dados.nome,
      email,
      senhaHash: await bcrypt.hash(SENHA_DEMO, 10),
      role: dados.role,
    },
    select: { id: true, nome: true, email: true, role: true },
  });
  await prisma.preferencia.create({
    data: {
      usuarioId: criado.id,
      nome: criado.nome,
      email: criado.email,
    },
  });
  return criado;
}

async function garantirMembro(
  prisma: PrismaClient,
  dados: {
    nome: string;
    email: string;
    cargo: string;
    status: string;
    usuarioId?: string | null;
  },
) {
  const email = dados.email.trim().toLowerCase();
  const existente = await prisma.membroEquipe.findUnique({ where: { email } });
  const payload = {
    nome: dados.nome,
    cargo: dados.cargo,
    status: dados.status,
    usuarioId: dados.usuarioId ?? null,
  };
  if (existente) {
    return prisma.membroEquipe.update({
      where: { id: existente.id },
      data: payload,
    });
  }
  return prisma.membroEquipe.create({
    data: { email, ...payload },
  });
}

export async function popularEscritorio(params: {
  prisma: PrismaClient;
  admin: UsuarioResumo;
  advogada: UsuarioResumo;
  assistente: UsuarioResumo;
  camila: { id: string; nome: string };
  horizonte: { id: string; nome: string };
  lucia: { id: string; nome: string };
  casoTrabalho: { id: string; numero: string; titulo: string | null };
  casoCivel: { id: string; numero: string; titulo: string | null };
}) {
  const {
    prisma,
    admin,
    advogada,
    assistente,
    camila,
    horizonte,
    lucia,
    casoTrabalho,
    casoCivel,
  } = params;

  await prisma.membroEquipe.deleteMany();
  await garantirMembro(prisma, {
    nome: admin.nome,
    email: admin.email,
    cargo: 'Administrador',
    status: 'active',
    usuarioId: admin.id,
  });
  await garantirMembro(prisma, {
    nome: advogada.nome,
    email: advogada.email,
    cargo: 'Advogada trabalhista e cível',
    status: 'active',
    usuarioId: advogada.id,
  });
  await garantirMembro(prisma, {
    nome: assistente.nome,
    email: assistente.email,
    cargo: 'Assistente jurídico',
    status: 'active',
    usuarioId: assistente.id,
  });
  await garantirMembro(prisma, {
    nome: 'Juliana Costa',
    email: 'juliana.costa.ex@alar.dev',
    cargo: 'Estagiária',
    status: 'inactive',
    usuarioId: null,
  });

  await prisma.modeloDocumento.deleteMany();
  await prisma.modeloDocumento.create({
    data: {
      nome: 'Réplica à contestação',
      categoria: 'Petição',
      conteudo: [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A)',
        '',
        'Processo n. {{processo.numero}}',
        'Autor(a): {{cliente.nome}}',
        'CPF/CNPJ: {{cliente.cpf}} {{cliente.cnpj}}',
        '',
        'O(A) autor(a), já qualificado(a), vem apresentar RÉPLICA à contestação, pelos fatos e fundamentos seguintes.',
        '',
        'I — SÍNTESE',
        '{{processo.titulo}}',
        '{{processo.descricao}}',
        '',
        'II — IMPUGNAÇÃO',
        'As alegações da defesa não se sustentam diante dos documentos já juntados. Não houve reclamação contemporânea, e o ônus da prova do fato impeditivo recai sobre o réu.',
        '',
        'III — PEDIDOS',
        'Requer-se o total afastamento da contestação e a procedência dos pedidos da inicial.',
        '',
        'Local e data: {{data.hoje}}',
        'Contato do cliente: {{cliente.email}} / {{cliente.telefone}}',
        '{{cliente.endereco}}',
      ].join('\n'),
    },
  });
  await prisma.modeloDocumento.createMany({
    data: [
      {
        nome: 'Procuração ad judicia',
        categoria: 'Procuração',
        conteudo: [
          'PROCURAÇÃO AD JUDICIA ET EXTRA',
          '',
          'Outorgante: {{cliente.nome}}, CPF {{cliente.cpf}}, CNPJ {{cliente.cnpj}}, residente à {{cliente.endereco}}.',
          'Outorgado: advogado(a) constituído(a) nos autos {{processo.numero}} ({{processo.titulo}}).',
          'Poderes: cláusula ad judicia et extra, inclusive transigir, desistir, receber e dar quitação.',
          '',
          '{{data.hoje}}',
        ].join('\n'),
      },
      {
        nome: 'Notificação extrajudicial de cobrança',
        categoria: 'Notificação',
        conteudo: [
          'NOTIFICAÇÃO EXTRAJUDICIAL',
          '',
          'Remetente: {{cliente.nome}}',
          'Referência: {{processo.numero}} — {{processo.titulo}}',
          '',
          'Notificamos para pagamento no prazo de 5 (cinco) dias, sob pena de cobrança judicial.',
          'Status atual do caso: {{processo.status}}',
          '',
          '{{data.hoje}}',
          '{{cliente.email}} | {{cliente.telefone}}',
        ].join('\n'),
      },
      {
        nome: 'Contrato de honorários',
        categoria: 'Contrato',
        conteudo: [
          'CONTRATO DE HONORÁRIOS ADVOCATÍCIOS',
          '',
          'Contratante: {{cliente.nome}}',
          'Objeto: atuação no caso {{processo.numero}} ({{processo.titulo}}).',
          'O contratante declara ciência do andamento descrito: {{processo.descricao}}',
          '',
          'Foro: Comarca de São Paulo/SP.',
          '{{data.hoje}}',
        ].join('\n'),
      },
      {
        nome: 'Razões de recurso ordinário',
        categoria: 'Recurso',
        conteudo: [
          'RAZÕES DE RECURSO',
          '',
          'Processo n. {{processo.numero}}',
          'Recorrente: {{cliente.nome}}',
          '',
          'O recorrente inconforma-se com a decisão proferida no caso {{processo.titulo}}, status {{processo.status}}.',
          'Pede-se o conhecimento e o provimento do recurso.',
          '',
          '{{data.hoje}}',
        ].join('\n'),
      },
    ],
  });

  const docsTrabalho = await prisma.documento.findMany({
    where: { processoId: casoTrabalho.id },
    orderBy: { criadoEm: 'asc' },
  });
  const docsCivel = await prisma.documento.findMany({
    where: { processoId: casoCivel.id },
    orderBy: { criadoEm: 'asc' },
  });
  const peticaoInicial = docsTrabalho.find((d) =>
    d.nome.toLowerCase().includes('peticao inicial'),
  );
  const memoria = docsTrabalho.find((d) =>
    d.nome.toLowerCase().includes('memoria'),
  );
  const contestacaoCivel = docsCivel.find((d) =>
    d.nome.toLowerCase().includes('contestacao'),
  );

  await prisma.processo.update({
    where: { id: casoTrabalho.id },
    data: {
      andamentosConsulta: {
        em: '2026-08-13T18:10:00.000Z',
        status: 'ok',
        mensagem: 'Nenhum andamento novo desde a última consulta.',
        tribunalSigla: 'trt2',
        tribunalNome: 'TRT2',
        inseridos: 0,
        jaExistentes: 4,
        totalNaFonte: 4,
        ultimoMovimento: {
          data: '2026-07-22T12:00:00.000Z',
          descricao:
            'Audiência una designada para 25/08/2026 às 14h, 42ª Vara do Trabalho de São Paulo',
        },
      },
    },
  });
  await prisma.processo.update({
    where: { id: casoCivel.id },
    data: {
      andamentosConsulta: {
        em: '2026-08-13T18:12:00.000Z',
        status: 'ok',
        mensagem: '4 andamento(s) novo(s) importado(s) da base pública.',
        tribunalSigla: 'tjsp',
        tribunalNome: 'TJSP',
        inseridos: 4,
        jaExistentes: 0,
        totalNaFonte: 4,
        ultimoMovimento: {
          data: '2026-08-12T12:00:00.000Z',
          descricao:
            'Contestação protocolada pelo réu — alegação de mercadoria avariada',
        },
      },
    },
  });

  await prisma.compromisso.create({
    data: {
      titulo: 'Reunião de equipe — pauta da semana',
      descricao:
        'Audiência da Camila (25/08) e réplica da Horizonte (22/08). Pedro confirma documentos; Ana leva proposta de acordo.',
      dataHora: new Date('2026-08-18T09:00:00-03:00'),
    },
  });
  await prisma.compromisso.create({
    data: {
      titulo: 'Consulta inicial — Lúcia Ferreira',
      descricao:
        'Cliente ainda sem caso. Quer orientação sobre revisão de contrato de financiamento imobiliário. Levar minuta de contrato de honorários.',
      dataHora: new Date('2026-08-19T16:30:00-03:00'),
    },
  });

  await prisma.processoComentario.create({
    data: {
      processoId: casoTrabalho.id,
      usuarioId: assistente.id,
      texto:
        'Holerites de 2024–2025 digitalizados e nomeados no Drive interno. Falta só o de dezembro/2025, que a Camila disse que manda hoje à noite.',
    },
  });

  const usuariosChat = [admin, advogada];
  for (const user of usuariosChat) {
    await prisma.conversacao.deleteMany({
      where: { usuarioId: user.id, processoId: null },
    });

    const geral = await prisma.conversacao.create({
      data: {
        titulo: 'Pauta da semana e riscos',
        usuarioId: user.id,
      },
    });
    await prisma.mensagem.createMany({
      data: [
        {
          conversacaoId: geral.id,
          isUser: true,
          conteudo:
            'Quais prazos críticos desta semana e o que a equipe precisa resolver antes da audiência da Camila?',
        },
        {
          conversacaoId: geral.id,
          isUser: false,
          tokensUsados: 640,
          feedback: 'util',
          conteudo: [
            'Há dois prazos imediatos no escritório:',
            '',
            `1. Réplica da Horizonte (${casoCivel.numero}) — 22/08/2026. A contestação alega avaria na NF 4492, mas os canhotos estão sem ressalva.`,
            `2. Audiência una da Camila (${casoTrabalho.numero}) — 25/08/2026, 14h, 42ª VT. Proposta mínima combinada: 2h extras/dia + FGTS; acordo acima de R$ 28 mil líquidos.`,
            '',
            'A consulta da Lúcia Ferreira (19/08) ainda não virou caso. Reunião de equipe na segunda, 9h.',
            '',
            'A IA não substitui o advogado. Confira os autos e os documentos antes de protocolar.',
          ].join('\n'),
        },
      ],
    });

    const chatTrabalho = await prisma.conversacao.create({
      data: {
        titulo: `Caso: ${casoTrabalho.titulo}`,
        processoId: casoTrabalho.id,
        usuarioId: user.id,
      },
    });
    await prisma.mensagem.createMany({
      data: [
        {
          conversacaoId: chatTrabalho.id,
          isUser: true,
          conteudo:
            'Com base na petição inicial e na memória de cálculo, qual é o risco se o ponto eletrônico da padaria for considerado válido?',
        },
        {
          conversacaoId: chatTrabalho.id,
          isUser: false,
          tokensUsados: 512,
          feedback: 'util',
          fontes: [
            peticaoInicial
              ? {
                  documentoId: peticaoInicial.id,
                  nome: peticaoInicial.nome,
                  tipo: 'pdf',
                  trecho:
                    'Na prática, a loja abria às 7h e fechava após as 19h, e a reclamante permanecia no caixa sem registro fiel no ponto eletrônico.',
                }
              : undefined,
            memoria
              ? {
                  documentoId: memoria.id,
                  nome: memoria.nome,
                  tipo: 'pdf',
                  trecho:
                    'Premissa de jornada: 7h às 19h, intervalo de 1h = 11h trabalhadas (3h extras/dia).',
                }
              : undefined,
          ].filter(Boolean),
          conteudo: [
            'Se o ponto for validado, o pedido de 3h extras/dia perde a presunção da Súmula 338 do TST e depende das testemunhas e dos prints do WhatsApp.',
            '',
            `A ${peticaoInicial?.nome || 'petição inicial'} descreve jornada 7h–19h sem registro fiel. A ${memoria?.nome || 'memória de cálculo'} usa 66h extras/mês — convém ter um cenário conservador (1h extra/dia) na audiência.`,
            '',
            'Não inventei jurisprudência além da súmula já citada nos autos. Revise antes de usar em peça.',
          ].join('\n'),
        },
      ],
    });

    const chatCivel = await prisma.conversacao.create({
      data: {
        titulo: `Caso: ${casoCivel.titulo}`,
        processoId: casoCivel.id,
        usuarioId: user.id,
      },
    });
    await prisma.mensagem.createMany({
      data: [
        {
          conversacaoId: chatCivel.id,
          isUser: true,
          conteudo:
            'A contestação do réu pede compensação por avaria. Isso enfraquece a cobrança das três notas?',
        },
        {
          conversacaoId: chatCivel.id,
          isUser: false,
          tokensUsados: 430,
          feedback: 'nao_util',
          fontes: contestacaoCivel
            ? [
                {
                  documentoId: contestacaoCivel.id,
                  nome: contestacaoCivel.nome,
                  tipo: 'pdf',
                  trecho:
                    'O réu alega, em síntese, que parte da carga da NF 4492 chegou com embalagens amassadas e farinha embolorada.',
                },
              ]
            : undefined,
          conteudo: [
            `A ${contestacaoCivel?.nome || 'contestação'} restringe a avaria à NF 4492 e não junta laudo contemporâneo. As outras duas notas continuam líquidas.`,
            'Na réplica, peça a rejeição da compensação e, se o juízo mandar perícia, que o ônus seja do réu.',
            '',
            'A IA não substitui o advogado.',
          ].join('\n'),
        },
      ],
    });
  }

  await prisma.inboxItem.deleteMany({
    where: { usuarioId: { in: [admin.id, advogada.id, assistente.id] } },
  });
  await prisma.inboxItem.createMany({
    data: [
      {
        usuarioId: admin.id,
        titulo: 'Réplica da Horizonte vence em 22/08',
        corpo: 'Contestação alega avaria. Rascunho de réplica já está nos documentos do caso — revisar antes de protocolar.',
        tipo: 'prazo-lembrete',
        lida: false,
        link: `/casos/${casoCivel.id}`,
      },
      {
        usuarioId: admin.id,
        titulo: 'Audiência da Camila na 42ª VT',
        corpo: '25/08 às 14h. Confirmar comparecimento e levar planilha atualizada.',
        tipo: 'prazo-lembrete',
        lida: false,
        link: `/casos/${casoTrabalho.id}`,
      },
      {
        usuarioId: admin.id,
        titulo: 'Pedro ligou para a Camila',
        corpo: 'Cliente confirmou presença na audiência e vai enviar o holerite de dez/2025 hoje à noite.',
        tipo: 'contato',
        lida: false,
        link: `/clientes/${camila.id}`,
      },
      {
        usuarioId: admin.id,
        titulo: 'Ana Ribeiro entrou na equipe',
        corpo: 'Advogada trabalhista e cível vinculada aos dois casos ativos. Login: ana.ribeiro@alar.com.br',
        tipo: 'teamUpdates',
        lida: true,
        link: '/equipe',
      },
      {
        usuarioId: advogada.id,
        titulo: 'Você é responsável pelos dois casos ativos',
        corpo: 'Camila (audiência 25/08) e Horizonte (réplica 22/08). Pedro é co-responsável.',
        tipo: 'teamUpdates',
        lida: false,
        link: '/casos',
      },
      {
        usuarioId: assistente.id,
        titulo: 'Checklist: fotos da descarga da Horizonte',
        corpo: 'Ricardo prometeu as fotos até 18/08. Sem isso a réplica fica mais fraca na NF 4492.',
        tipo: 'reminders',
        lida: false,
        link: `/casos/${casoCivel.id}`,
      },
    ],
  });

  await prisma.contatoLog.deleteMany({
    where: { usuarioId: { in: [admin.id, advogada.id, assistente.id] } },
  });
  await prisma.contatoLog.createMany({
    data: [
      {
        usuarioId: assistente.id,
        alvoTipo: 'cliente',
        alvoId: camila.id,
        alvoNome: camila.nome,
        canal: 'telefone',
        observacao:
          'Confirmou audiência 25/08. Pediu para o advogado chegar 13h30. Vai mandar holerite de dez/2025.',
      },
      {
        usuarioId: advogada.id,
        alvoTipo: 'cliente',
        alvoId: horizonte.id,
        alvoNome: horizonte.nome,
        canal: 'email',
        observacao:
          'Cobrei as fotos da descarga e os e-mails de aceite da NF 4492 para a réplica de 22/08.',
      },
      {
        usuarioId: admin.id,
        alvoTipo: 'cliente',
        alvoId: lucia.id,
        alvoNome: lucia.nome,
        canal: 'telefone',
        observacao:
          'Primeira conversa. Financiamento da casa, taxa abusiva segundo ela. Agendada consulta em 19/08. Ainda sem caso.',
      },
      {
        usuarioId: admin.id,
        alvoTipo: 'membro',
        alvoId: assistente.id,
        alvoNome: assistente.nome,
        canal: 'email',
        observacao:
          'Pedi para organizar a pasta da Camila (holerites + prints) até a reunião de segunda.',
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        acao: 'CRIAR',
        entidade: 'CLIENTE',
        entidadeId: camila.id,
        resumo: `Cadastrou cliente PF ${camila.nome}`,
        usuarioId: admin.id,
        usuarioNome: admin.nome,
        usuarioEmail: admin.email,
      },
      {
        acao: 'CRIAR',
        entidade: 'CLIENTE',
        entidadeId: horizonte.id,
        resumo: `Cadastrou cliente PJ ${horizonte.nome}`,
        usuarioId: admin.id,
        usuarioNome: admin.nome,
        usuarioEmail: admin.email,
      },
      {
        acao: 'CRIAR',
        entidade: 'PROCESSO',
        entidadeId: casoTrabalho.id,
        resumo: `Abriu caso ${casoTrabalho.numero} — ${casoTrabalho.titulo}`,
        usuarioId: advogada.id,
        usuarioNome: advogada.nome,
        usuarioEmail: advogada.email,
      },
      {
        acao: 'CRIAR',
        entidade: 'PROCESSO',
        entidadeId: casoCivel.id,
        resumo: `Abriu caso ${casoCivel.numero} — ${casoCivel.titulo}`,
        usuarioId: advogada.id,
        usuarioNome: advogada.nome,
        usuarioEmail: advogada.email,
      },
      {
        acao: 'CRIAR',
        entidade: 'DOCUMENTO',
        entidadeId: docsTrabalho[0]?.id ?? casoTrabalho.id,
        resumo: 'Enviou procuração e petição inicial no caso trabalhista',
        usuarioId: assistente.id,
        usuarioNome: assistente.nome,
        usuarioEmail: assistente.email,
      },
      {
        acao: 'CRIAR',
        entidade: 'TAREFA',
        entidadeId: casoCivel.id,
        resumo: 'Incluiu checklist da réplica e pedido das fotos da descarga',
        usuarioId: advogada.id,
        usuarioNome: advogada.nome,
        usuarioEmail: advogada.email,
      },
      {
        acao: 'CRIAR',
        entidade: 'ANDAMENTO',
        entidadeId: casoTrabalho.id,
        resumo: 'Registrou andamento interno sobre prints do WhatsApp da loja',
        usuarioId: advogada.id,
        usuarioNome: advogada.nome,
        usuarioEmail: advogada.email,
      },
      {
        acao: 'EDITAR',
        entidade: 'PROCESSO',
        entidadeId: casoTrabalho.id,
        resumo: 'Atualizou status para Audiência marcada e prazo 25/08/2026',
        usuarioId: admin.id,
        usuarioNome: admin.nome,
        usuarioEmail: admin.email,
      },
    ],
  });

  console.log('[demo] Equipe, modelos, chat, mensagens, contatos e auditoria preenchidos.');
  console.log(`[demo] Logins extras (mesma senha ${SENHA_DEMO}):`);
  console.log(`       ${advogada.email}  (advogada)`);
  console.log(`       ${assistente.email}  (assistente)`);
}
