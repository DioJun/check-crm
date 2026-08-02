/**
 * Motor de Detecção de Padrões — Alertas de Relacionamento
 *
 * Analisa conversas do WhatsApp + dados do lead no CRM e gera alertas
 * proativos para o vendedor:
 *   - Inatividade (follow-up)
 *   - Urgência (sinais de compra)
 *   - Risco (possível churn)
 *   - Oportunidade (datas e eventos)
 *   - Padrão de comportamento (melhor horário, velocidade)
 *
 * ⚠️ NENHUM alerta gera ação automática. Tudo é sugestão visual no painel.
 * O vendedor sempre decide.
 */

const prisma = require('../../core/lib/prisma');

// ============ CONFIGURAÇÃO PADRÃO (thresholds) ============
// Será sobrescrita pela tabela Configuracao no Passo 8 (personalização).
const DEFAULT_CONFIG = {
  // Dias sem interação por status do lead
  inatividadeDias: {
    novo: 3,
    sem_contato: 3,
    contatado: 7,
    interessado: 7,
    fechado: 14,
    cliente: 14,
  },
  // Proposta enviada há X dias sem resposta
  propostaPendenteDias: 3,
  // Resposta rápida = abaixo de X minutos
  respostaRapidaMin: 5,
  // Tamanho médio de mensagem "curta" (caracteres) — sinal de esfriamento
  mensagemCurtaLen: 15,
  // Duração padrão do silêncio de um alerta (dias)
  silencioDias: 7,
  // Janela de deduplicação (horas): não repetir mesmo tipo de alerta
  dedupHoras: 24,
};

// ============ KEYWORDS ============
const KEYWORDS_URGENCIA = [
  { palavra: 'quanto custa', prioridade: 'alta' },
  { palavra: 'quanto é', prioridade: 'alta' },
  { palavra: 'quanto fica', prioridade: 'alta' },
  { palavra: 'preço', prioridade: 'alta' },
  { palavra: 'valor', prioridade: 'alta' },
  { palavra: 'orçamento', prioridade: 'alta' },
  { palavra: 'proposta', prioridade: 'alta' },
  { palavra: 'preciso para', prioridade: 'alta' },
  { palavra: 'tenho pressa', prioridade: 'alta' },
  { palavra: 'urgente', prioridade: 'alta' },
  { palavra: 'estou comparando', prioridade: 'alta' },
  { palavra: 'vi em outro lugar', prioridade: 'alta' },
  { palavra: 'posso parcelar', prioridade: 'alta' },
  { palavra: 'parcelado', prioridade: 'alta' },
  { palavra: 'tem desconto', prioridade: 'alta' },
  { palavra: 'desconto', prioridade: 'media' },
  { palavra: 'quero fechar', prioridade: 'alta' },
  { palavra: 'vamos fechar', prioridade: 'alta' },
  { palavra: 'fechar', prioridade: 'media' },
  { palavra: 'contratar', prioridade: 'alta' },
];

const KEYWORDS_DESINTERESSE = [
  'agora não', 'depois te falo', 'depois falo', 'não preciso mais', 'não preciso',
  'sem interesse', 'não quero', 'não vou precisar', 'deixa pra lá', 'por enquanto não',
  'não obrigado', 'não, obrigado', 'obrigado mas', 'já tenho', 'já uso', 'já contratado',
  'fora do orçamento', 'estou sem verba', 'sem verba', 'muito caro',
];

const KEYWORDS_CONCORRENTE = [
  'outra empresa', 'concorrente', 'já fechei', 'fechei com outro', 'fechamos com',
  'já contratei', 'contratei outro', 'estou com outro', 'outro fornecedor', 'outra agência',
];

const KEYWORDS_FOLLOWUP_PROMETIDO = [
  'te retorno', 'te aviso', 'te chamo', 'te falo', 'volto a falar', 'volto a te',
  'retorno amanhã', 'retorno na', 'te respondo', 'te passo',
];

