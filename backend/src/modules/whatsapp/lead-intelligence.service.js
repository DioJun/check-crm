/**
 * CAMADA 1 — Memória Individual por Lead (Perfil Comportamental)
 *
 * Mantém um perfil de comportamento por lead que é:
 *   - Atualizado a cada conversa analisada
 *   - Injetado no prompt da IA antes de gerar sugestões
 *
 * Campos do perfil:
 *   - Tom de comunicação preferido (formal/informal/tecnico/casual)
 *   - Horário de maior atividade
 *   - Tempo médio de resposta
 *   - Objeções recorrentes
 *   - Produtos/serviços de interesse
 *   - Engagement score
 *   - Resumo das últimas 5 conversas
 */

const prisma = require('../../core/lib/prisma');
const { normalize, extractHour } = require('./patterns.service');
const { detectInterests } = require('./offer.service');

// ============ KEYWORDS DE TOM ============
const TOM_KEYWORDS = {
  informal: ['valeu', 'blz', 'obrigadao', 'mano', 'cara', 'rs', 'haha', 'kkk', 'tranquilo', 'fechou', 'top', 'show', 'massa', 'tamo junto', 'sem problema', 'legal'],
  tecnico: ['integracao', 'api', 'banco de dados', 'servidor', 'backend', 'frontend', 'sistema', 'software', 'automacao', 'relatorio', 'dashboard', 'versionamento', 'criptografia', 'latencia', 'performance', 'escalabilidade'],
  casual: ['oi', 'ola', 'obrigado', 'por favor', 'pode ser', 'sim', 'nao', 'ok', 'beleza', 'claro', 'combinado'],
  formal: ['prezado', 'senhor', 'senhora', 'gostaria', 'desta forma', 'portanto', 'encaminhar', 'solicitar', 'informo que', 'conforme', 'atenciosamente', 'cordialmente'],
};

const OBJECAO_KEYWORDS = [
  { palavra: 'caro', categoria: 'preco' },
  { palavra: 'preco alto', categoria: 'preco' },
  { palavra: 'fora do orcamento', categoria: 'preco' },
  { palavra: 'sem verba', categoria: 'preco' },
  { palavra: 'agora nao', categoria: 'timing' },
  { palavra: 'depois', categoria: 'timing' },
  { palavra: 'nao tenho tempo', categoria: 'timing' },
  { palavra: 'ja tenho', categoria: 'satisfeito' },
  { palavra: 'ja uso', categoria: 'satisfeito' },
  { palavra: 'ja contratei', categoria: 'concorrente' },
  { palavra: 'outra empresa', categoria: 'concorrente' },
  { palavra: 'concorrente', categoria: 'concorrente' },
  { palavra: 'preciso pensar', categoria: 'decisao' },
  { palavra: 'vou ver', categoria: 'decisao' },
  { palavra: 'quero comparar', categoria: 'decisao' },
];

// ============ HELPERS ============

function safeParse(json, fallback) {
  try { return JSON.parse(json || '[]'); } catch { return fallback; }
}

function leadMessages(messages) {
  return (messages || []).filter((m) => m.from === 'lead');
}

// ============ DETECÇÃO ============

/** Detecta o tom preferido com base nas mensagens do lead */
function detectTone(messages) {
  const text = normalize(leadMessages(messages).map((m) => m.text).join(' '));
  if (!text) return null;

  const scores = { formal: 0, informal: 0, tecnico: 0, casual: 0 };
  for (const [tom, keywords] of Object.entries(TOM_KEYWORDS)) {
    for (const kw of keywords) {
      const norm = normalize(kw);
      if (norm && text.includes(norm)) scores[tom] += 1;
    }
  }
  const melhor = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return melhor[1] > 0 ? melhor[0] : null;
}

/** Detecta o horário de maior atividade (hora mais frequente) */
function detectActiveHours(messages) {
  const horas = leadMessages(messages)
    .map((m) => extractHour(m.time))
    .filter((h) => h !== null);
  if (horas.length < 2) return null;

  const contagem = {};
  horas.forEach((h) => { contagem[h] = (contagem[h] || 0) + 1; });
  const melhorHora = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0];
  const melhorInt = parseInt(melhorHora, 10);
  const fim = (melhorInt + 1) % 24;
  return `${melhorInt}-${fim}h`;
}

/** Tempo médio de resposta (intervalo vendedor -> lead) em minutos */
function detectAvgResponseTime(messages) {
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
  if (!intervalos.length) return null;
  return Math.round(intervalos.reduce((s, m) => s + m, 0) / intervalos.length);
}

/** Detecta objeções recorrentes */
function detectObjections(messages) {
  const text = normalize(leadMessages(messages).map((m) => m.text).join(' '));
  if (!text) return [];

  const encontradas = [];
  for (const obj of OBJECAO_KEYWORDS) {
    const norm = normalize(obj.palavra);
    if (norm && text.includes(norm) && !encontradas.includes(obj.categoria)) {
      encontradas.push(obj.categoria);
    }
  }
  return encontradas;
}

