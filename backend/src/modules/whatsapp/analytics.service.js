/**
 * CAMADA 4 — Analytics e Insights Globais
 *
 * Coleta métricas de performance da IA e do uso do sistema:
 *   - Taxa de uso/aceite das sugestões da IA
 *   - Conversão por tipo de abordagem (formal/informal, longa/curta)
 *   - Melhor horário para contato por segmento
 *   - Palavras/frases que mais geram resposta positiva/negativa
 *   - Tempo médio entre primeiro contato e fechamento
 *
 * Os insights alimentam a IA como regras no prompt (via Configuracao `ai:insights`).
 */

const prisma = require('../../core/lib/prisma');
const { tokenize } = require('./knowledge.service');

// ============ HELPERS ============

function safeParse(json, fallback) {
  try { return JSON.parse(json || fallback); } catch { return fallback; }
}

// ============ MÉTRICAS PRINCIPAIS ============

/**
 * Métricas agregadas do feedback loop:
 * - totalSugestoes, aceitas (copiou sem edição), editadas, ignoradas
 * - taxas (%)
 * - resposta positiva/negativa
 */
async function getFeedbackMetrics({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await prisma.aiSuggestionLog.findMany({
    where: { createdAt: { gte: since } },
  });

  const total = logs.length;
  const usadas = logs.filter((l) => l.actionTaken !== 'visualizou' && l.actionTaken !== 'ignorou');
  const editadas = usadas.filter((l) => {
    try { return l.diff && JSON.parse(l.diff).mudou; } catch { return false; }
  });
  const aceitas = usadas.filter((l) => !editadas.includes(l));
  const ignoradas = logs.filter((l) => l.actionTaken === 'ignorou');

  const comResultado = logs.filter((l) => l.result !== 'pendente');
  const positivas = comResultado.filter((l) => l.result === 'positivo');
  const negativas = comResultado.filter((l) => l.result === 'negativo');

  return {
    total,
    aceitas: aceitas.length,
    editadas: editadas.length,
    ignoradas: ignoradas.length,
    taxaUso: usadas.length ? Math.round((usadas.length / Math.max(total, 1)) * 100) : 0,
    taxaAceite: usadas.length ? Math.round((aceitas.length / usadas.length) * 100) : 0,
    taxaEdicao: usadas.length ? Math.round((editadas.length / usadas.length) * 100) : 0,
    positivas: positivas.length,
    negativas: negativas.length,
    taxaRespostaPositiva: comResultado.length ? Math.round((positivas.length / comResultado.length) * 100) : 0,
  };
}

// ============ PALAVRAS QUE GERAM RESPOSTA +/- ============

/**
 * Analisa sugestões que geraram resposta positiva vs negativa
 * e extrai as palavras mais frequentes em cada grupo.
 */
async function getWordAnalysis({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await prisma.aiSuggestionLog.findMany({
    where: { createdAt: { gte: since }, result: { in: ['positivo', 'negativo'] } },
  });

  const positivas = [];
  const negativas = [];
  logs.forEach((l) => {
    const texto = l.vendedorText || l.suggestionText || '';
    if (l.result === 'positivo') positivas.push(texto);
    else negativas.push(texto);
  });

  const contarPalavras = (textos) => {
    const freq = {};
    textos.forEach((t) => {
      tokenize(t).forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
  };

  return {
    palavrasPositivas: contarPalavras(positivas),
    palavrasNegativas: contarPalavras(negativas),
    totalPositivas: positivas.length,
    totalNegativas: negativas.length,
  };
}

// ============ MELHOR HORÁRIO POR SEGMENTO ============

/**
 * Analisa interações dos leads para identificar melhor horário por segmento (servico).
 * Usa os dados de LeadIntelligence (activeHours) + status fechado para correlacionar.
 */
async function getBestHoursBySegment() {
  const intelligence = await prisma.leadIntelligence.findMany({
    include: { lead: { select: { servico: true, status: true } } },
  });

  // Agrupa por segmento (servico) -> horas ativas
  const porSegmento = {};
  intelligence.forEach((i) => {
    if (!i.activeHours) return;
    const servico = i.lead?.servico || 'outros';
    if (!porSegmento[servico]) porSegmento[servico] = { ocorrencias: {}, fechados: 0, total: 0 };
    porSegmento[servico].ocorrencias[i.activeHours] = (porSegmento[servico].ocorrencias[i.activeHours] || 0) + 1;
    porSegmento[servico].total += 1;
    if (i.lead?.status === 'fechado') porSegmento[servico].fechados += 1;
  });

  // Melhor hora de cada segmento
  const resultado = [];
  Object.entries(porSegmento).forEach(([servico, dados]) => {
    const melhor = Object.entries(dados.ocorrencias).sort((a, b) => b[1] - a[1])[0];
    resultado.push({
      segmento: servico,
      melhorHorario: melhor ? melhor[0] : null,
      leads: dados.total,
      fechados: dados.fechados,
    });
  });

  return resultado.sort((a, b) => b.leads - a.leads);
}

// ============ TEMPO MÉDIO PRIMEIRO CONTATO → FECHAMENTO ============

/**
 * Calcula o tempo médio entre a primeira interação e o fechamento do lead.
 */
async function getAvgTimeToClose() {
  const leads = await prisma.lead.findMany({
    where: { status: 'fechado' },
    include: { interacoes: { orderBy: { data: 'asc' }, take: 1 } },
  });

  if (!leads.length) return { mediaDias: null, amostra: 0 };

  const tempos = leads.map((l) => {
    const primeira = l.interacoes[0]?.data || l.dataEntrada;
    const fechamento = l.ultimaInteracao || l.dataEntrada;
    return (new Date(fechamento) - new Date(primeira)) / (24 * 60 * 60 * 1000);
  }).filter((t) => t >= 0);

  const media = tempos.length ? tempos.reduce((s, t) => s + t, 0) / tempos.length : null;
  return { mediaDias: media ? Math.round(media * 10) / 10 : null, amostra: tempos.length };
}

// ============ CONVERSÃO POR ABORDAGEM ============

/**
 * Correlaciona características da sugestão (tamanho, termina com pergunta)
 * com o resultado positivo/negativo.
 */
async function getApproachConversion({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await prisma.aiSuggestionLog.findMany({
    where: { createdAt: { gte: since }, result: { in: ['positivo', 'negativo'] } },
  });

  const stats = {
    curta: { pos: 0, neg: 0 },
    longa: { pos: 0, neg: 0 },
    comPergunta: { pos: 0, neg: 0 },
    semPergunta: { pos: 0, neg: 0 },
  };

  logs.forEach((l) => {
    const texto = l.vendedorText || l.suggestionText || '';
    const curta = texto.length < 120;
    const temPergunta = /[?¿]/.test(texto) || /\b(posso|quer|gostaria|vamos|bora|pode)\b/i.test(texto);
    const bucket = l.result === 'positivo' ? 'pos' : 'neg';

    if (curta) stats.curta[bucket]++; else stats.longa[bucket]++;
    if (temPergunta) stats.comPergunta[bucket]++; else stats.semPergunta[bucket]++;
  });

  const taxa = (s) => (s.pos + s.neg ? Math.round((s.pos / (s.pos + s.neg)) * 100) : null);

  return {
    curta: { ...stats.curta, taxaConversao: taxa(stats.curta) },
    longa: { ...stats.longa, taxaConversao: taxa(stats.longa) },
    comPergunta: { ...stats.comPergunta, taxaConversao: taxa(stats.comPergunta) },
    semPergunta: { ...stats.semPergunta, taxaConversao: taxa(stats.semPergunta) },
  };
}

// ============ INSIGHTS PARA A IA ============

const INSIGHTS_KEY = 'ai:insights';

/**
 * Gera insights globais e salva em Configuracao para alimentar o prompt da IA.
 */
async function generateInsights({ days = 30 } = {}) {
  const [feedback, approach, words] = await Promise.all([
    getFeedbackMetrics({ days }),
    getApproachConversion({ days }),
    getWordAnalysis({ days }),
  ]);

  const insights = [];

  // Melhor abordagem (curta vs longa, pergunta vs sem pergunta)
  const melhorComprimento = (approach.curta.taxaConversao ?? 0) >= (approach.longa.taxaConversao ?? 0) ? 'curta' : 'longa';
  const melhorPergunta = (approach.comPergunta.taxaConversao ?? 0) >= (approach.semPergunta.taxaConversao ?? 0);

  if (melhorComprimento === 'curta') insights.push('Respostas CURTAS convertem mais');
  else insights.push('Respostas mais DETALHADAS convertem mais');

  if (melhorPergunta) insights.push('Terminar com PERGUNTA estimula resposta');
  else insights.push('Terminar sem pergunta funciona melhor');

  // Palavras que mais geram resposta positiva
  if (words.palavrasPositivas.length >= 3 && words.totalPositivas >= 2) {
    const top = words.palavrasPositivas.slice(0, 3).map(([w]) => w).join(', ');
    insights.push(`Palavras que geram resposta positiva: ${top}`);
  }

  const params = { insights, geradoEm: new Date().toISOString() };
  await prisma.configuracao.upsert({
    where: { chave: INSIGHTS_KEY },
    update: { valor: JSON.stringify(params) },
    create: { chave: INSIGHTS_KEY, valor: JSON.stringify(params) },
  });

  return params;
}

/** Formata os insights como seção para o prompt da IA */
async function buildInsightsSection() {
  try {
    const row = await prisma.configuracao.findUnique({ where: { chave: INSIGHTS_KEY } });
    if (!row) return '';
    const data = safeParse(row.valor, {});
    const insights = data.insights || [];
    if (!insights.length) return '';
    return `## INSIGHTS GLOBAIS (aprendidos com dados reais)\n${insights.map((i) => `- ${i}`).join('\n')}\n`;
  } catch {
    return '';
  }
}

// ============ DASHBOARD COMPLETO ============

/**
 * Retorna todos os dados para o dashboard de performance da IA.
 */
async function getDashboard({ days = 30 } = {}) {
  const [feedback, words, bestHours, timeToClose, approach, insights] = await Promise.all([
    getFeedbackMetrics({ days }),
    getWordAnalysis({ days }),
    getBestHoursBySegment(),
    getAvgTimeToClose(),
    getApproachConversion({ days }),
    generateInsights({ days }),
  ]);

  return {
    periodoDias: days,
    feedback,
    words,
    bestHours,
    timeToClose,
    approach,
    insights,
  };
}

module.exports = {
  getFeedbackMetrics,
  getWordAnalysis,
  getBestHoursBySegment,
  getAvgTimeToClose,
  getApproachConversion,
  generateInsights,
  buildInsightsSection,
  getDashboard,
  INSIGHTS_KEY,
};