const DIAS_SEMANA = {
  domingo: 0, dom: 0,
  segunda: 1, 'segunda-feira': 1, seg: 1,
  terça: 2, 'terça-feira': 2, terca: 2, ter: 2,
  quarta: 3, 'quarta-feira': 3, qua: 3,
  quinta: 4, 'quinta-feira': 4, qui: 4,
  sexta: 5, 'sexta-feira': 5, sex: 5,
  sábado: 6, 'sábado-feira': 6, sabado: 6, sab: 6,
};

// ============ HELPERS ============

/** Normaliza texto: minúsculas, sem acentos, espaços únicos */
function normalize(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrai HH:MM de uma string de tempo do WhatsApp (ex: "10:30", "Ontem 22:10") */
function extractHour(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  if (h < 0 || h > 23) return null;
  return h;
}

/** Dias (inteiro) desde uma data até agora */
function daysSince(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** Mensagens do lead (incoming) */
function leadMessages(messages) {
  return (messages || []).filter((m) => m.from === 'lead');
}

/** Últimas N mensagens do lead */
function lastLeadMessages(messages, n = 5) {
  return leadMessages(messages).slice(-n);
}

/** Verifica se existe alerta ativo recente do mesmo tipo (dedup) */
async function hasRecentAlert(leadId, tipo, config) {
  const since = new Date(Date.now() - (config.dedupHoras || 24) * 60 * 60 * 1000);
  const existing = await prisma.alerta.findFirst({
    where: {
      leadId,
      tipo,
      status: 'ativo',
      createdAt: { gte: since },
    },
  });
  return !!existing;
}

/** Cria um alerta no banco (se não houver duplicata recente) */
async function createAlert({ leadId, tipo, prioridade, titulo, mensagem, detalhe, config }) {
  if (await hasRecentAlert(leadId, tipo, config)) return null;
  return prisma.alerta.create({
    data: { leadId, tipo, prioridade, titulo, mensagem, detalhe: detalhe ? JSON.stringify(detalhe) : null },
  });
}

// ============ 1.1 ALERTA DE INATIVIDADE ============

/**
 * Lead não interage há X dias (threshold varia por stage do pipeline).
 * Usa ultimaInteracao do CRM (mais confiável que o tempo do DOM).
 */
async function detectInactivity(lead, config) {
  if (!lead) return [];
  const base = lead.ultimaInteracao || lead.dataEntrada || new Date();
  const dias = daysSince(base);
  if (dias === null) return [];

  const status = lead.status || 'novo';
  const threshold = config.inatividadeDias[status] ?? config.inatividadeDias.novo;

  if (dias >= threshold) {
    const ultimaMsg = await prisma.interacao.findFirst({
      where: { leadId: lead.id },
      orderBy: { data: 'desc' },
    });

    return [{
      tipo: 'inatividade',
      prioridade: 'media',
      titulo: `Lead inativo há ${dias} dias`,
      mensagem: `Lead ${lead.nome} não interage há ${dias} dias. Última mensagem: ${ultimaMsg ? ultimaMsg.conteudo.substring(0, 80) : 'não registrada'}. Sugestão: envie um follow-up gentil.`,
      detalhe: { dias, threshold, status },
    }];
  }
  return [];
}

// ============ 1.2 ALERTA DE URGÊNCIA (SINAIS DE COMPRA) ============

/**
 * Detecta menções de palavras indicativas de intenção de compra.
 * Retorna alerta com prioridade ALTA.
 */
function detectUrgency(lead, messages) {
  if (!lead || !messages || !messages.length) return [];
  const text = normalize(lastLeadMessages(messages, 10).map((m) => m.text).join(' '));

  for (const kw of KEYWORDS_URGENCIA) {
    if (text.includes(kw.palavra)) {
      return [{
        tipo: 'urgencia',
        prioridade: 'alta',
        titulo: 'Sinal de compra detectado',
        mensagem: `Lead ${lead.nome} demonstrou sinal de compra. Mencionou "${kw.palavra}". Sugestão: envie proposta rapidamente.`,
        detalhe: { palavra: kw.palavra },
      }];
    }
  }
  return [];
}

// ============ 1.3 ALERTA DE RISCO (POSSÍVEL CHURN) ============

/**
 * Detecta: palavras de desinteresse, menção a concorrente,
 * e mudança de tom (mensagens que ficaram curtas).
 */
function detectRisk(lead, messages) {
  if (!lead || !messages || !messages.length) return [];
  const msgs = leadMessages(messages);
  const recent = lastLeadMessages(messages, 5);
  const text = normalize(recent.map((m) => m.text).join(' '));

  // 1) Concorrente mencionado
  for (const kw of KEYWORDS_CONCORRENTE) {
    if (text.includes(kw)) {
      return [{
        tipo: 'risco',
        prioridade: 'alta',
        titulo: 'Possível perda para concorrente',
        mensagem: `Atenção: Lead ${lead.nome} pode estar fechando com outra empresa (mencionou "${kw}"). Sugestão: ligue ou envie mensagem personalizada destacando seu diferencial.`,
        detalhe: { motivo: 'concorrente', palavra: kw },
      }];
    }
  }

  // 2) Desinteresse explícito
  for (const kw of KEYWORDS_DESINTERESSE) {
    if (text.includes(kw)) {
      return [{
        tipo: 'risco',
        prioridade: 'alta',
        titulo: 'Possível desinteresse',
        mensagem: `Atenção: Lead ${lead.nome} pode estar esfriando (mencionou "${kw}"). Sugestão: ligue ou envie mensagem personalizada.`,
        detalhe: { motivo: 'desinteresse', palavra: kw },
      }];
    }
  }

  // 3) Mudança de tom: comparar tamanho médio das mensagens
  if (msgs.length >= 4) {
    const metade = Math.floor(msgs.length / 2);
    const primeiraMetade = msgs.slice(0, metade);
    const segundaMetade = msgs.slice(metade);
    const avgLen = (arr) => arr.reduce((s, m) => s + (m.text ? m.text.length : 0), 0) / Math.max(arr.length, 1);
    const antigo = avgLen(primeiraMetade);
    const recente = avgLen(segundaMetade);

    // Se antes era detalhado e agora está curto (caiu mais de 60%)
    if (antigo > 40 && recente < antigo * 0.4 && recente < 20) {
      return [{
        tipo: 'risco',
        prioridade: 'media',
        titulo: 'Mudança de tom detectada',
        mensagem: `Lead ${lead.nome} costumava responder com mensagens detalhadas e agora responde de forma curta. Pode estar perdendo o interesse. Sugestão: ligue ou envie mensagem personalizada.`,
        detalhe: { motivo: 'tom_curto', mediaAntes: Math.round(antigo), mediaAgora: Math.round(recente) },
      }];
    }
  }

  return [];
}

// ============ 1.4 ALERTA DE OPORTUNIDADE (DATAS E EVENTOS) ============

/**
 * Detecta: aniversário (do CRM), follow-up prometido para hoje,
 * proposta pendente (sem resposta há X dias).
 */
async function detectOpportunity(lead, messages, config) {
  if (!lead) return [];
  const alerts = [];
  const hoje = new Date();

  // 1) Aniversário do lead (puxa do CRM)
  if (lead.aniversario) {
    const aniv = new Date(lead.aniversario);
    if (
      aniv.getDate() === hoje.getDate() &&
      aniv.getMonth() === hoje.getMonth()
    ) {
      alerts.push({
        tipo: 'oportunidade',
        prioridade: 'media',
        titulo: 'Aniversário hoje! 🎂',
        mensagem: `Hoje é aniversário do lead ${lead.nome}. Bom momento para um contato personalizado e humano.`,
        detalhe: { motivo: 'aniversario' },
      });
    }
  }

  // 2) Follow-up prometido ("te retorno na sexta" e hoje é sexta)
  if (messages && messages.length) {
    const text = normalize(lastLeadMessages(messages, 10).join(' '));
    const diaHoje = hoje.getDay();
    const prometeu = KEYWORDS_FOLLOWUP_PROMETIDO.some((k) => text.includes(k));
    if (prometeu) {
      const diaPrometido = Object.keys(DIAS_SEMANA).find((nome) => {
        const norm = normalize(nome);
        return text.includes(norm) && DIAS_SEMANA[nome] === diaHoje;
      });
      if (diaPrometido) {
        alerts.push({
          tipo: 'oportunidade',
          prioridade: 'alta',
          titulo: 'Follow-up prometido para hoje',
          mensagem: `Lead ${lead.nome} prometeu retorno. Hoje é ${diaPrometido} — bom momento para cobrar com leveza.`,
          detalhe: { motivo: 'followup_prometido', dia: diaPrometido },
        });
      }
    }
  }

  // 3) Proposta pendente (vendedor enviou "proposta/orçamento" e lead não respondeu)
  if (messages && messages.length) {
    const msgs = messages || [];
    const ultimaDoVendedor = [...msgs].reverse().find((m) => m.from === 'vendedor');
    const ultimaDoLead = [...msgs].reverse().find((m) => m.from === 'lead');

    if (ultimaDoVendedor && ultimaDoLead) {
      const propostaTexto = normalize(ultimaDoVendedor.text || '');
      const enviouProposta = /proposta|orçamento|orcamento|valor total|investimento/.test(propostaTexto);
      const idxVendedor = msgs.indexOf(ultimaDoVendedor);
      const idxLead = msgs.indexOf(ultimaDoLead);
      if (enviouProposta && idxLead < idxVendedor) {
        // Lead não respondeu após a proposta. Estimar dias pelo tempo do DOM se possível.
        const diasEstimados = estimateDaysSince(ultimaDoVendedor.time, config);
        if (diasEstimados !== null && diasEstimados >= config.propostaPendenteDias) {
          alerts.push({
            tipo: 'oportunidade',
            prioridade: 'media',
            titulo: 'Proposta pendente sem resposta',
            mensagem: `Enviou proposta para ${lead.nome} há ${diasEstimados} dias e não houve resposta. Sugestão: faça um follow-up suave perguntando se teve tempo de avaliar.`,
            detalhe: { motivo: 'proposta_pendente', dias: diasEstimados },
          });
        }
      }
    }
  }

  return alerts;
}

/** Estima dias desde um texto de tempo do WhatsApp ("Ontem", "10:30", "14/07/2026 10:30") */
function estimateDaysSince(timeStr, config) {
  if (!timeStr) return null;
  const s = String(timeStr);
  if (/agora|agora mesmo/.test(s)) return 0;
  if (s.includes(':') && /^(\d{1,2}):/.test(s)) return 0; // hoje
  if (/ontem/i.test(s)) return 1;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let ano = parseInt(m[3], 10);
    if (ano < 100) ano += 2000;
    const data = new Date(ano, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return daysSince(data);
  }
  return null;
}

// ============ 1.5 ALERTA DE PADRÃO DE COMPORTAMENTO ============

/**
 * Detecta: velocidade de resposta, melhor janela de contato,
 * lead que responde sempre rápido.
 */
function detectPattern(lead, messages) {
  if (!lead || !messages || messages.length < 3) return [];
  const alerts = [];
  const msgs = messages;

  // 1) Velocidade de resposta (intervalo entre mensagem do lead e resposta do vendedor)
  const intervalos = [];
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i].from === 'vendedor' && msgs[i - 1].from === 'lead') {
      const h1 = extractHour(msgs[i - 1].time);
      const h2 = extractHour(msgs[i].time);
      if (h1 !== null && h2 !== null) {
        // estimar diferença em minutos (mesmo dia)
        let min = (h2 * 60) - (h1 * 60);
        if (min < 0) min += 24 * 60;
        if (min >= 0) intervalos.push(min);
      }
    }
  }
  if (intervalos.length >= 2) {
    const mediaMin = intervalos.reduce((s, m) => s + m, 0) / intervalos.length;
    if (mediaMin <= 60) {
      alerts.push({
        tipo: 'padrao',
        prioridade: 'informativa',
        titulo: 'Responde rapidamente',
        mensagem: `Lead ${lead.nome} costuma responder em média em ${Math.round(mediaMin)} min. Alta disponibilidade — bom momento para propostas.`,
        detalhe: { motivo: 'alta_velocidade', mediaMin: Math.round(mediaMin) },
      });
    }
  }

  // 2) Melhor janela de contato (hora mais frequente das mensagens do lead)
  const horas = leadMessages(msgs)
    .map((m) => extractHour(m.time))
    .filter((h) => h !== null);
  if (horas.length >= 3) {
    const contagem = {};
    horas.forEach((h) => { contagem[h] = (contagem[h] || 0) + 1; });
    const melhorHora = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0];
    if (melhorHora && contagem[melhorHora] >= 2) {
      alerts.push({
        tipo: 'padrao',
        prioridade: 'informativa',
        titulo: 'Melhor horário de contato',
        mensagem: `Lead ${lead.nome} responde com mais frequência por volta das ${melhorHora}h. Sugestão: priorize contatos nesse horário.`,
        detalhe: { motivo: 'melhor_horario', hora: melhorHora, ocorrencias: contagem[melhorHora] },
      });
    }
  }

  return alerts;
}