// ============ SERVIÇO PRINCIPAL ============

/**
 * Busca o perfil comportamental de um lead (ou null se ainda não existe).
 */
async function getIntelligence(leadId) {
  if (!leadId) return null;
  return prisma.leadIntelligence.findUnique({ where: { leadId } });
}

/**
 * Atualiza (ou cria) o perfil comportamental do lead a partir da conversa.
 * Chamado a cada análise (whatsapp.controller.analyze e lead.controller).
 */
async function updateIntelligence(lead, messages, { resumoConversa = '', resultado = 'pendente' } = {}) {
  if (!lead || !lead.id) return null;

  const atual = await getIntelligence(lead.id);
  const atualObj = atual || {};

  // Detecta novos sinais
  const tom = detectTone(messages);
  const horas = detectActiveHours(messages);
  const tempo = detectAvgResponseTime(messages);
  const objecoes = detectObjections(messages);
  const interesses = detectInterests(messages).map((i) => i.label);

  // Mescla com dados existentes
  const tomFinal = tom || atualObj.preferredTone || 'formal';
  const horasFinal = horas || atualObj.activeHours || '';
  const tempoFinal = tempo ?? atualObj.avgResponseTimeMin ?? 0;

  const objecoesExistentes = safeParse(atualObj.objections, []);
  const objecoesFinal = Array.from(new Set([...objecoesExistentes, ...objecoes])).slice(0, 10);

  const interessesExistentes = safeParse(atualObj.interestedProducts, []);
  const interessesFinal = Array.from(new Set([...interessesExistentes, ...interesses])).slice(0, 10);

  // Resumo das últimas 5 conversas (mantém as mais recentes)
  const resumosExistentes = safeParse(atualObj.recentSummaries, []);
  let resumos = resumosExistentes;
  if (resumoConversa) {
    resumos = [{ resumo: resumoConversa, resultado, data: new Date().toISOString() }, ...resumos].slice(0, 5);
  }

  const data = {
    preferredTone: tomFinal,
    activeHours: horasFinal,
    avgResponseTimeMin: tempoFinal,
    objections: JSON.stringify(objecoesFinal),
    interestedProducts: JSON.stringify(interessesFinal),
    engagementScore: atualObj.engagementScore ?? 50,
    recentSummaries: JSON.stringify(resumos),
    lastUpdated: new Date(),
  };

  if (atual) {
    return prisma.leadIntelligence.update({ where: { id: atual.id }, data });
  }
  return prisma.leadIntelligence.create({ data: { leadId: lead.id, ...data } });
}

/**
 * Formata o perfil comportamental em texto para injeção no prompt da IA.
 */
function buildProfileSection(intelligence) {
  if (!intelligence) return '';

  const objecoes = safeParse(intelligence.objections, []);
  const interesses = safeParse(intelligence.interestedProducts, []);
  const resumos = safeParse(intelligence.recentSummaries, []);

  const linhas = [
    `## PERFIL COMPORTAMENTAL DO LEAD (memória aprendida)`,
    `- Tom de comunicação preferido: ${intelligence.preferredTone}`,
    intelligence.activeHours ? `- Horário de maior atividade: ${intelligence.activeHours}` : null,
    intelligence.avgResponseTimeMin > 0 ? `- Tempo médio de resposta: ~${intelligence.avgResponseTimeMin} min` : null,
    objecoes.length ? `- Objeções que costuma levantar: ${objecoes.join(', ')}` : null,
    interesses.length ? `- Já demonstrou interesse em: ${interesses.join(', ')}` : null,
    intelligence.engagementScore ? `- Nível de engajamento: ${intelligence.engagementScore}/100` : null,
  ].filter(Boolean);

  if (resumos.length) {
    linhas.push(`- Histórico resumido das últimas conversas:`);
    resumos.forEach((r, i) => {
      linhas.push(`    ${i + 1}. (${r.resultado}) ${r.resumo}`);
    });
  }

  linhas.push(``);
  linhas.push(`ADAPTE SUA SUGESTÃO a este perfil: use o tom preferido, respeite o horário ativo e evite reabrir objeções sem abordá-las com cuidado.`);
  return linhas.join('\n');
}

/**
 * Fluxo completo: atualiza o perfil e retorna o perfil pronto para injeção no prompt.
 */
async function refreshAndBuildProfile(lead, messages, { resumoConversa = '', resultado = 'pendente' } = {}) {
  if (!lead) return { intelligence: null, profileSection: '' };
  const intelligence = await updateIntelligence(lead, messages, { resumoConversa, resultado });
  return {
    intelligence,
    profileSection: buildProfileSection(intelligence),
  };
}

module.exports = {
  getIntelligence,
  updateIntelligence,
  buildProfileSection,
  refreshAndBuildProfile,
  detectTone,
  detectActiveHours,
  detectAvgResponseTime,
  detectObjections,
};
