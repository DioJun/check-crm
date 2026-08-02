/**
 * Site Service — Fluxo de criação rápida de sites de demonstração
 *
 * Regra de ouro: sites gerados aqui são APENAS demonstração/amostra
 * para vender o produto final. Nunca o produto completo.
 *
 * Este service cria o registro do site e (nos passos seguintes) será
 * alimentado pelo motor de templates + IA para gerar o HTML/CSS/JS.
 */
const prisma = require('../../core/lib/prisma');
const TemplatesService = require('./templates.service');
const SiteAIService = require('./site-ai.service');
const DeployService = require('./deploy.service');
const GitHubService = require('./github.service');
const SiteAlertsService = require('./site-alerts.service');

// Lista de templates/ramos disponíveis (os templates em si vêm no Passo 4)
const TEMPLATES = {
  barbearia: { label: 'Barbearia / Salão', icone: '🪒' },
  restaurante: { label: 'Restaurante / Delivery', icone: '🍕' },
  advocacia: { label: 'Advocacia', icone: '⚖️' },
  clinica: { label: 'Clínica / Dentista', icone: '🦷' },
  personal: { label: 'Personal / Academia', icone: '💪' },
  loja: { label: 'Loja / E-commerce', icone: '🛍️' },
  servico: { label: 'Serviço geral', icone: '🧰' },
};

// Sons/tons possíveis para a geração
const TONS = ['moderno', 'formal', 'divertido'];

/**
 * Sugere um template/ramo a partir dos dados do lead (heurística simples).
 * Será refinado pela IA no Passo 5.
 */
function sugerirTemplate(lead) {
  if (!lead) return 'servico';
  const texto = [
    lead.servico,
    lead.observacoes,
    lead.nome,
    lead.site,
  ].filter(Boolean).join(' ').toLowerCase();

  const regras = [
    { template: 'barbearia', keywords: ['barbearia', 'barba', 'cabelo', 'corte', 'salao', 'salão', 'cabeleireir'] },
    { template: 'restaurante', keywords: ['restaurante', 'pizza', 'lanche', 'hamburg', 'comida', 'delivery', 'sushi', 'food', 'bistro', 'cafeteria'] },
    { template: 'advocacia', keywords: ['advogad', 'advocacia', 'juridic', 'direito', 'oab', 'escritorio de advocacia', 'escritório de advocacia'] },
    { template: 'clinica', keywords: ['clinic', 'dentist', 'odontolog', 'medic', 'saude', 'saúde', 'fisio', 'estetic'] },
    { template: 'personal', keywords: ['personal', 'academia', 'trein', 'fitness', 'musculacao', 'musculação', 'crossfit', 'pilates'] },
    { template: 'loja', keywords: ['loja', 'ecommerce', 'e-commerce', 'vendas online', 'produtos', 'atacado', 'varejo', 'moda', 'roupa'] },
  ];

  for (const regra of regras) {
    if (regra.keywords.some((k) => texto.includes(k))) {
      return regra.template;
    }
  }
  return 'servico';
}

/**
 * Cria um site de demonstração para um lead (fluxo de criação rápida).
 * Aceita `instrucoes` (texto livre do vendedor) que a IA usa como prioridade.
 */
async function createQuick(leadId, dados = {}) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    const err = new Error('Lead não encontrado');
    err.status = 404;
    throw err;
  }

  const template = TEMPLATES[dados.template] ? dados.template : sugerirTemplate(lead);
  const cor = dados.cor || '#d4af37';
  const tom = TONS.includes(dados.tom) ? dados.tom : 'moderno';
  const instrucoes = typeof dados.instrucoes === 'string' ? dados.instrucoes.slice(0, 4000) : null;

  const nomeSite = dados.nomeSite
    || (lead.nome ? `${lead.nome.split(' ')[0]}` : '')
    || 'Site de demonstração';

  const site = await prisma.siteDemo.create({
    data: {
      leadId,
      status: 'gerado',
      template,
      ramo: TEMPLATES[template].label,
      cor,
      tom,
      nomeSite,
      instrucoes,
      arquivosJson: '{}',
      conteudo: JSON.stringify({
        lead: {
          nome: lead.nome,
          servico: lead.servico || '',
          cidade: lead.cidade || '',
          instagram: lead.instagram || '',
          site: lead.site || '',
          telefone: lead.telefone || '',
          observacoes: lead.observacoes || '',
        },
      }),
    },
  });

  return getById(site.id);
}

