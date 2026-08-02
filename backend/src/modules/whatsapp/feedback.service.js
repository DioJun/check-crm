/**
 * CAMADA 2 — Feedback Loop com o Vendedor (Aprendizado por Correção)
 *
 * Registra:
 *   - Sugestão original da IA
 *   - Texto final que o vendedor enviou (se editou)
 *   - Diferença entre os dois (diff)
 *   - Resultado da interação (positivo/negativo/ignorou/pendente)
 *   - Tempo até resposta do lead
 *
 * E usa os dados para auto-ajustar os parâmetros do prompt da IA:
 *   - Vendedor sempre encurta → reduz comprimento padrão
 *   - Vendedor sempre deixa mais informal → ajusta tom padrão
 *   - Sugestões que geram resposta positiva → reforçar padrão
 *
 * ⚠️ Apenas registra e ajusta parâmetros — nunca envia mensagens.
 */

const prisma = require('../../core/lib/prisma');

// ============ DIFF (comparação simples) ============

/**
 * Calcula uma diferença simples entre o texto original e o final.
 * Retorna { adicionou, removeu, encurtou, alongou, mudou, ratio }
 */
function computeDiff(original, final) {
  const orig = (original || '').trim();
  const fin = (final || '').trim();

  if (!orig && !fin) return { mudou: false };
  if (orig === fin) return { mudou: false, igual: true };

  const origWords = orig.split(/\s+/).filter(Boolean);
  const finWords = fin.split(/\s+/).filter(Boolean);

  const origSet = new Set(origWords.map((w) => w.toLowerCase()));
  const finSet = new Set(finWords.map((w) => w.toLowerCase()));

  const adicionou = finWords.filter((w) => !origSet.has(w.toLowerCase())).slice(0, 20);
  const removeu = origWords.filter((w) => !finSet.has(w.toLowerCase())).slice(0, 20);

  return {
    mudou: true,
    adicionou,
    removeu,
    encurtou: finWords.length < origWords.length,
    alongou: finWords.length > origWords.length,
    deltaPalavras: finWords.length - origWords.length,
    comprimentoOriginal: orig.length,
    comprimentoFinal: fin.length,
  };
}

/** Extrai o "tom" de um texto (informal vs formal) para padrões */
function detectToneFromText(text) {
  const t = (text || '').toLowerCase();
  const informais = ['valeu', 'blz', 'kkk', 'haha', 'mano', 'cara', 'rs', 'tranquilo', 'fechou', 'top', 'massa'];
  const formais = ['prezado', 'senhor', 'gostaria', 'portanto', 'encaminhar', 'solicitar', 'conforme', 'atenciosamente'];
  let informal = 0, formal = 0;
  informais.forEach((w) => { if (t.includes(w)) informal++; });
  formais.forEach((w) => { if (t.includes(w)) formal++; });
  if (informal > formal) return 'informal';
  if (formal > informal) return 'formal';
  return null;
}

// ============ REGISTRO ============

/**
 * Registra uma sugestão da IA gerada (antes do vendedor agir).
 * @param {Object} params - { leadId, contexto?, suggestionText, vendedorId? }
 */
async function registerSuggestion({ leadId, contexto = 'whatsapp', suggestionText, vendedorId = null, optOut = false }) {
  if (!leadId || !suggestionText) throw new Error('leadId e suggestionText são obrigatórios');
  return prisma.aiSuggestionLog.create({
    data: { leadId, contexto, suggestionText, vendedorId, optOut },
  });
}

/**
 * Registra a ação do vendedor sobre uma sugestão (copiou/editou/ignorou).
 * Se o texto final difere do original, calcula o diff.
 * @param {Object} params - { id, actionTaken, vendedorText? }
 */
async function registerAction({ id, actionTaken, vendedorText = null }) {
  const log = await prisma.aiSuggestionLog.findUnique({ where: { id } });
  if (!log) throw new Error('Sugestão não encontrada');

  const diff = vendedorText ? computeDiff(log.suggestionText, vendedorText) : null;

  return prisma.aiSuggestionLog.update({
    where: { id },
    data: {
      actionTaken,
      vendedorText: vendedorText || log.suggestionText,
      diff: diff ? JSON.stringify(diff) : null,
    },
  });
}

/**
 * Atualiza o resultado da interação com o lead.
 * @param {Object} params - { id, result, responseTimeMin? }
 */
