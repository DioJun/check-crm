/**
 * Lead Score Dinâmico — pontuação de 0 a 100
 *
 * Fatores:
 *   - Frequência de resposta          (+0 a 20)
 *   - Velocidade de resposta          (+0 a 20)
 *   - Tamanho das mensagens           (+0 a 15)
 *   - Palavras-chave de interesse     (+0 a 20)
 *   - Palavras-chave de desinteresse  (-0 a 15)
 *   - Histórico de conversas          (+0 a 10)
 *   - Stage no pipeline               (multiplicador 0.8 a 1.2)
 *
 * Score salvo em Lead.leadScore + ScoreHistorico (variação ao longo do tempo).
 */

const prisma = require('../../core/lib/prisma');
const { normalize, extractHour, KEYWORDS_URGENCIA, KEYWORDS_DESINTERESSE } = require('./patterns.service');

// ============ HELPERS ============

/** Mensagens do lead (incoming) */
function leadMsgs(messages) {
  return (messages || []).filter((m) => m.from === 'lead');
}

/** Mensagens do vendedor */
function sellerMsgs(messages) {
  return (messages || []).filter((m) => m.from === 'vendedor');
}

// ============ FATORES ============

/**
 * Frequência de resposta (0-20):
 * Percentual de mensagens do vendedor que receberam resposta do lead.
 */
function factorFrequency(messages) {
  const msgs = messages || [];
  if (msgs.length < 2) return 10; // neutro se pouca conversa
  const seller = sellerMsgs(msgs);

  let respostas = 0;
  // Para cada mensagem do vendedor, verifica se há uma do lead DEPOIS dela
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].from === 'vendedor') {
      const temRespostaDepois = msgs.slice(i + 1).some((m) => m.from === 'lead');
      if (temRespostaDepois) respostas++;
    }
  }
  const ratio = seller.length ? respostas / seller.length : 0.5;
  return Math.round(20 * ratio);
}

/**
 * Velocidade de resposta (0-20):
 * Intervalo médio entre mensagem do vendedor → resposta do lead (em minutos).
 */
function factorSpeed(messages) {
  const msgs = messages || [];
  const intervalos = [];
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i].from === 'lead' && msgs[i - 1].from === 'vendedor') {
      const h1 = extractHour(msgs[i - 1].time);
      const h2 = extractHour(msgs[i].time);
      if (h1 !== null && h2 !== null) {
        let min = h2 * 60 - h1 * 60;
        if (min < 0) min += 24 * 60;
        if (min >= 0 && min <= 24 * 60) intervalos.push(min);
      }
    }
  }
  if (!intervalos.length) return 10; // neutro

  const media = intervalos.reduce((s, m) => s + m, 0) / intervalos.length;
  if (media <= 5) return 20;    // responde em até 5 min
  if (media <= 15) return 16;
  if (media <= 30) return 12;
  if (media <= 60) return 8;
  if (media <= 180) return 4;
  return 0;
}

/**
 * Tamanho das mensagens (0-15):
 * Respostas longas e detalhadas do lead indicam engajamento.
 */
function factorMessageSize(messages) {
  const msgs = leadMsgs(messages);
  if (!msgs.length) return 5; // neutro

  const tamMedio = msgs.reduce((s, m) => s + (m.text ? m.text.length : 0), 0) / msgs.length;
  if (tamMedio >= 100) return 15;   // muito detalhado
  if (tamMedio >= 60) return 12;
  if (tamMedio >= 30) return 9;
  if (tamMedio >= 15) return 6;
  return 3;                          // mensagens curtas
}

/**
 * Palavras-chave (interesse +20, desinteresse -15):
 * Verifica keywords de compra e de desinteresse nas mensagens do lead.
 * Observação: o texto é normalizado (sem acentos) — as keywords também.
 */
function factorKeywords(messages) {
  const text = normalize(leadMsgs(messages).map((m) => m.text).join(' '));
  if (!text) return 0;

  // Interesse (sinais de compra)
  for (const kw of KEYWORDS_URGENCIA) {
    if (text.includes(normalize(kw.palavra))) {
      return 20;
    }
  }

  // Desinteresse (subtrai)
  for (const kw of KEYWORDS_DESINTERESSE) {
    if (text.includes(normalize(kw))) {
      return -15;
    }
  }

  return 5; // neutro, conversa comum
}

/**
 * Histórico de conversas (0-10):
 * Quanto mais interações registradas no CRM, mais contexto/envolvimento.
 */
function factorHistory(interacoesCount) {
  const n = interacoesCount || 0;
  if (n >= 15) return 10;
  if (n >= 8) return 8;
  if (n >= 4) return 6;
  if (n >= 2) return 4;
  if (n >= 1) return 2;
  return 0;
}

/**
 * Multiplicador por stage no pipeline.
 */
function stageMultiplier(status) {
  const map = {
    fechado: 1.2,
    cliente: 1.2,
    interessado: 1.1,
    contatado: 1.0,
    novo: 0.9,
    sem_contato: 0.8,
  };
  return map[status] ?? 1.0;
}

// ============ CÁLCULO ============

/**
 * Calcula o lead score completo (0-100).
 * @param {Object} params - { lead, messages, interacoesCount }
 * @returns {{ score, label, cor, fatores }}
 */
function calculateScore({ lead, messages, interacoesCount }) {
  const freq = factorFrequency(messages);
  const speed = factorSpeed(messages);
  const size = factorMessageSize(messages);
  const kw = factorKeywords(messages);
  const history = factorHistory(interacoesCount);
  const mult = stageMultiplier(lead?.status);

  // Base: soma dos fatores positivos, com desinteresse subtraindo
  let base = freq + speed + size + history;
  if (kw >= 0) base += kw;
  else base += kw; // kw negativo já subtrai

  // Aplica multiplicador do stage
  let score = Math.round(base * mult);

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  const label = score > 60 ? 'Lead Quente' : score >= 30 ? 'Lead Morno' : 'Lead Frio';
  const cor = score > 60 ? 'verde' : score >= 30 ? 'amarelo' : 'vermelho';

  return {
    score,
    label,
    cor,
    fatores: {
      frequencia: freq,
      velocidade: speed,
      tamanho: size,
      keywords: kw,
      historico: history,
      multiplicadorStage: mult,
      base,
    },
  };
}

// ============ PERSISTÊNCIA ============

/**
 * Salva o score no lead + registra no histórico (se mudou).
 * Retorna o score salvo.
 */
async function saveScore(leadId, { score, label, cor, fatores }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;

  const anterior = lead.leadScore;

  // Atualiza o score atual no lead
  await prisma.lead.update({
    where: { id: leadId },
    data: { leadScore: score },
  });

  // Registra no histórico apenas quando o score muda (evita spam)
  if (anterior !== score) {
    await prisma.scoreHistorico.create({
      data: {
        leadId,
        score,
        fatores: JSON.stringify(fatores),
      },
    });
  }

  return { score, label, cor, anterior };
}

/** Busca o histórico de variação do score de um lead */
async function getScoreHistory(leadId, limit = 20) {
  return prisma.scoreHistorico.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

module.exports = {
  calculateScore,
  saveScore,
  getScoreHistory,
  factorFrequency,
  factorSpeed,
  factorMessageSize,
  factorKeywords,
  factorHistory,
  stageMultiplier,
};