// ============ ORQUESTRADOR ============

/**
 * Executa todas as detecções, salva no banco (com dedup) e retorna os alertas criados.
 * @param {Object} lead - lead do CRM (com aniversario, ultimaInteracao, status)
 * @param {Array} messages - [{ from, text, time }]
 * @param {Object} config - thresholds (usa DEFAULT_CONFIG)
 */
async function detectAndSaveAlerts(lead, messages, config = DEFAULT_CONFIG) {
  if (!lead) return [];

  const todasAsDetecoes = [
    ...(await detectInactivity(lead, config)),
    ...detectUrgency(lead, messages),
    ...detectRisk(lead, messages),
    ...(await detectOpportunity(lead, messages, config)),
    ...detectPattern(lead, messages),
  ];

  const criados = [];
  for (const alerta of todasAsDetecoes) {
    const saved = await createAlert({ leadId: lead.id, ...alerta, config });
    if (saved) criados.push(saved);
  }
  return criados;
}

/** Lista alertas (com filtro por lead e status) */
async function listAlerts({ leadId, status = 'ativo', limit = 50 } = {}) {
  const where = { status };
  if (leadId) where.leadId = leadId;
  const alerts = await prisma.alerta.findMany({
    where,
    include: { lead: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  // Ordenar por prioridade (alta primeiro), depois data
  const ordem = { alta: 0, media: 1, informativa: 2 };
  return alerts.sort((a, b) => (ordem[a.prioridade] ?? 9) - (ordem[b.prioridade] ?? 9));
}

/** Silencia um alerta por N dias (default: silencioDias da config) */
async function silenceAlert(id, dias = null, config = DEFAULT_CONFIG) {
  const diasSilencio = dias ?? config.silencioDias ?? 7;
  return prisma.alerta.update({
    where: { id },
    data: {
      status: 'silenciado',
      silenciadoAte: new Date(Date.now() + diasSilencio * 24 * 60 * 60 * 1000),
    },
  });
}

/** Marca alerta como resolvido (ex.: vendedor agiu sobre ele) */
async function resolveAlert(id) {
  return prisma.alerta.update({
    where: { id },
    data: { status: 'resolvido', resolvidoEm: new Date() },
  });
}

module.exports = {
  DEFAULT_CONFIG,
  KEYWORDS_URGENCIA,
  KEYWORDS_DESINTERESSE,
  KEYWORDS_CONCORRENTE,
  normalize,
  extractHour,
  daysSince,
  detectInactivity,
  detectUrgency,
  detectRisk,
  detectOpportunity,
  detectPattern,
  detectAndSaveAlerts,
  listAlerts,
  silenceAlert,
  resolveAlert,
};