/**
 * Lista sites de demonstração (opcionalmente filtrando por lead/status/template/busca).
 */
async function list({ leadId, status, template, busca } = {}) {
  const where = {};
  if (leadId) where.leadId = leadId;
  if (status) where.status = status;
  if (template) where.template = template;
  if (busca) {
    where.OR = [
      { nomeSite: { contains: busca } },
      { lead: { is: { nome: { contains: busca } } } },
    ];
  }

  const sites = await prisma.siteDemo.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      lead: { select: { id: true, nome: true, telefone: true, servico: true, cidade: true } },
      _count: { select: { visitas: true } },
      visitas: { orderBy: { visitadoEm: 'desc' }, take: 5 },
    },
  });

  return sites.map((s) => ({
    ...s,
    ultimaVisita: s.visitas[0]?.visitadoEm || null,
    visitasRecentes: s.visitas,
  }));
}

/**
 * Retorna estatísticas da galeria: contagem por status + total de visitas + últimos acessos.
 * Alimenta os cards de funil na galeria.
 */
async function getStats() {
  const sites = await prisma.siteDemo.findMany({
    select: { status: true },
  });

  const contagem = {};
  for (const s of sites) {
    contagem[s.status] = (contagem[s.status] || 0) + 1;
  }

  const [totalVisitas, visitasRecentes, ultimosSites] = await Promise.all([
    prisma.siteVisita.count(),
    prisma.siteVisita.findMany({
      orderBy: { visitadoEm: 'desc' },
      take: 10,
      include: { siteDemo: { include: { lead: { select: { nome: true } } } } },
    }),
    prisma.siteDemo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { _count: { select: { visitas: true } } },
    }),
  ]);

  return {
    total: sites.length,
    porStatus: contagem,
    totalVisitas,
    visitasRecentes,
    ultimosSites: ultimosSites.map((s) => ({ id: s.id, nomeSite: s.nomeSite, status: s.status, visitas: s._count.visitas })),
  };
}

/**
 * Busca um site pelo id com dados do lead e visitas.
 */
async function getById(id) {
  return prisma.siteDemo.findUnique({
    where: { id },
    include: {
      lead: {
        select: {
          id: true, nome: true, telefone: true, servico: true, cidade: true,
          instagram: true, site: true, observacoes: true, porte: true, tempoMercado: true,
        },
      },
      visitas: { orderBy: { visitadoEm: 'desc' }, take: 20 },
    },
  });
}

/**
 * Atualiza dados do site (cor, tom, template, nome, status...).
 */
async function update(id, dados = {}) {
  const site = await prisma.siteDemo.findUnique({ where: { id } });
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }

  const camposPermitidos = ['cor', 'tom', 'template', 'nomeSite', 'status', 'link', 'observacoes', 'briefing', 'instrucoes'];
  const data = {};
  for (const campo of camposPermitidos) {
    if (dados[campo] !== undefined) {
      data[campo] = campo === 'instrucoes' ? String(dados[campo]).slice(0, 4000) : dados[campo];
    }
  }

  return prisma.siteDemo.update({ where: { id }, data });
}

/**
 * Remove um site de demonstração.
 */
async function remove(id) {
  const site = await prisma.siteDemo.findUnique({ where: { id } });
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }
  await prisma.siteDemo.delete({ where: { id } });
  return { ok: true };
}

