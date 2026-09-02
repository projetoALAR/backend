/**
 * Limpa processos/clientes de demonstração e recria 2 casos fictícios
 * com documentos, equipe, modelos, chat, inbox, agenda e auditoria.
 *
 * Uso: npm run seed:demo
 *
 * Mantém o admin existente. Cria/atualiza advogada e assistente de demo.
 *
 * Segurança: aborta se o banco não é local (localhost/127.0.0.1) sem
 * SEED_DEMO_CONFIRM=yes — evita apagar dados de produção por engano.
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import { Pool } from 'pg';
import { formatarNumeroCnj } from '../src/andamentos/datajud-tribunal.util';
import {
  garantirUsuario,
  popularEscritorio,
} from './seed.demo-escritorio';

const BUCKET = 'documentos';
const MARCA =
  'Documento de demonstração do Alar. Partes, fatos e números são fictícios.';

function textoParaPdfLatin1(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function renderizarPdf(texto: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(textoParaPdfLatin1(texto), { align: 'justify', lineGap: 2 });
    doc.end();
  });
}

function dvCnj(sequencial: string, resto: string): string {
  return String(98n - (BigInt(sequencial + resto) % 97n)).padStart(2, '0');
}

function montarCnj(
  sequencial: string,
  ano: string,
  justica: string,
  tr: string,
  origem: string,
): string {
  const seq = sequencial.padStart(7, '0');
  const resto = `${ano}${justica}${tr}${origem}`;
  const digits = `${seq}${dvCnj(seq, resto)}${resto}`;
  return formatarNumeroCnj(digits) ?? digits;
}

function cpfDeBase(base9: string): string {
  const d = base9.padStart(9, '0').slice(0, 9).split('').map(Number);
  for (let etapa = 0; etapa < 2; etapa++) {
    let soma = 0;
    for (let i = 0; i < 9 + etapa; i++) soma += d[i] * (10 + etapa - i);
    d.push(((soma * 10) % 11) % 10);
  }
  const n = d.join('');
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function cnpjDeBase(base12: string): string {
  const d = base12.padStart(12, '0').slice(0, 12).split('').map(Number);
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv = (pesos: number[]) => {
    const soma = d.reduce((acc, n, i) => acc + n * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  d.push(dv(pesos1));
  d.push(dv(pesos2));
  const n = d.join('');
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
}

function dataIso(iso: string): Date {
  return new Date(`${iso}T12:00:00-03:00`);
}

function dataHora(iso: string): Date {
  return new Date(iso);
}

/** Data/hora local, relativa a hoje (demo sempre “viva”). */
function daquiA(dias: number, hora = 14, minuto = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

async function limparStorage(supabase: SupabaseClient) {
  const { data: raiz, error } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000 });
  if (error) {
    console.warn(`[demo] Storage list falhou: ${error.message}`);
    return;
  }

  const paths: string[] = [];
  for (const item of raiz ?? []) {
    if (!item.name || item.name === 'avatars') continue;
    const { data: filhos, error: errFilhos } = await supabase.storage
      .from(BUCKET)
      .list(item.name, { limit: 1000 });
    if (errFilhos) {
      console.warn(`[demo] list ${item.name}: ${errFilhos.message}`);
      continue;
    }
    if (filhos && filhos.length > 0) {
      for (const f of filhos) {
        if (f.name) paths.push(`${item.name}/${f.name}`);
      }
    } else {
      paths.push(item.name);
    }
  }

  if (paths.length === 0) {
    console.log('[demo] Storage de documentos já vazio (exceto avatars).');
    return;
  }

  for (let i = 0; i < paths.length; i += 50) {
    const lote = paths.slice(i, i + 50);
    const { error: rm } = await supabase.storage.from(BUCKET).remove(lote);
    if (rm) console.warn(`[demo] remove storage: ${rm.message}`);
  }
  console.log(`[demo] Removidos ${paths.length} arquivo(s) do bucket documentos.`);
}

