/**
 * Motor de Sugestão de Ofertas — Catálogo + Matching
 *
 * Detecta o interesse do lead durante a conversa, cruza com o catálogo
 * de produtos/serviços e sugere a oferta mais relevante para o vendedor.
 *
 * ⚠️ NUNCA envia oferta automaticamente — apenas sugere + gera proposta
 * formatada que o vendedor copia e envia manualmente.
 */

const prisma = require('../../core/lib/prisma');
const { normalize } = require('./patterns.service');

// ============ CATEGORIAS E KEYWORDS DE INTERESSE ============
// Cada categoria mapeia para tags do catálogo de produtos.
const CATEGORIAS = [
  {
    tag: 'site',
    label: 'Site Profissional',
    keywords: ['site', 'website', 'pagina', 'loja virtual', 'landing', 'presenca online', 'e-commerce', 'ecommerce', 'trafego pago para site'],
  },
  {
    tag: 'crm',
    label: 'CRM',
    keywords: ['crm', 'organizar', 'organizar minha equipe', 'gerenciar clientes', 'gestao de clientes', 'planilha', 'controle de leads', 'agenda de contatos', 'organizar atendimento', 'cadastro de cliente'],
  },
  {
    tag: 'automacao',
    label: 'Automação',
    keywords: ['automatizar', 'automacao', 'whatsapp automatico', 'resposta automatica', 'robo', 'bot', 'mensagem automatica', 'otimizar tempo', 'agilizar atendimento'],
  },
  {
    tag: 'marketing',
    label: 'Marketing Digital',
    keywords: ['marketing', 'divulgar', 'divulgacao', 'anunciar', 'anuncio', 'instagram', 'redes sociais', 'trafego pago', 'trafego', 'seguidores', 'midia social', 'conteudo'],
  },
  {
    tag: 'software',
    label: 'Software/Desenvolvimento',
    keywords: ['sistema', 'software', 'aplicativo', 'app', 'desenvolver', 'desenvolvimento', 'site com sistema', 'agendamento online', 'reserva', 'plataforma'],
  },
];

// ============ CATÁLOGO PADRÃO (seed) ============
// Produtos que serão criados no banco na primeira execução.
const PRODUTOS_PADRAO = [
  {
    nome: 'Site Profissional',
    descricao: 'Site moderno e otimizado para o Google, com WhatsApp integrado e design sob medida para o seu negócio.',
    preco: 1490,
    condicoes: 'Em até 3x sem juros',
    tags: JSON.stringify(['site', 'presenca_online']),
    publicoAlvo: 'Empresas que ainda não têm presença online ou têm site desatualizado.',
  },
  {
    nome: 'CRM Checkmate',
    descricao: 'Sistema completo para organizar seus clientes, acompanhar vendas e não perder nenhum lead. Funciona no seu computador.',
    preco: 97,
    condicoes: 'Assinatura mensal',
    tags: JSON.stringify(['crm', 'gestao_equipe']),
    publicoAlvo: 'Empresas que usam planilhas ou cadernos para controlar clientes.',
  },
  {
    nome: 'Automação de WhatsApp',
    descricao: 'Respostas automáticas e organização do atendimento no WhatsApp para responder mais rápido e vender mais.',
    preco: 490,
    condicoes: 'Pagamento único',
    tags: JSON.stringify(['automacao', 'whatsapp']),
    publicoAlvo: 'Negócios que recebem muitas mensagens no WhatsApp e demoram para responder.',
  },
  {
    nome: 'Gestão de Tráfego Pago',
    descricao: 'Campanhas de anúncios no Google e Instagram para atrair clientes novos todos os dias para o seu negócio.',
    preco: 990,
    condicoes: 'Investimento mensal + gestão',
    tags: JSON.stringify(['marketing', 'trafego', 'automacao']),
    publicoAlvo: 'Empresas que querem mais clientes de forma previsível e mensurável.',
  },
  {
    nome: 'Marketing Digital Completo',
    descricao: 'Gestão de redes sociais, conteúdo e campanhas para fortalecer sua marca e gerar vendas consistentes.',
    preco: 790,
    condicoes: 'Investimento mensal',
    tags: JSON.stringify(['marketing', 'instagram', 'conteudo']),
    publicoAlvo: 'Negócios que querem presença forte no Instagram e Google.',
  },
];

/** Garante que o catálogo padrão exista no banco (seed idempotente) */
async function ensureDefaultCatalog() {
  for (const p of PRODUTOS_PADRAO) {
    const existe = await prisma.produto.findFirst({ where: { nome: p.nome } });
    if (!existe) {
      await prisma.produto.create({ data: p });
    }
  }
}

// ============ DETECÇÃO DE INTERESSE ============

/**
 * Extrai interesses/categorias das mensagens do lead.
 * Retorna [{ tag, label, keywordEncontrada, evidencia }]
 */