/**
 * Renderiza o HTML do site a partir do template + dados do lead + IA.
 * Salva o HTML em arquivosJson para reutilização.
 * Retorna metadados sobre se usou IA e o aviso de fallback.
 *
 * @param {string} id
 * @param {object} [opts]
 * @param {boolean} [opts.usarIA=true] - se true, gera com IA; se false, usa template padrão
 * @param {object} [opts.overrides] - se fornecido, renderiza MANUALMENTE com estes overrides (edições do editor visual)
 */
async function render(id, { usarIA = true, overrides = null } = {}) {
  const site = await getById(id);
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }
  const lead = site.lead;
  const templateId = site.template || 'servico';

  let html;
  let conteudoOverrides = {};
  let usouIA = false;
  let aviso = null;

  if (overrides) {
    // Modo manual (editor visual): aplica os overrides fornecidos
    const dados = TemplatesService.buildContext(site, lead);
    conteudoOverrides = TemplatesService.sanitizeOverrides(overrides, templateId, dados);
    html = TemplatesService.renderTemplate(templateId, site, lead, conteudoOverrides).html;
    usouIA = false;
    aviso = 'Conteúdo editado manualmente.';
  } else {
    // Carregar perfil comportamental do lead (LeadIntelligence) se existir
    let intelligence = null;
    try {
      intelligence = await prisma.leadIntelligence.findUnique({ where: { leadId: lead.id } });
    } catch { /* sem perfil */ }

    // Gerar com IA (ou fallback offline)
    const resultado = usarIA
      ? await SiteAIService.generateSite(site, lead, intelligence)
      : { ...(await TemplateFallback(site, lead)), usouIA: false, aviso: 'Geração manual (sem IA)' };

    html = resultado.html;
    conteudoOverrides = resultado.overrides || {};
    usouIA = resultado.usouIA;
    aviso = resultado.aviso;
  }

  // Salvar o HTML gerado + overrides para preview/edição sem re-gerar
  let arquivos = {};
  try { arquivos = JSON.parse(site.arquivosJson || '{}'); } catch { arquivos = {}; }
  arquivos['index.html'] = html;
  arquivos['overrides.json'] = JSON.stringify(conteudoOverrides);
  await prisma.siteDemo.update({
    where: { id },
    data: { arquivosJson: JSON.stringify(arquivos) },
  });

  return { html, overrides: conteudoOverrides, usouIA, aviso, contexto: null, templateId };
}

/**
 * Retorna o conteúdo editável salvo do site (overrides) para o editor visual.
 * Se não houver overrides salvos, retorna os defaults do template.
 */
async function getConteudo(id) {
  const site = await getById(id);
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }

  let arquivos = {};
  try { arquivos = JSON.parse(site.arquivosJson || '{}'); } catch { arquivos = {}; }

  let overrides = {};
  if (arquivos['overrides.json']) {
    try { overrides = JSON.parse(arquivos['overrides.json']); } catch { overrides = {}; }
  }

  // Retorna também os defaults do template para o editor poder mostrar tudo
  const templateId = site.template || 'servico';
  const dados = TemplatesService.buildContext(site, site.lead);
  const base = TemplatesService.renderTemplate(templateId, site, site.lead);

  return { overrides, base: { templateId, ...base.contexto } };
}

// Fallback simples: template padrão com dados do lead (sem IA)
async function TemplateFallback(site, lead) {
  const dados = TemplatesService.buildContext(site, lead);
  const { html } = TemplatesService.renderTemplate(site.template || 'servico', site, lead);
  return { html, overrides: {}, contexto: dados };
}

/**
 * Retorna o HTML renderizado do site (para preview no editor).
 */
