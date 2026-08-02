/**
 * CAMADA 5 — Aprendizado Entre Vendedores (se houver equipe)
 *
 * Se um vendedor tem 80% de taxa de conversão e outro tem 30%,
 * o sistema analisa o que o bom vendedor faz diferente e aplica
 * o "padrão do top performer" como referência para todos.
 *
 * ⚠️ Single-user atual: o vendedor padrão é "principal". A infraestrutura
 * está pronta para multi-vendedor — basta informar vendedorId nas requisições.
 */

const prisma = require('../../core/lib/prisma');
const { tokenize } = require('./knowledge.service');
const feedbackService = require('./feedback.service');

const VENDEDOR_PADRAO = 'principal';

// ============ REGISTRO ============

/**
 * Define/garante o vendedor atual no sistema.
 * Como não há login, usamos "principal" por padrão (multi-vendedor futuro).
 */
function vendedorAtual(vendedorId) {
  return vendedorId || VENDEDOR_PADRAO;
}

// ============ PERFORMANCE POR VENDEDOR ============

/**
 * Calcula métricas de performance por vendedor a partir dos AiSuggestionLog.
 * Retorna [{ vendedorId, total, aceites, editadas, positivas, negativas, taxaConversao, taxaAceite, palavrasChave }]
 */
async function getPerformanceByVendedor({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await prisma.aiSuggestionLog.findMany({
    where: { createdAt: { gte: since } },
  });

  const porVendedor = {};
  logs.forEach((l) => {
    const vid = l.vendedorId || VENDEDOR_PADRAO;
    if (!porVendedor[vid]) {
      porVendedor[vid] = { vendedorId: vid, total: 0, aceites: 0, editadas: 0, positivas: 0, negativas: 0, textos: [] };
    }
    const v = porVendedor[vid];
    v.total++;

    // Aceite (copiou sem edição)
    let mudou = false;
    try { mudou = l.diff ? JSON.parse(l.diff).mudou : false; } catch { mudou = false; }
    if (l.actionTaken === 'copiou' || (l.actionTaken === 'editou' && !mudou)) v.aceites++;
    if (mudou) v.editadas++;

    if (l.result === 'positivo') v.positivas++;
    if (l.result === 'negativo') v.negativas++;

    v.textos.push(l.vendedorText || l.suggestionText || '');
  });

  return Object.values(porVendedor).map((v) => {
    const comResultado = v.positivas + v.negativas;
    const resumo = {
      vendedorId: v.vendedorId,
      total: v.total,
      aceites: v.aceites,
      editadas: v.editadas,
      positivas: v.positivas,
      negativas: v.negativas,
      taxaAceite: v.total ? Math.round((v.aceites / v.total) * 100) : 0,
      taxaConversao: comResultado ? Math.round((v.positivas / comResultado) * 100) : 0,
      palavrasChave: extractKeywords(v.textos),
    };
    // Guarda os textos internamente (não expostos na API, usados p/ padrão)
    resumo._textos = v.textos;
    return resumo;
  }).sort((a, b) => b.taxaConversao - a.taxaConversao || b.taxaAceite - a.taxaAceite);
}

/** Extrai as palavras mais usadas pelo vendedor (para comparar abordagens) */
function extractKeywords(textos) {
  const freq = {};
  textos.forEach((t) => {
    tokenize(t).forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
}

// ============ ANÁLISE COMPARATIVA ============

/**
 * Identifica o top performer e compara com os demais.
 * Retorna o "padrão do top performer" para ser aplicado como referência.
 */
async function analyzeTopPerformer({ days = 30 } = {}) {
  const performance = await getPerformanceByVendedor({ days });

  if (performance.length < 2) {
    // Sem equipe: ainda assim registra o padrão do vendedor único como referência
    if (performance.length === 1) {
      return {
        temEquipe: false,
        topPerformer: performance[0],
        demais: [],
        padraoTop: buildPatternFromVendedor(performance[0], performance[0]._textos || []),
        mensagem: 'Sistema single-user. Padrão do vendedor registrado como referência. Com equipe, a comparação será automática.',
      };
    }
    return {
      temEquipe: false,
      topPerformer: null,
      demais: [],
      padraoTop: null,
      mensagem: 'Sem dados suficientes de vendedores.',
    };
  }

  const topPerformer = performance[0];
  const demais = performance.slice(1);

  return {
    temEquipe: true,
    topPerformer,
    demais,
    padraoTop: buildPatternFromVendedor(topPerformer, topPerformer._textos || []),
    mensagem: `Top performer: ${topPerformer.vendedorId} (${topPerformer.taxaConversao}% conversão).`,
  };
}

/**
 * Constrói o padrão de abordagem de um vendedor a partir dos textos que ele enviou.
 * Detecta: tamanho médio, usa pergunta final, palavras-chave, tom.
 */
function buildPatternFromVendedor(vendedor, textos = []) {
  if (!textos.length) return null;

  const tamanhos = textos.map((t) => t.length).filter((l) => l > 0);
  const tamMedio = tamanhos.length ? Math.round(tamanhos.reduce((s, l) => s + l, 0) / tamanhos.length) : 0;
  const comPergunta = textos.filter((t) => /[?¿]/.test(t) || /\b(posso|quer|gostaria|vamos|bora|pode)\b/i.test(t)).length;
  const taxaPergunta = textos.length ? Math.round((comPergunta / textos.length) * 100) : 0;

  // Tom predominante
  let informal = 0, formal = 0;
  const infW = ['valeu', 'blz', 'kkk', 'mano', 'cara', 'bora', 'top'];
  const forW = ['prezado', 'gostaria', 'senhor', 'conforme', 'encaminhar'];
  textos.forEach((t) => {
    const tl = t.toLowerCase();
    if (infW.some((w) => tl.includes(w))) informal++;
    if (forW.some((w) => tl.includes(w))) formal++;
  });

  return {
    tamanhoMedio: tamMedio,
    estilo: tamMedio < 120 ? 'curto' : tamMedio > 300 ? 'longo' : 'medio',
    taxaPerguntaFinal: taxaPergunta,
    tom: informal > formal ? 'informal' : formal > informal ? 'formal' : 'neutro',
    palavrasChave: vendedor.palavrasChave || [],
  };
}

// ============ APLICAR PADRÃO DO TOP PERFORMER ============

const TOP_PATTERN_KEY = 'ai:top-pattern';

/**
 * Analisa o top performer e aplica o padrão dele como parâmetros globais da IA.
 * Salva em Configuracao e mescla com os params do feedback.
 */
async function applyTopPerformerPattern({ days = 30, vendedorId = null } = {}) {
  const analysis = await analyzeTopPerformer({ days });

  // Aplica apenas se houver um padrão identificável
  if (!analysis.padraoTop) {
    return { ...analysis, aplicado: false, motivo: 'Sem padrão identificável' };
  }

  const padrao = analysis.padraoTop;
  const params = await feedbackService.getParams();

  // Mapeia o padrão do top performer para parâmetros da IA
  const novoParams = { ...params };
  if (padrao.estilo === 'curto') novoParams.respostaCurta = true;
  if (padrao.estilo === 'longo') novoParams.respostaCurta = false;
  if (padrao.taxaPerguntaFinal >= 60) novoParams.gerarPerguntaFinal = true;
  if (padrao.tom === 'informal') novoParams.tomPadrao = 'informal';
  if (padrao.tom === 'formal') novoParams.tomPadrao = 'formal';

  // Salva o padrão do top performer
  await prisma.configuracao.upsert({
    where: { chave: TOP_PATTERN_KEY },
    update: { valor: JSON.stringify({ ...padrao, topPerformerId: analysis.topPerformer?.vendedorId, atualizadoEm: new Date().toISOString() }) },
    create: { chave: TOP_PATTERN_KEY, valor: JSON.stringify({ ...padrao, topPerformerId: analysis.topPerformer?.vendedorId, atualizadoEm: new Date().toISOString() }) },
  });

  // Atualiza os params globais da IA
  await feedbackService.saveParams(novoParams);

  return {
    ...analysis,
    aplicado: true,
    parametrosAplicados: novoParams,
  };
}

/**
 * Lê o padrão do top performer salvo (para exibir no dashboard).
 */
async function getTopPerformerPattern() {
  try {
    const row = await prisma.configuracao.findUnique({ where: { chave: TOP_PATTERN_KEY } });
    return row ? JSON.parse(row.valor) : null;
  } catch {
    return null;
  }
}

module.exports = {
  VENDEDOR_PADRAO,
  vendedorAtual,
  getPerformanceByVendedor,
  analyzeTopPerformer,
  buildPatternFromVendedor,
  applyTopPerformerPattern,
  getTopPerformerPattern,
  TOP_PATTERN_KEY,
};