function detectInterests(messages) {
  const text = normalize(
    (messages || [])
      .filter((m) => m.from === 'lead')
      .map((m) => m.text)
      .join(' ')
  );

  if (!text) return [];

  const encontrados = [];
  for (const categoria of CATEGORIAS) {
    for (const kw of categoria.keywords) {
      const norm = normalize(kw);
      if (norm && text.includes(norm)) {
        encontrados.push({
          tag: categoria.tag,
          label: categoria.label,
          keyword: kw,
        });
        break; // uma keyword por categoria basta
      }
    }
  }
  return encontrados;
}

// ============ MATCHING COM CATÁLOGO ============

/**
 * Cruza interesses detectados com o catálogo de produtos.
 * Retorna [{ produto, interesses: [...], motivo, proposta }]
 */
async function matchOffers(interests) {
  if (!interests || !interests.length) return [];

  const catalog = await prisma.produto.findMany({ where: { ativo: true } });
  if (!catalog.length) return [];

  const matches = [];
  const tagsInteresse = new Set(interests.map((i) => i.tag));

  for (const produto of catalog) {
    let produtoTags;
    try { produtoTags = JSON.parse(produto.tags || '[]'); } catch { produtoTags = []; }

    // Encontra quais interesses batem com as tags do produto
    const batem = interests.filter((i) => produtoTags.includes(i.tag));

    if (batem.length > 0) {
      matches.push({
        produto: {
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao,
          preco: produto.preco,
          condicoes: produto.condicoes,
          publicoAlvo: produto.publicoAlvo,
        },
        interesses: batem.map((b) => b.label),
        motivo: `Lead mencionou "${batem[0].keyword}" — combina com ${produto.nome}.`,
        proposta: buildProposal(produto, batem),
      });
    }
  }

  // Ordena por número de interesses batidos (mais relevante primeiro)
  matches.sort((a, b) => b.interesses.length - a.interesses.length);
  return matches.slice(0, 3);
}

/**
 * Gera uma proposta formatada pronta para o vendedor copiar e enviar.
 */
function buildProposal(produto, interesses) {
  const contexto = interesses && interesses.length
    ? `já que você mencionou interesse em ${interesses.map((i) => i.label.toLowerCase()).join(' e ')}`
    : 'pensando no que conversamos';

  return `Olá! Pensando no que conversamos ${contexto}, preparei uma proposta para você.

📦 *${produto.nome}*
${produto.descricao}

💰 Investimento: *R$ ${produto.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*
${produto.condicoes ? `📌 ${produto.condicoes}` : ''}

${produto.publicoAlvo ? `✅ *Ideal para:* ${produto.publicoAlvo}\n` : ''}Se fizer sentido pra você, posso detalhar melhor. O que acha? 😊`;
}

// ============ REGISTRO DE OFERTAS ============

/**
 * Registra a oferta sugerida para um lead (LeadProduto).
 * Se já existir (mesmo lead+produto), atualiza o contexto/status.
 */
async function recordOffer(leadId, produtoId, contexto) {
  const exists = await prisma.leadProduto.findUnique({
    where: { leadId_produtoId: { leadId, produtoId } },
  });

  if (exists) {
    return prisma.leadProduto.update({
      where: { leadId_produtoId: { leadId, produtoId } },
      data: { contexto: contexto || exists.contexto, status: 'sugerido', createdAt: new Date() },
    });
  }

  return prisma.leadProduto.create({
    data: { leadId, produtoId, contexto: contexto || null },
  });
}

/**
 * Registra ação do vendedor sobre uma oferta (usou/ignorou).
 */
async function setOfferStatus(leadId, produtoId, status) {
  const valido = ['sugerido', 'usou', 'ignorou'];
  if (!valido.includes(status)) throw new Error('Status inválido');
  return prisma.leadProduto.update({
    where: { leadId_produtoId: { leadId, produtoId } },
    data: { status },
  });
}

/**
 * Fluxo completo: detecta interesse, cruza com catálogo, registra e retorna ofertas.
 * @param {Array} messages - [{ from, text, time }]
 * @param {Object|null} lead - lead do CRM (opcional; se informado, registra histórico)
 */
async function suggestOffers(messages, lead) {
  await ensureDefaultCatalog();
  const interests = detectInterests(messages);

  if (!interests.length) return { interests: [], ofertas: [] };

  const ofertas = await matchOffers(interests);

  // Registrar histórico (se houver lead)
  if (lead && ofertas.length) {
    const contexto = interests.map((i) => i.keyword).join('; ');
    for (const oferta of ofertas) {
      await recordOffer(lead.id, oferta.produto.id, contexto);
    }
  }

  return { interests, ofertas };
}

/** Lista o catálogo de produtos ativos */
async function getCatalog() {
  await ensureDefaultCatalog();
  return prisma.produto.findMany({
    where: { ativo: true },
    orderBy: { createdAt: 'asc' },
  });
}

module.exports = {
  PRODUTOS_PADRAO,
  ensureDefaultCatalog,
  detectInterests,
  matchOffers,
  buildProposal,
  recordOffer,
  setOfferStatus,
  suggestOffers,
  getCatalog,
};