async function getHtml(id) {
  const site = await prisma.siteDemo.findUnique({ where: { id } });
  if (!site) return null;

  let arquivos = {};
  try { arquivos = JSON.parse(site.arquivosJson || '{}'); } catch { arquivos = {}; }

  // Se já tem HTML salvo, reutiliza; senão renderiza do zero
  if (arquivos['index.html']) return arquivos['index.html'];
  const { html } = await render(id);
  return html;
}

/**
 * Publica o site de demonstração no Vercel.
 * Renderiza o HTML (se ainda não existir) e faz o deploy direto.
 */
async function publicar(id, { token, teamId } = {}) {
  const site = await getById(id);
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }

  // Salvar token/teamId se fornecidos
  if (token || teamId) {
    await DeployService.saveConfig({ token, teamId });
  }

  // Garantir HTML renderizado
  let html = await getHtml(id);
  if (!html) {
    const r = await render(id, { usarIA: true });
    html = r.html;
  }

  // Deploy direto na Vercel
  const resultado = await DeployService.deploy(site, html);

  // Atualizar site com link + status
  await prisma.siteDemo.update({
    where: { id },
    data: {
      link: resultado.link,
      status: site.status === 'gerado' ? 'enviado' : site.status,
      enviadoEm: new Date(),
    },
  });

  return {
    ...resultado,
    siteId: id,
    mensagem: `Site publicado! Acesse: ${resultado.link}`,
  };
}

/**
 * Envia o código do site para o GitHub (backup/versionamento).
 * Renderiza o HTML (se ainda não existir) e publica o repo.
 */
async function enviarGitHub(id, { token, owner, repoNome } = {}) {
  const site = await getById(id);
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }

  // Garantir HTML renderizado
  let html = await getHtml(id);
  if (!html) {
    const r = await render(id, { usarIA: true });
    html = r.html;
  }

  const resultado = await GitHubService.publicarNoGitHub(site, html, { token, owner, repoNome });
  return { ...resultado, siteId: id };
}

/**
 * Registra uma visita ao site de demonstração (tracking).
 * Atualiza o contador + última visita do site e dispara alertas CRM.
 */
async function registrarVisita(id, { origem = 'direto' } = {}) {
  const site = await prisma.siteDemo.findUnique({ where: { id } });
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }

  await prisma.siteVisita.create({
    data: { siteDemoId: id, origem },
  });

  const atualizado = await prisma.siteDemo.update({
    where: { id },
    data: {
      visualizacoes: { increment: 1 },
      ultimaVisita: new Date(),
      status: site.status === 'enviado' ? 'visualizado' : site.status,
    },
    include: { lead: { select: { id: true, nome: true, telefone: true } } },
  });

  // Disparar alertas de CRM (visualizado, 3+ acessos)
  const alertas = await SiteAlertsService.processarVisita(atualizado, origem);

  return { ...atualizado, alertas };
}

/**
 * Marca o site como aprovado pelo lead e dispara alerta de fechamento.
 */
async function aprovarSite(id) {
  const site = await prisma.siteDemo.findUnique({
    where: { id },
    include: { lead: { select: { id: true, nome: true } } },
  });
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }

  const atualizado = await prisma.siteDemo.update({
    where: { id },
    data: { status: 'aprovado', aprovadoEm: new Date() },
    include: { lead: { select: { id: true, nome: true } } },
  });

  const alerta = await SiteAlertsService.processarAprovacao(atualizado);
  return { site: atualizado, alerta };
}

/**
 * Verifica sites enviados há 48h sem acesso → alertas de follow-up.
 */
async function verificarSitesSemAcesso() {
  const alertas = await SiteAlertsService.verificarSemAcesso();
  return { alertas, total: alertas.length };
}

module.exports = {
  TEMPLATES,
  TONS,
  createQuick,
  list,
  getById,
  update,
  remove,
  render,
  getHtml,
  getConteudo,
  publicar,
  enviarGitHub,
  getStats,
  registrarVisita,
  aprovarSite,
  verificarSitesSemAcesso,
  sugerirTemplate,
};