async function enviarPdf(
  supabase: SupabaseClient,
  prisma: PrismaClient,
  processoId: string,
  nome: string,
  texto: string,
) {
  const pdf = await renderizarPdf(`${texto}\n\n${MARCA}`);
  const safeName = nome.replace(/[^\w.-]+/g, '_');
  const storagePath = `${processoId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, pdf, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw new Error(`Upload ${nome}: ${error.message}`);
  await prisma.documento.create({
    data: {
      nome,
      urlArquivo: storagePath,
      tamanho: pdf.length,
      processoId,
    },
  });
  console.log(`[demo]   PDF ${nome} (${pdf.length} bytes)`);
}

function assertSeedSafe() {
  const url = (
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    ''
  ).toLowerCase();
  const force = process.env.SEED_DEMO_CONFIRM === 'yes';
  const isLocal =
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('alar_ci');
  if (!isLocal && !force) {
    console.error(
      '\n[seed:demo] ABORTADO: DATABASE_URL/DIRECT_URL não aponta para banco local.',
    );
    console.error(
      '  O seed apaga e recria processos/clientes de demo — não rode contra produção.',
    );
    console.error(
      '  Use um projeto Supabase de dev/staging ou, se tiver certeza absoluta:',
    );
    console.error('  SEED_DEMO_CONFIRM=yes npm run seed:demo\n');
    process.exit(1);
  }
  if (!isLocal && force) {
    console.warn(
      '[seed:demo] AVISO: SEED_DEMO_CONFIRM=yes — rodando contra banco remoto.',
    );
  }
}

async function main() {
  assertSeedSafe();
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_KEY || '',
  );

  try {
    await prisma.$connect();

    const [nProc, nCli, nDoc] = await Promise.all([
      prisma.processo.count(),
      prisma.cliente.count(),
      prisma.documento.count(),
    ]);
    console.log(
      `[demo] Antes: ${nProc} processo(s), ${nCli} cliente(s), ${nDoc} documento(s).`,
    );

    await limparStorage(supabase);

    await prisma.processo.deleteMany();
    await prisma.cliente.deleteMany();
    await prisma.compromisso.deleteMany({ where: { processoId: null } });
    await prisma.inboxItem.deleteMany({
      where: {
        OR: [
          { tipo: 'andamento' },
          { link: { startsWith: '/casos/' } },
          { link: { startsWith: '/cases/' } },
        ],
      },
    });

    console.log('[demo] Processos, clientes e documentos antigos apagados.');

    const usuarios = await prisma.usuario.findMany({
      orderBy: { criadoEm: 'asc' },
      select: { id: true, nome: true, email: true, role: true },
    });
    const admin = usuarios.find((u) => u.role === Role.ADMIN) || usuarios[0];
    if (!admin) throw new Error('Nenhum usuário no banco. Faça login uma vez para criar o admin.');

    const advogada = await garantirUsuario(prisma, {
      nome: 'Ana Ribeiro',
      email: 'ana.ribeiro@alar.com.br',
      role: Role.ADVOGADO,
    });
    const assistente = await garantirUsuario(prisma, {
      nome: 'Pedro Alves',
      email: 'pedro.alves@alar.com.br',
      role: Role.ASSISTENTE,
    });

    const cnjTrabalho = montarCnj('1004521', '2025', '5', '02', '0001');
    const cnjCivel = montarCnj('1018834', '2026', '8', '26', '0100');

    const camila = await prisma.cliente.create({
      data: {
        nome: 'Camila Rodrigues Nunes',
        tipo: 'PF',
        cpf: cpfDeBase('390847211'),
        rg: '42.118.903-5',
        email: 'camila.nunes.demo@alar.dev',
        telefone: '(11) 98841-2730',
        endereco: 'Rua das Acácias, 412, apto 24 — Vila Mariana',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '04109-080',
        observacoes:
          'Atendente demitida em jan/2026. Tem holerites de 2023–2025 e conversas de WhatsApp com a gerente. Prefere contato após 18h.',
      },
    });

    const horizonte = await prisma.cliente.create({
      data: {
        nome: 'Horizonte Alimentos Ltda',
        tipo: 'PJ',
        cnpj: cnpjDeBase('452189030001'),
        nomeFantasia: 'Horizonte Atacado',
        email: 'juridico.horizonte.demo@alar.dev',
        telefone: '(11) 3278-4410',
        endereco: 'Av. do Estado, 1880, conjunto 71 — Brás',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '03007-000',
        observacoes:
          'Sócio responsável: Ricardo Gomes Barbosa. Duplicatas de nov–dez/2025 protestadas no 2º Tabelionato. Cliente pede urgência por fluxo de caixa.',
      },
    });

    const lucia = await prisma.cliente.create({
      data: {
        nome: 'Lúcia Ferreira Campos',
        tipo: 'PF',
        cpf: cpfDeBase('281445670'),
        rg: '33.902.118-1',
        email: 'lucia.campos.demo@alar.dev',
        telefone: '(11) 97620-4418',
        endereco: 'Rua Harmonia, 88 — Vila Madalena',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '05435-000',
        observacoes:
          'Consulta em 19/08. Quer revisar financiamento imobiliário (taxa e seguro embutido). Ainda não constituiu o escritório — não abrir caso até assinar honorários.',
      },
    });

    const casoTrabalho = await prisma.processo.create({
      data: {
        numero: cnjTrabalho,
        status: 'Audiência marcada',
        titulo: 'Reclamação trabalhista — horas extras e verbas rescisórias',
        descricao:
          'Reclamação trabalhista de Camila Rodrigues Nunes contra a Padaria Estrela do Bairro Ltda. A cliente foi admitida em 03/03/2021 como atendente e dispensada sem justa causa em 17/01/2026. Relata jornada habitual das 7h às 19h, com uma folga semanal irregular, sem pagamento de horas extras nem adicional noturno. Pedidos: reconhecimento da jornada, horas extras com reflexos, diferenças de FGTS, multa de 40%, aviso prévio e indenização por dano moral em razão de cobrança pública de metas. Audiência una designada (ver prazo/agenda) na 42ª VT de São Paulo.',
        prioridade: 'Alta',
        prazo: daquiA(5, 14, 0),
        tags: ['trabalhista', 'horas extras', 'audiência'],
        concluido: false,
        tribunalSigla: 'trt2',
        clienteId: camila.id,
        responsavelId: advogada.id,
        coResponsavelId: assistente.id,
      },
    });

    const casoCivel = await prisma.processo.create({
      data: {
        numero: cnjCivel,
        status: 'Em andamento',
        titulo: 'Cobrança de duplicatas — fornecimento de mercadorias',
        descricao:
          'Ação de cobrança ajuizada pela Horizonte Alimentos Ltda contra o Atacado Boa Vista Comércio Ltda. Contrato de fornecimento de 12/02/2024; entregas de novembro e dezembro de 2025 (notas 4418, 4492 e 4501) no total de R$ 87.430,16, acrescidas de mora contratual de 1% a.m. e multa de 2%. Notificação extrajudicial em 18/03/2026 ficou sem resposta. Citação cumprida; contestação protocolada alegando mercadoria avariada — réplica com prazo na agenda. Há pedido subsidiário de desconsideração da personalidade se a execução restar frustrada.',
        prioridade: 'Média',
        prazo: daquiA(3, 18, 0),
        tags: ['cível', 'cobrança', 'PJ'],
        concluido: false,
        tribunalSigla: 'tjsp',
        clienteId: horizonte.id,
        responsavelId: advogada.id,
        coResponsavelId: assistente.id,
      },
    });

    await prisma.andamento.createMany({
      data: [
        {
          processoId: casoTrabalho.id,
          data: dataIso('2026-02-10'),
          descricao: 'Distribuição da reclamação trabalhista',
          codigoMovimento: 26,
          origem: { codigo: 26, nome: 'Distribuição', seed: 'demo' },
        },
        {
          processoId: casoTrabalho.id,
          data: dataIso('2026-02-28'),
          descricao: 'Citação da reclamada — Padaria Estrela do Bairro Ltda',
          codigoMovimento: 98,
          origem: { codigo: 98, nome: 'Citação', seed: 'demo' },
        },
        {
          processoId: casoTrabalho.id,
          data: dataIso('2026-03-18'),
          descricao: 'Contestação apresentada pela reclamada',
          codigoMovimento: 60,
          origem: { codigo: 60, nome: 'Contestação', seed: 'demo' },
        },
        {
          processoId: casoTrabalho.id,
          data: dataIso('2026-07-22'),
          descricao:
            'Audiência una designada para 25/08/2026 às 14h, 42ª Vara do Trabalho de São Paulo',
          codigoMovimento: 970,
          origem: { codigo: 970, nome: 'Audiência', seed: 'demo' },
        },
        {
          processoId: casoTrabalho.id,
          data: dataIso('2026-08-08'),
          descricao:
            'Cliente enviou prints do grupo de WhatsApp da loja e lista de folgas de 2025. Conferir se dá para juntar como prova emprestada da jornada.',
          codigoMovimento: null,
          origem: { tipo: 'manual', usuarioId: advogada.id },
        },
        {
          processoId: casoCivel.id,
          data: dataIso('2026-04-07'),
          descricao: 'Distribuição da ação de cobrança',
          codigoMovimento: 26,
          origem: { codigo: 26, nome: 'Distribuição', seed: 'demo' },
        },
        {
          processoId: casoCivel.id,
          data: dataIso('2026-04-09'),
          descricao: 'Conclusos para decisão — despacho inicial',
          codigoMovimento: 51,
          origem: { codigo: 51, nome: 'Conclusos', seed: 'demo' },
        },
        {
          processoId: casoCivel.id,
          data: dataIso('2026-08-02'),
          descricao: 'Citação do réu cumprida (AR positivo)',
          codigoMovimento: 98,
          origem: { codigo: 98, nome: 'Citação', seed: 'demo' },
        },
        {
          processoId: casoCivel.id,
          data: dataIso('2026-08-12'),
          descricao: 'Contestação protocolada pelo réu — alegação de mercadoria avariada',
          codigoMovimento: 60,
          origem: { codigo: 60, nome: 'Contestação', seed: 'demo' },
        },
        {
          processoId: casoCivel.id,
          data: dataIso('2026-08-13'),
          descricao:
            'Intimação para réplica. Prazo fatal 22/08/2026. Pedir ao cliente os canhotos de recebimento e fotos da descarga.',
          codigoMovimento: null,
          origem: { tipo: 'manual', usuarioId: advogada.id },
        },
      ],
    });

    await prisma.processoTarefa.createMany({
      data: [
        {
          processoId: casoTrabalho.id,
          titulo: 'Juntar holerites 2023–2025 e TRCT',
          concluida: true,
          ordem: 0,
          prazo: dataIso('2026-02-05'),
          criadoPorId: advogada.id,
        },
        {
          processoId: casoTrabalho.id,
          titulo: 'Atualizar planilha de horas extras até a audiência',
          concluida: false,
          ordem: 1,
          prazo: daquiA(2, 12, 0),
          criadoPorId: advogada.id,
        },
        {
          processoId: casoTrabalho.id,
          titulo: 'Confirmar comparecimento da cliente na 42ª VT',
          concluida: false,
          ordem: 2,
          prazo: daquiA(4, 12, 0),
          criadoPorId: assistente.id,
        },
        {
          processoId: casoCivel.id,
          titulo: 'Organizar notas 4418, 4492 e 4501 com canhotos',
          concluida: true,
          ordem: 0,
          prazo: dataIso('2026-04-01'),
          criadoPorId: assistente.id,
        },
        {
          processoId: casoCivel.id,
          titulo: 'Redigir réplica à contestação (avaria)',
          concluida: false,
          ordem: 1,
          prazo: daquiA(2, 12, 0),
          criadoPorId: advogada.id,
        },
        {
          processoId: casoCivel.id,
          titulo: 'Pedir ao cliente fotos da descarga e e-mails de aceite',
          concluida: false,
          ordem: 2,
          prazo: daquiA(1, 12, 0),
          criadoPorId: assistente.id,
        },
      ],
    });

    await prisma.compromisso.createMany({
      data: [
        {
          processoId: casoTrabalho.id,
          titulo: 'Audiência una — 42ª VT de São Paulo',
          descricao:
            'Camila Rodrigues Nunes vs Padaria Estrela do Bairro Ltda. Levar documentos originais e planilha atualizada. Cliente deve chegar 30 min antes.',
          dataHora: daquiA(5, 14, 0),
        },
        {
          processoId: casoCivel.id,
          titulo: 'Prazo de réplica — cobrança Horizonte',
          descricao:
            'Protocolar réplica à contestação do Atacado Boa Vista. Enfatizar canhotos assinados e ausência de reclamação contemporânea.',
          dataHora: daquiA(3, 18, 0),
        },
      ],
    });

    await prisma.processoComentario.createMany({
      data: [
        {
          processoId: casoTrabalho.id,
          usuarioId: advogada.id,
          texto:
            'Na audiência, proposta mínima: reconhecer 2h extras/dia + reflexos e FGTS. Cliente autorizou acordo acima de R$ 28 mil líquidos. Evitar ceder no dano moral sem contrapartida.',
        },
        {
          processoId: casoCivel.id,
          usuarioId: advogada.id,
          texto:
            'A tese de avaria veio tarde: as notas foram recebidas sem ressalva. Se o juiz mandar perícia, pedir que o ônus seja do réu. Manter o valor integral na réplica.',
        },
      ],
    });

    await enviarPdf(
      supabase,
      prisma,
      casoTrabalho.id,
      'Procuracao ad judicia.pdf',
      [
        'PROCURAÇÃO AD JUDICIA ET EXTRA',
        '',
        `Outorgante: ${camila.nome}, brasileira, solteira, atendente, CPF ${camila.cpf}, RG ${camila.rg}, residente à ${camila.endereco}, ${camila.cidade}/${camila.uf}, CEP ${camila.cep}.`,
        '',
        `Outorgado: ${advogada.nome}, OAB/SP 000.000, com escritório no foro central da capital, com os poderes da cláusula ad judicia et extra, inclusive para substabelecer, transigir, desistir, firmar acordo, receber e dar quitação, no processo ${cnjTrabalho}, em trâmite na 42ª Vara do Trabalho de São Paulo.`,
        '',
        'A outorgante declara ciência de que a presente procuração destina-se à reclamação trabalhista em face da Padaria Estrela do Bairro Ltda, CNPJ 00.000.000/0001-00, pelos pedidos de horas extras, verbas rescisórias e indenização por dano moral.',
        '',
        'São Paulo, 03 de fevereiro de 2026.',
        '',
        '________________________________',
        camila.nome,
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoTrabalho.id,
      'Peticao inicial - reclamacao trabalhista.pdf',
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DA ____ VARA DO TRABALHO DE SÃO PAULO/SP',
        '',
        `Processo n. ${cnjTrabalho} (distribuição automática)`,
        '',
        `${camila.nome.toUpperCase()}, já qualificada, por sua advogada, propõe RECLAMAÇÃO TRABALHISTA em face de PADARIA ESTRELA DO BAIRRO LTDA, pessoa jurídica de direito privado, com estabelecimento na Rua dos Pinheiros, 90, São Paulo/SP, pelos fatos e fundamentos seguintes.`,
        '',
        'I — DOS FATOS',
        'A reclamante foi admitida em 03/03/2021, na função de atendente, mediante salário de R$ 1.980,00, posteriormente reajustado para R$ 2.240,00. A jornada contratual era das 8h às 17h, com uma hora de intervalo. Na prática, a loja abria às 7h e fechava após as 19h, e a reclamante permanecia no caixa sem registro fiel no ponto eletrônico.',
        'Havia uma folga semanal, frequentemente alterada sem folga compensatória. Não houve pagamento de horas extras, adicional noturno nem reflexos em DSR, 13º, férias e FGTS.',
        'Em 17/01/2026 a reclamante foi dispensada sem justa causa. O TRCT não contempla as horas extraordinárias. Durante o contrato, a gerente cobrava metas em voz alta, na frente de clientes, o que justifica o pedido de dano moral.',
        '',
        'II — DO DIREITO',
        'A Constituição e a CLT asseguram a remuneração do serviço extraordinário (art. 7º, XVI, CF; arts. 58, 59 e 71 da CLT). A jornada deve ser reconhecida por presunção relativa diante da invalidade do controle de ponto (Súmula 338 do TST). Pedem-se ainda as verbas rescisórias com reflexos e a multa de 40% do FGTS.',
        '',
        'III — DOS PEDIDOS',
        'a) reconhecimento da jornada das 7h às 19h, com 1h de intervalo;',
        'b) horas extras e reflexos;',
        'c) diferenças de FGTS, multa de 40% e aviso prévio;',
        'd) indenização por dano moral no valor de R$ 10.000,00;',
        'e) honorários e justiça gratuita.',
        '',
        `Dá-se à causa o valor de R$ 62.800,00. São Paulo, 10 de fevereiro de 2026.`,
        '',
        advogada.nome,
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoTrabalho.id,
      'Contestacao da reclamada.pdf',
      [
        'CONTESTAÇÃO',
        '',
        `Processo n. ${cnjTrabalho}`,
        'Reclamante: Camila Rodrigues Nunes',
        'Reclamada: Padaria Estrela do Bairro Ltda',
        '',
        'A reclamada impugna os fatos e requer a total improcedência.',
        '',
        'A jornada era das 8h às 17h, com intervalo de uma hora, registrada em ponto eletrônico biométrico. Eventuais minutos residuais não superam o artigo 58, §1º, da CLT. A reclamante folgava aos domingos, em escala divulgada com antecedência.',
        'A dispensa observou o TRCT, com pagamento de aviso, férias + 1/3, 13º proporcional e saque do FGTS. Não houve constrangimento: a cobrança de metas é inerente à atividade comercial e ocorria em reunião reservada.',
        'Nega-se o dano moral. Requer-se a expedição de ofício ao banco depositário do FGTS e a oitiva de duas testemunhas da casa (padeiros do turno da manhã).',
        '',
        'São Paulo, 18 de março de 2026.',
        'Advogado da reclamada (peça de demonstração)',
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoTrabalho.id,
      'Memoria de calculo - horas extras.pdf',
      [
        'MEMÓRIA DE CÁLCULO — HORAS EXTRAS E REFLEXOS',
        `(demonstração)  ${cnjTrabalho}`,
        '',
        'Reclamante: Camila Rodrigues Nunes',
        'Período: 03/03/2021 a 17/01/2026  |  Salário-base considerado: R$ 2.240,00',
        'Divisor: 220  |  Hora normal: R$ 10,18  |  Hora extra 50%: R$ 15,27',
        '',
        'Premissa de jornada: 7h às 19h, intervalo de 1h = 11h trabalhadas (3h extras/dia).',
        'Média de 22 dias/mês × 3h = 66h extras/mês.',
        '',
        'Resumo aproximado (base 58 meses):',
        '- Horas extras: R$ 58.353,00',
        '- Reflexos DSR / 13º / férias: R$ 14.588,00',
        '- FGTS 8% + 40%: R$ 8.186,00',
        '- Dano moral (pedido): R$ 10.000,00',
        'Total pedido (arredondado): R$ 91.100,00 — valor da causa na inicial reduzido a R$ 62.800,00 por critério conservador da cliente.',
        '',
        'Observação interna: atualizar até 22/08/2026 com os holerites de 2025 já juntados. Não incluir intervalo suprimido enquanto a cliente não confirmar se almoçava no local.',
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoTrabalho.id,
      'Pauta de audiencia una.pdf',
      [
        'COMUNICAÇÃO DE PAUTA — AUDIÊNCIA UNA',
        '',
        `Processo n. ${cnjTrabalho}`,
        '42ª Vara do Trabalho de São Paulo',
        'Data: 25 de agosto de 2026, 14h00',
        'Sala: 4  |  Modalidade: presencial',
        '',
        'Partes: Camila Rodrigues Nunes  ×  Padaria Estrela do Bairro Ltda',
        '',
        'Comparecimento pessoal da reclamante e do preposto, com documentos originais e rol de testemunhas (máx. 3). Proposta de acordo poderá ser reduzida a termo na própria audiência.',
        '',
        'Anotação do escritório: chegar 13h30. Levar planilha, prints do WhatsApp impressos e TRCT. Se a reclamada insistir em 0h extra, encerrar a conciliação e pedir depoimento pessoal da gerente.',
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoCivel.id,
      'Procuracao da sociedade.pdf',
      [
        'PROCURAÇÃO',
        '',
        `Outorgante: ${horizonte.nome}, CNPJ ${horizonte.cnpj}, nome fantasia ${horizonte.nomeFantasia}, com sede à ${horizonte.endereco}, ${horizonte.cidade}/${horizonte.uf}.`,
        'Representante: Ricardo Gomes Barbosa, sócio-administrador.',
        '',
        `Outorgado: ${advogada.nome}, com poderes ad judicia et extra para a ação de cobrança n. ${cnjCivel}, inclusive acordo, desistência, substabelecimento e recebimento de valores.`,
        '',
        'São Paulo, 28 de março de 2026.',
        '',
        '________________________________',
        'Ricardo Gomes Barbosa',
        horizonte.nome,
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoCivel.id,
      'Contrato de fornecimento 2024.pdf',
      [
        'CONTRATO DE FORNECIMENTO DE GÊNEROS ALIMENTÍCIOS',
        '',
        `Fornecedor: ${horizonte.nome} (${horizonte.nomeFantasia}), CNPJ ${horizonte.cnpj}.`,
        'Comprador: Atacado Boa Vista Comércio Ltda, CNPJ 11.222.333/0001-44, Rua da Mooca, 1500, São Paulo/SP.',
        '',
        'Cláusula 1ª. O fornecedor venderá produtos da linha seca (arroz, feijão, óleo e farinha) mediante pedidos semanais, com entrega no depósito do comprador.',
        'Cláusula 4ª. O pagamento será em 28 dias, por boleto vinculado à duplicata mercantil. Mora de 1% ao mês e multa de 2% sobre o valor vencido.',
        'Cláusula 6ª. A conferência da mercadoria far-se-á no ato da descarga. A ausência de ressalva no canhoto importa aceitação da quantidade e da qualidade.',
        'Cláusula 9ª. Fica eleito o foro da Comarca de São Paulo/SP.',
        '',
        'São Paulo, 12 de fevereiro de 2024.',
        'Assinam: Ricardo Gomes Barbosa (fornecedor) e Helena Prado (compradora).',
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoCivel.id,
      'Notificacao extrajudicial.pdf',
      [
        'NOTIFICAÇÃO EXTRAJUDICIAL',
        '',
        `Remetente: ${horizonte.nome}`,
        'Destinatário: Atacado Boa Vista Comércio Ltda',
        'Data: 18 de março de 2026',
        '',
        'Notificamos V.Sas. para, no prazo de 5 (cinco) dias, quitar as duplicatas abaixo, sob pena de cobrança judicial, protesto já lavrado e inscrição em cadastro de inadimplentes:',
        '',
        'NF 4418  venc. 12/12/2025  R$ 27.810,40',
        'NF 4492  venc. 27/12/2025  R$ 31.204,88',
        'NF 4501  venc. 08/01/2026  R$ 28.414,88',
        'Subtotal: R$ 87.430,16  + mora e multa contratual.',
        '',
        'As mercadorias foram recebidas sem ressalva, conforme canhotos anexos. Não houve qualquer comunicação contemporânea de avaria.',
        '',
        'Sem resposta até 23/03/2026, fica autorizada a propositura da ação.',
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoCivel.id,
      'Peticao inicial - acao de cobranca.pdf',
      [
        'EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ____ VARA CÍVEL DO FORO CENTRAL DA COMARCA DE SÃO PAULO/SP',
        '',
        `${horizonte.nome.toUpperCase()}, CNPJ ${horizonte.cnpj}, propõe AÇÃO DE COBRANÇA com pedido de tutela de evidência em face de ATACADO BOA VISTA COMÉRCIO LTDA, CNPJ 11.222.333/0001-44, pelos fundamentos a seguir.`,
        '',
        'I — DOS FATOS',
        'As partes firmaram contrato de fornecimento em 12/02/2024. Entre novembro e dezembro de 2025 o autor entregou três cargas, documentadas nas notas 4418, 4492 e 4501, no valor total de R$ 87.430,16. Os canhotos foram assinados pelo encarregado do depósito. Os boletos venceram e não foram pagos. Protesto no 2º Tabelionato de São Paulo. Notificação extrajudicial de 18/03/2026 sem resposta.',
        '',
        'II — DO DIREITO',
        'A obrigação está líquida e evidenciada por documentos (arts. 389, 394 e 406 do Código Civil; art. 311, II, do CPC). A mora é contratual (1% a.m. + multa de 2%). Subsidiariamente, pede-se a desconsideração da personalidade jurídica se a execução restar frustrada (art. 50 do CC).',
        '',
        'III — DOS PEDIDOS',
        'a) citação;',
        'b) condenação ao principal, mora, multa e custas;',
        'c) tutela de evidência para arresto de ativos até o limite do débito;',
        'd) honorários de 10%.',
        '',
        `Dá-se à causa o valor de R$ 92.180,00. São Paulo, 07 de abril de 2026.`,
        '',
        advogada.nome,
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoCivel.id,
      'Contestacao do reu.pdf',
      [
        'CONTESTAÇÃO',
        '',
        `Processo n. ${cnjCivel}`,
        'Autor: Horizonte Alimentos Ltda',
        'Réu: Atacado Boa Vista Comércio Ltda',
        '',
        'O réu alega, em síntese, que parte da carga da NF 4492 chegou com embalagens amassadas e farinha embolorada, o que teria gerado prejuízo de R$ 18.000,00. Pede compensação e a improcedência do saldo.',
        'Não junta laudo contemporâneo, boletim de ocorrência nem comunicação formal ao autor na data da descarga. Os canhotos estão assinados “de acordo”.',
        '',
        'São Paulo, 12 de agosto de 2026.',
        'Advogado do réu (peça de demonstração)',
      ].join('\n'),
    );

    await enviarPdf(
      supabase,
      prisma,
      casoCivel.id,
      'Notas e canhotos - resumo.pdf',
      [
        'RELATÓRIO INTERNO — TÍTULOS EM COBRANÇA',
        `${horizonte.nome}  |  ${cnjCivel}`,
        '',
        'NF-e 4418  emissão 14/11/2025  venc. 12/12/2025  R$ 27.810,40',
        '  Itens: arroz tipo 1 (400 fardos), feijão carioca (180 fardos). Canhoto assinado por J. Pires, 14/11/2025, 16h22. Sem ressalva.',
        '',
        'NF-e 4492  emissão 29/11/2025  venc. 27/12/2025  R$ 31.204,88',
        '  Itens: farinha de trigo (220 fardos), óleo de soja (90 caixas). Canhoto assinado por J. Pires, 29/11/2025, 11h05. Sem ressalva. Contestação posterior alega avaria — sem e-mail na época.',
        '',
        'NF-e 4501  emissão 11/12/2025  venc. 08/01/2026  R$ 28.414,88',
        '  Itens: açúcar cristal (150 fardos), macarrão (210 caixas). Canhoto assinado por M. Alves, 11/12/2025, 15h40. Sem ressalva.',
        '',
        'Protesto: 2º Tabelião de Notas e de Protesto de Letras de São Paulo, 20/02/2026.',
        'Saldo contratual (principal): R$ 87.430,16.',
        '',
        'Pendência para a réplica: fotos da descarga (cliente prometeu para 18/08) e cadeia de e-mails do pedido.',
      ].join('\n'),
    );

    await popularEscritorio({
      prisma,
      admin,
      advogada,
      assistente,
      camila,
      horizonte,
      lucia,
      casoTrabalho,
      casoCivel,
    });

    const depois = await prisma.processo.count();
    const docs = await prisma.documento.count();
    const membros = await prisma.membroEquipe.count();
    const modelos = await prisma.modeloDocumento.count();
    console.log(
      `[demo] Pronto: ${depois} caso(s), ${docs} PDF(s), ${membros} membro(s), ${modelos} modelo(s).`,
    );
    console.log(`[demo] 1) ${cnjTrabalho} — ${casoTrabalho.titulo}`);
    console.log(`[demo] 2) ${cnjCivel} — ${casoCivel.titulo}`);
    console.log(`[demo] Cliente sem caso: ${lucia.nome} (consulta 19/08)`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[demo] Falha:', error);
  process.exit(1);
});