async function updateResult({ id, result, responseTimeMin = null }) {
  const valido = ['positivo', 'negativo', 'ignorou', 'pendente'];
  if (!valido.includes(result)) throw new Error(`Resultado inválido: ${result}`);
  return prisma.aiSuggestionLog.update({
    where: { id },
    data: { result, responseTimeMin },
  });
}

// ============ AUTO-AJUSTE ============

/**
 * Analisa os logs recentes e ajusta os parâmetros do prompt.
 * Regras:
 *   - Se vendedor encurta em >60% das edições → reduzir comprimento padrão
 *   - Se vendedor sempre deixa mais informal → ajustar tom padrão
 *   - Se sugestões não-editadas geram resposta positiva → reforçar não editar
 *
 * Salva em Configuracao (chave `ai:params`) + AiPerformanceMetrics.
 */
async function analyzeAndAdjust({ leadId = null, days = 7 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where = { createdAt: { gte: since } };
  if (leadId) where.leadId = leadId;

  const logs = await prisma.aiSuggestionLog.findMany({ where });
  if (!logs.length) return { message: 'Sem dados para análise', params: null };

  // ---- Métricas base ----
  const total = logs.length;
  const usados = logs.filter((l) => l.actionTaken !== 'visualizou' && l.actionTaken !== 'ignorou');
  const editados = usados.filter((l) => l.diff && JSON.parse(l.diff).mudou);
  const copiados = usados.filter((l) => l.actionTaken === 'copiou' && !editados.includes(l));
  const resultados = logs.filter((l) => l.result !== 'pendente');
  const positivos = resultados.filter((l) => l.result === 'positivo');

  const accuracyRate = total ? (copiados.length / Math.max(usados.length, 1)) * 100 : 0;
  const editRate = usados.length ? (editados.length / usados.length) * 100 : 0;
  const positiveRate = resultados.length ? (positivos.length / resultados.length) * 100 : 0;

  const tempos = resultados.map((l) => l.responseTimeMin).filter((t) => t !== null && t !== undefined);
  const avgResponseTimeMin = tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : 0;

  // ---- Padrões detectados ----
  const patterns = [];

  // Padrão de encurtamento
  const encurtou = editados.filter((l) => { try { return JSON.parse(l.diff).encurtou; } catch { return false; } });
  if (editados.length >= 2 && encurtou.length / editados.length >= 0.6) {
    patterns.push('Vendedor costuma ENCURTAR as sugestões');
  }
  const alongou = editados.filter((l) => { try { return JSON.parse(l.diff).alongou; } catch { return false; } });
  if (editados.length >= 2 && alongou.length / editados.length >= 0.6) {
    patterns.push('Vendedor costuma ALONGAR as sugestões');
  }

  // Padrão de tom (comparar sugestão vs texto final)
  const tons = editados.map((l) => {
    try {
      const diff = JSON.parse(l.diff);
      return {
        orig: detectToneFromText(l.suggestionText),
        fin: detectToneFromText(l.vendedorText),
      };
    } catch { return null; }
  }).filter(Boolean);
  const foiInformalizado = tons.filter((t) => t.orig && t.fin && t.orig !== 'informal' && t.fin === 'informal');
  const foiFormalizado = tons.filter((t) => t.orig && t.fin && t.orig !== 'formal' && t.fin === 'formal');
  if (tons.length >= 2 && foiInformalizado.length / tons.length >= 0.6) {
    patterns.push('Vendedor prefere tom MAIS INFORMAL');
  }
  if (tons.length >= 2 && foiFormalizado.length / tons.length >= 0.6) {
    patterns.push('Vendedor prefere tom MAIS FORMAL');
  }

  // ---- Parâmetros sugeridos (auto-ajuste) ----
  const currentParams = await getParams();
  const params = { ...currentParams };

  if (patterns.some((p) => p.includes('ENCURTAR'))) {
    params.respostaCurta = true;
    params.maxFrases = Math.max(2, (currentParams.maxFrases || 4) - 1);
  }
  if (patterns.some((p) => p.includes('ALONGAR'))) {
    params.respostaCurta = false;
    params.maxFrases = Math.min(8, (currentParams.maxFrases || 4) + 1);
  }
  if (patterns.some((p) => p.includes('INFORMAL'))) {
    params.tomPadrao = 'informal';
  }
  if (patterns.some((p) => p.includes('FORMAL'))) {
    params.tomPadrao = 'formal';
  }

  await saveParams(params);

  // ---- Salvar métricas do período ----
  const period = new Date().toISOString().slice(0, 10);
  const metricData = {
    period,
    accuracyRate: Math.round(accuracyRate * 10) / 10,
    editRate: Math.round(editRate * 10) / 10,
    positiveRate: Math.round(positiveRate * 10) / 10,
    avgResponseTimeMin,
    topPatterns: JSON.stringify(patterns),
    suggestedParams: JSON.stringify(params),
  };

  const existing = await prisma.aiPerformanceMetrics.findUnique({ where: { period } });
  if (existing) {
    await prisma.aiPerformanceMetrics.update({ where: { period }, data: metricData });
  } else {
    await prisma.aiPerformanceMetrics.create({ data: metricData });
  }

  return {
    message: 'Análise concluída',
    total,
    accuracyRate: metricData.accuracyRate,
    editRate: metricData.editRate,
    positiveRate: metricData.positiveRate,
    patterns,
    params,
    metrics: metricData,
  };
}

// ============ PARÂMETROS DO PROMPT ============

const PARAMS_KEY = 'ai:params';
const DEFAULT_PARAMS = {
  tomPadrao: null,     // null | informal | formal | tecnico | casual
  respostaCurta: false,
  maxFrases: 4,
  gerarPerguntaFinal: true,
};

async function getParams() {
  try {
    const row = await prisma.configuracao.findUnique({ where: { chave: PARAMS_KEY } });
    if (row && row.valor) {
      return { ...DEFAULT_PARAMS, ...JSON.parse(row.valor) };
    }
  } catch (err) {
    console.error('[Feedback] Erro ao ler parâmetros:', err.message);
  }
  return { ...DEFAULT_PARAMS };
}

async function saveParams(params) {
  await prisma.configuracao.upsert({
    where: { chave: PARAMS_KEY },
    update: { valor: JSON.stringify(params) },
    create: { chave: PARAMS_KEY, valor: JSON.stringify(params) },
  });
}

/**
 * Formata os parâmetros aprendidos como instruções para o prompt.
 */
function buildParamsSection(params) {
  if (!params) return '';
  const linhas = [];
  if (params.tomPadrao) {
    linhas.push(`- Use tom ${params.tomPadrao} como padrão (o vendedor prefere assim).`);
  }
  if (params.respostaCurta) {
    linhas.push(`- Prefira respostas CURTAS (máx ${params.maxFrases || 2} frases) — o vendedor costuma encurtar sugestões longas.`);
  }
  if (params.maxFrases && !params.respostaCurta) {
    linhas.push(`- Limite a sugestão a aproximadamente ${params.maxFrases} frases.`);
  }
  if (params.gerarPerguntaFinal) {
    linhas.push(`- Termine a sugestão com uma pergunta que estimule a resposta do lead.`);
  }
  return linhas.length ? `## PREFERÊNCIAS APRENDIDAS DO VENDEDOR\n${linhas.join('\n')}\n` : '';
}

// ============ RELATÓRIO ============

/**
 * Gera relatório: "A IA acertou X% das sugestões. Nos erros, o padrão foi [descrição]"
 */
async function getReport({ days = 7 } = {}) {
  const analysis = await analyzeAndAdjust({ days });
  const params = await getParams();

  let descricao = 'Nenhum padrão relevante detectado ainda.';
  if (analysis.patterns && analysis.patterns.length) {
    descricao = analysis.patterns.join('; ') + '.';
  }

  return {
    geradoEm: new Date().toISOString(),
    periodoDias: days,
    totalSugestoes: analysis.total,
    taxaAceite: analysis.accuracyRate,      // % usadas sem edição
    taxaEdicao: analysis.editRate,          // % editadas
    taxaRespostaPositiva: analysis.positiveRate,
    padroesDetectados: analysis.patterns,
    descricaoPadroes: descricao,
    parametrosAjustados: params,
  };
}

module.exports = {
  computeDiff,
  registerSuggestion,
  registerAction,
  updateResult,
  analyzeAndAdjust,
  getParams,
  saveParams,
  buildParamsSection,
  getReport,
  DEFAULT_PARAMS,
};
