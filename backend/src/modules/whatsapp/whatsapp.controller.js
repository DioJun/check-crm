/**
 * Controller do módulo WhatsApp
 * Endpoints para o assistente de vendas integrado ao WhatsApp Web.
 */
const { suggestResponse } = require('../../core/services/ai.service');
const prisma = require('../../core/lib/prisma');
const whatsappService = require('./whatsapp.service');
const patternsService = require('./patterns.service');
const offerService = require('./offer.service');
const scoreService = require('./score.service');
const actionLogService = require('./actionlog.service');
const configService = require('./config.service');
const intelligenceService = require('./lead-intelligence.service');
const feedbackService = require('./feedback.service');
const knowledgeService = require('./knowledge.service');
const analyticsService = require('./analytics.service');
const learningService = require('./learning.service');
const learningSettingsService = require('./learning-settings.service');

/**
 * POST /api/whatsapp/analyze
 * Analisa a conversa, gera sugestão de resposta, atualiza o CRM,
 * e roda o motor de alertas (relacionamento, urgência, risco, oportunidade, padrão).
 *
 * Body: { chatName, messages: [{ from, text, time }] }
 *
 * ⚠️ NUNCA envia mensagem — apenas analisa, sugere, alerta e atualiza o CRM.
 */
async function analyze(req, res) {
  try {
    const { chatName, messages = [] } = req.body;

    if (!chatName) {
      return res.status(400).json({ success: false, error: 'chatName é obrigatório' });
    }

    // Buscar lead correspondente no CRM
    const lead = await whatsappService.findLeadByChat(chatName);

    // Configurações das camadas de aprendizado (toggles)
    const learningSettings = await learningSettingsService.getSettings();

    // CAMADA 1 — Carregar perfil comportamental do lead para injetar na sugestão
    let intelligence = null;
    if (lead && learningSettings.memoriaLead) {
      intelligence = await intelligenceService.getIntelligence(lead.id);
    }

    // CAMADA 2 — Carregar preferências aprendidas do vendedor
    const learningParams = learningSettings.feedbackLoop || learningSettings.entreVendedores
      ? await feedbackService.getParams()
      : null;

    // CAMADA 3 — Buscar contexto da base de conhecimento (RAG)
    // Query = últimas mensagens do lead (o que ele está perguntando)
    let ragSection = '';
    if (learningSettings.rag) {
      const ragQuery = (messages || [])
        .filter((m) => m.from === 'lead')
        .slice(-5)
        .map((m) => m.text)
        .join(' ');
      if (ragQuery) {
        try {
          const rag = await knowledgeService.searchRagForPrompt(ragQuery, { topK: 3 });
          ragSection = rag.ragSection;
        } catch (err) {
          console.error('[RAG] Erro na busca:', err.message);
        }
      }
    }

    // CAMADA 4 — Carregar insights globais aprendidos (se disponíveis)
    let insightsSection = '';
    if (learningSettings.analytics) {
      try {
        insightsSection = await analyticsService.buildInsightsSection();
      } catch (err) {
        console.error('[Insights] Erro:', err.message);
      }
    }

    // IA: classificar + sugerir resposta + recomendar atualização
    // (recebe o perfil do lead + preferências aprendidas + base de conhecimento + insights)
    const analysis = await suggestResponse(chatName, messages, {
      profileSection: intelligence ? intelligenceService.buildProfileSection(intelligence) : '',
      paramsSection: learningParams ? feedbackService.buildParamsSection(learningParams) : '',
      ragSection,
      insightsSection,
    });

    // Mensagem mais recente do lead (para o log/contexto)
    const lastLeadMsg = [...messages].reverse().find((m) => m.from === 'lead');

    // Aplicar atualização automática no CRM (se houver lead encontrado)
    let crmUpdate = null;
    if (lead) {
      crmUpdate = await whatsappService.applyAIUpdate(lead, analysis, chatName, lastLeadMsg?.text);
    }

    // Carregar thresholds configuráveis (com fallback para defaults)
    const config = await configService.getConfig();

    // Motor de alertas de relacionamento (se houver lead)
    let alertas = [];
    if (lead) {
      alertas = await patternsService.detectAndSaveAlerts(lead, messages, config);
    }

    // Motor de sugestão de ofertas (cruza interesse com catálogo)
    const ofertas = await offerService.suggestOffers(messages, lead);

    // Lead Score dinâmico (se houver lead)
    let score = null;
    if (lead) {
      const interacoesCount = lead.interacoes ? lead.interacoes.length : 0;
      const calculado = scoreService.calculateScore({
        lead,
        messages,
        interacoesCount,
      });
      score = await scoreService.saveScore(lead.id, calculado);
      // Inclui os fatores no retorno para o painel
      score.fatores = calculado.fatores;

      // CAMADA 1 — Atualizar perfil comportamental com os dados desta conversa (se habilitado)
      if (learningSettings.memoriaLead) {
        const perfil = await intelligenceService.updateIntelligence(lead, messages, {
          resumoConversa: analysis.resumoConversa || '',
          resultado: 'pendente',
        });
        if (perfil) intelligence = perfil;
      }

      // Registrar visualização (log de ações do vendedor)
      await actionLogService.logVisualizacao(lead.id, {
        alertas: alertas.length,
        ofertas: ofertas.ofertas.length,
        score: calculado.score,
      }).catch(() => {});
    }

    // CAMADA 2 — Registrar a sugestão gerada (para o feedback loop, se habilitado)
    let suggestionLogId = null;
    if (lead && analysis.sugestao && learningSettings.feedbackLoop && learningSettings.registrarConversas) {
      try {
        const log = await feedbackService.registerSuggestion({
          leadId: lead.id,
          contexto: 'whatsapp',
          suggestionText: analysis.sugestao,
        });
        suggestionLogId = log.id;
      } catch (err) {
        console.error('[Feedback] Erro ao registrar sugestão:', err.message);
      }
    }

    return res.json({
      success: true,
      chatName,
      leadFound: !!lead,
      lead: crmUpdate ? { id: crmUpdate.lead.id, nome: crmUpdate.lead.nome, status: crmUpdate.lead.status, observacoes: crmUpdate.lead.observacoes, servico: crmUpdate.lead.servico, leadScore: score ? score.score : null } : null,
      classificacao: analysis.classificacao,
      sentimento: analysis.sentimento,
      sugestao: analysis.sugestao,
      resumoConversa: analysis.resumoConversa,
      crmUpdate,
      alertas,
      ofertas: ofertas.ofertas,
      interesses: ofertas.interests,
      score,
      suggestionLogId,
      intelligence: intelligence
        ? {
            preferredTone: intelligence.preferredTone,
            activeHours: intelligence.activeHours,
            avgResponseTimeMin: intelligence.avgResponseTimeMin,
            objections: (() => { try { return JSON.parse(intelligence.objections || '[]'); } catch { return []; } })(),
            interestedProducts: (() => { try { return JSON.parse(intelligence.interestedProducts || '[]'); } catch { return []; } })(),
            engagementScore: intelligence.engagementScore,
            recentSummaries: (() => { try { return JSON.parse(intelligence.recentSummaries || '[]'); } catch { return []; } })(),
            lastUpdated: intelligence.lastUpdated,
          }
        : null,
      logMessage: lead
        ? `Lead "${lead.nome}" atualizado (${crmUpdate.updates.status || 'status mantido'}, ${crmUpdate.observacaoAdicionada ? 'observação adicionada' : 'sem observação'})`
        : 'Nenhum lead correspondente encontrado no CRM para esta conversa.',
    });
  } catch (err) {
    console.error('[WhatsApp analyze] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/alerts
 * Lista alertas ativos (com filtro opcional por leadId).
 * Query: { leadId?, status? }
 */
async function getAlerts(req, res) {
  try {
    const { leadId, status } = req.query;
    const alertas = await patternsService.listAlerts({
      leadId,
      status: status || 'ativo',
    });
    return res.json({ success: true, alertas });
  } catch (err) {
    console.error('[WhatsApp alerts] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/alerts/:id/silence
 * Silencia um alerta por N dias (não repete durante o período).
 * Body: { dias? }
 */
async function silenceAlert(req, res) {
  try {
    const { id } = req.params;
    const { dias } = req.body;
    const alerta = await patternsService.silenceAlert(id, dias);

    // Registrar ação do vendedor
    if (alerta) {
      await actionLogService.logAction({
        leadId: alerta.leadId,
        tipo: 'alerta',
        acao: 'silenciou',
        alertaId: alerta.id,
        detalhe: { titulo: alerta.titulo, tipo: alerta.tipo },
      }).catch(() => {});
    }

    return res.json({ success: true, alerta });
  } catch (err) {
    console.error('[WhatsApp silence-alert] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/alerts/:id/resolve
 * Marca um alerta como resolvido (ex.: o vendedor já agiu).
 */
async function resolveAlert(req, res) {
  try {
    const { id } = req.params;
    const alerta = await patternsService.resolveAlert(id);

    // Registrar ação do vendedor
    if (alerta) {
      await actionLogService.logAction({
        leadId: alerta.leadId,
        tipo: 'alerta',
        acao: 'resolveu',
        alertaId: alerta.id,
        detalhe: { titulo: alerta.titulo, tipo: alerta.tipo },
      }).catch(() => {});
    }

    return res.json({ success: true, alerta });
  } catch (err) {
    console.error('[WhatsApp resolve-alert] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/catalog
 * Lista o catálogo de produtos/serviços ativos para sugestão de ofertas.
 */
async function getCatalog(req, res) {
  try {
    const produtos = await offerService.getCatalog();
    return res.json({ success: true, produtos });
  } catch (err) {
    console.error('[WhatsApp catalog] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/offers
 * Histórico de ofertas sugeridas (filtro opcional por leadId).
 * Query: { leadId? }
 */
async function getOffers(req, res) {
  try {
    const { leadId } = req.query;
    const where = leadId ? { leadId } : {};
    const ofertas = await prisma.leadProduto.findMany({
      where,
      include: {
        produto: { select: { id: true, nome: true, preco: true, descricao: true, condicoes: true } },
        lead: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ success: true, ofertas });
  } catch (err) {
    console.error('[WhatsApp offers] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/offers/action
 * Registra a ação do vendedor sobre uma oferta sugerida (usou/ignorou).
 * Body: { leadId, produtoId, status }
 */
async function offerAction(req, res) {
  try {
    const { leadId, produtoId, status } = req.body;
    if (!leadId || !produtoId || !status) {
      return res.status(400).json({ success: false, error: 'leadId, produtoId e status são obrigatórios' });
    }
    const updated = await offerService.setOfferStatus(leadId, produtoId, status);

    // Registrar ação do vendedor (map: usou -> usou, ignorou -> ignorou)
    const acao = status === 'usou' ? 'usou' : status === 'ignorou' ? 'ignorou' : 'visualizou';
    const produto = updated?.produto || await prisma.produto.findUnique({ where: { id: produtoId } });
    await actionLogService.logAction({
      leadId,
      tipo: 'oferta',
      acao,
      detalhe: { produto: produto?.nome || produtoId, status },
    }).catch(() => {});

    return res.json({ success: true, oferta: updated });
  } catch (err) {
    console.error('[WhatsApp offer-action] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/actions
 * Lista o log de ações do vendedor (filtro por leadId).
 * Query: { leadId? }
 */
async function getActions(req, res) {
  try {
    const { leadId } = req.query;
    const logs = await actionLogService.listLogs({ leadId });
    return res.json({ success: true, logs });
  } catch (err) {
    console.error('[WhatsApp actions] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/actions/stats
 * Estatísticas agregadas do log (para aprendizado futuro).
 */
async function getActionStats(req, res) {
  try {
    const stats = await actionLogService.getStats();
    return res.json({ success: true, stats });
  } catch (err) {
    console.error('[WhatsApp action-stats] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/score-history?leadId=xxx
 * Histórico de variação do lead score de um lead.
 */
async function getScoreHistory(req, res) {
  try {
    const { leadId } = req.query;
    if (!leadId) {
      return res.status(400).json({ success: false, error: 'leadId é obrigatório' });
    }
    const historico = await scoreService.getScoreHistory(leadId);
    return res.json({ success: true, historico });
  } catch (err) {
    console.error('[WhatsApp score-history] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/config
 * Retorna os thresholds atuais (defaults + personalizações salvas).
 */
async function getConfig(req, res) {
  try {
    const config = await configService.getConfig();
    return res.json({ success: true, config });
  } catch (err) {
    console.error('[WhatsApp config] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PUT /api/whatsapp/config
 * Atualiza os thresholds personalizados.
 * Body: { propostaPendenteDias?, respostaRapidaMin?, mensagemCurtaLen?, silencioDias?, dedupHoras?, inatividadeDias?: { novo?, contatado?, interessado?, fechado? } }
 */
async function updateConfig(req, res) {
  try {
    const changes = req.body || {};
    const config = await configService.updateConfig(changes);
    return res.json({ success: true, config });
  } catch (err) {
    console.error('[WhatsApp config] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/config/reset
 * Reseta os thresholds para os valores padrão.
 */
async function resetConfig(req, res) {
  try {
    const config = await configService.resetConfig();
    return res.json({ success: true, config });
  } catch (err) {
    console.error('[WhatsApp config-reset] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/intelligence/:leadId
 * Retorna o perfil comportamental (memória) de um lead — Camada 1.
 */
async function getLeadIntelligence(req, res) {
  try {
    const { leadId } = req.params;
    const intelligence = await intelligenceService.getIntelligence(leadId);
    if (!intelligence) {
      return res.json({ success: true, intelligence: null, message: 'Perfil ainda não criado para este lead' });
    }
    const perfil = {
      id: intelligence.id,
      preferredTone: intelligence.preferredTone,
      activeHours: intelligence.activeHours,
      avgResponseTimeMin: intelligence.avgResponseTimeMin,
      objections: (() => { try { return JSON.parse(intelligence.objections || '[]'); } catch { return []; } })(),
      interestedProducts: (() => { try { return JSON.parse(intelligence.interestedProducts || '[]'); } catch { return []; } })(),
      engagementScore: intelligence.engagementScore,
      recentSummaries: (() => { try { return JSON.parse(intelligence.recentSummaries || '[]'); } catch { return []; } })(),
      lastUpdated: intelligence.lastUpdated,
    };
    return res.json({ success: true, intelligence: perfil });
  } catch (err) {
    console.error('[WhatsApp intelligence] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/feedback/action
 * Registra a ação do vendedor sobre uma sugestão (copiou/editou/ignorou).
 * Body: { id, actionTaken, vendedorText? }
 */
async function feedbackAction(req, res) {
  try {
    const { id, actionTaken, vendedorText } = req.body;
    if (!id || !actionTaken) {
      return res.status(400).json({ success: false, error: 'id e actionTaken são obrigatórios' });
    }
    const log = await feedbackService.registerAction({ id, actionTaken, vendedorText });
    return res.json({ success: true, log });
  } catch (err) {
    console.error('[Feedback action] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/feedback/result
 * Atualiza o resultado da interação com o lead.
 * Body: { id, result, responseTimeMin? }
 */
async function feedbackResult(req, res) {
  try {
    const { id, result, responseTimeMin } = req.body;
    if (!id || !result) {
      return res.status(400).json({ success: false, error: 'id e result são obrigatórios' });
    }
    const log = await feedbackService.updateResult({ id, result, responseTimeMin });
    return res.json({ success: true, log });
  } catch (err) {
    console.error('[Feedback result] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/feedback/analyze
 * Roda o auto-ajuste: analisa logs, detecta padrões e ajusta parâmetros do prompt.
 * Body: { days? }
 */
async function feedbackAnalyze(req, res) {
  try {
    const { days = 7 } = req.body || {};
    const result = await feedbackService.analyzeAndAdjust({ days });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Feedback analyze] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/feedback/report
 * Relatório de performance da IA.
 * Query: { days? }
 */
async function feedbackReport(req, res) {
  try {
    const { days = 7 } = req.query;
    const report = await feedbackService.getReport({ days: parseInt(days, 10) || 7 });
    return res.json({ success: true, report });
  } catch (err) {
    console.error('[Feedback report] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** * GET /api/whatsapp/analytics
 * Dashboard de performance da IA (métricas, palavras, horários, conversão).
 * Query: { days? }
 */
async function getAnalytics(req, res) {
  try {
    const { days = 30 } = req.query;
    const dashboard = await analyticsService.getDashboard({ days: parseInt(days, 10) || 30 });
    return res.json({ success: true, dashboard });
  } catch (err) {
    console.error('[Analytics] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/analytics/words
 * Palavras que mais geram resposta positiva/negativa.
 * Query: { days? }
 */
async function getAnalyticsWords(req, res) {
  try {
    const { days = 30 } = req.query;
    const words = await analyticsService.getWordAnalysis({ days: parseInt(days, 10) || 30 });
    return res.json({ success: true, ...words });
  } catch (err) {
    console.error('[Analytics words] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/learning/vendedores
 * Performance comparativa por vendedor (Camada 5).
 * Query: { days? }
 */
async function getVendedores(req, res) {
  try {
    const { days = 30 } = req.query;
    const performance = await learningService.getPerformanceByVendedor({ days: parseInt(days, 10) || 30 });
    // Remove dados internos (_textos) antes de expor na API
    const limpo = performance.map((v) => {
      const { _textos, ...resto } = v;
      return resto;
    });
    return res.json({ success: true, vendedores: limpo });
  } catch (err) {
    console.error('[Learning vendedores] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/learning/apply-pattern
 * Aplica o padrão do top performer como parâmetros globais da IA (Camada 5).
 * Body: { days? }
 */
async function applyPattern(req, res) {
  try {
    const { days = 30 } = req.body || {};
    const result = await learningService.applyTopPerformerPattern({ days: parseInt(days, 10) || 30 });
    // Remove dados internos
    if (result.topPerformer) { const { _textos, ...r } = result.topPerformer; result.topPerformer = r; }
    if (Array.isArray(result.demais)) {
      result.demais = result.demais.map((v) => { const { _textos, ...r } = v; return r; });
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Learning apply-pattern] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/learning/top-pattern
 * Lê o padrão do top performer salvo (Camada 5).
 */
async function getTopPattern(req, res) {
  try {
    const padrao = await learningService.getTopPerformerPattern();
    return res.json({ success: true, padrao });
  } catch (err) {
    console.error('[Learning top-pattern] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/learning/settings
 * Retorna as configurações das camadas de aprendizado (toggles).
 */
async function getLearningSettings(req, res) {
  try {
    const settings = await learningSettingsService.getSettings();
    return res.json({ success: true, settings });
  } catch (err) {
    console.error('[Learning settings] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PUT /api/whatsapp/learning/settings
 * Atualiza os toggles das camadas de aprendizado.
 * Body: { memoriaLead?, feedbackLoop?, rag?, analytics?, entreVendedores?, anonimizarAnalytics?, registrarConversas? }
 */
async function updateLearningSettings(req, res) {
  try {
    const changes = req.body || {};
    const settings = await learningSettingsService.updateSettings(changes);
    return res.json({ success: true, settings });
  } catch (err) {
    console.error('[Learning settings] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/learning/settings/reset
 * Restaura os defaults das camadas de aprendizado.
 */
async function resetLearningSettings(req, res) {
  try {
    const settings = await learningSettingsService.resetSettings();
    return res.json({ success: true, settings });
  } catch (err) {
    console.error('[Learning settings reset] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/suggest
 * Analisa a conversa, gera sugestão de resposta e atualiza o CRM automaticamente.
 *
 * Body: { chatName, messages: [{ from, text, time }] }
 *
 * ⚠️ NUNCA envia mensagem — apenas analisa, sugere e atualiza o CRM.
 */
async function suggest(req, res) {
  try {
    const { chatName, messages = [] } = req.body;

    if (!chatName) {
      return res.status(400).json({ success: false, error: 'chatName é obrigatório' });
    }

    // Buscar lead correspondente no CRM
    const lead = await whatsappService.findLeadByChat(chatName);

    // IA: classificar + sugerir resposta + recomendar atualização
    const analysis = await suggestResponse(chatName, messages);

    // Mensagem mais recente do lead (para o log/contexto)
    const lastLeadMsg = [...messages].reverse().find((m) => m.from === 'lead');

    // Aplicar atualização automática no CRM (se houver lead encontrado)
    let crmUpdate = null;
    if (lead) {
      crmUpdate = await whatsappService.applyAIUpdate(lead, analysis, chatName, lastLeadMsg?.text);
    }

    return res.json({
      success: true,
      chatName,
      leadFound: !!lead,
      lead: crmUpdate ? { id: crmUpdate.lead.id, nome: crmUpdate.lead.nome, status: crmUpdate.lead.status, observacoes: crmUpdate.lead.observacoes, servico: crmUpdate.lead.servico } : null,
      classificacao: analysis.classificacao,
      sentimento: analysis.sentimento,
      sugestao: analysis.sugestao,
      resumoConversa: analysis.resumoConversa,
      crmUpdate,
      logMessage: lead
        ? `Lead "${lead.nome}" atualizado (${crmUpdate.updates.status || 'status mantido'}, ${crmUpdate.observacaoAdicionada ? 'observação adicionada' : 'sem observação'})`
        : 'Nenhum lead correspondente encontrado no CRM para esta conversa.',
    });
  } catch (err) {
    console.error('[WhatsApp suggest] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/handle-message
 * Chamado automaticamente quando uma nova mensagem chega.
 * Atualiza o CRM sem exigir clique do usuário (se lead existir).
 * 
 * Body: { chatName, message: { from, text, time } }
 */
async function handleMessage(req, res) {
  try {
    const { chatName, message } = req.body;

    if (!chatName || !message) {
      return res.status(400).json({ success: false, error: 'chatName e message são obrigatórios' });
    }

    const lead = await whatsappService.findLeadByChat(chatName);

    // Se não houver lead, apenas registra (sem ação)
    if (!lead) {
      return res.json({
        success: true,
        leadFound: false,
        logMessage: `Mensagem recebida de "${chatName}" — sem lead correspondente no CRM`,
      });
    }

    // Atualização leve: registrar interação + ultimaInteracao (sem IA para economizar)
    const interactionText = `[WhatsApp] ${message.text ? message.text.substring(0, 200) : 'Mensagem recebida'}`;
    await prisma.interacao.create({
      data: { leadId: lead.id, tipo: 'mensagem', conteudo: interactionText, data: new Date() },
    });
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { ultimaInteracao: new Date() },
    });

    return res.json({
      success: true,
      leadFound: true,
      lead: { id: updated.id, nome: updated.nome, status: updated.status },
      logMessage: `Mensagem de "${chatName}" registrada no lead "${lead.nome}"`,
    });
  } catch (err) {
    console.error('[WhatsApp handle-message] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { suggest, handleMessage, analyze, getAlerts, silenceAlert, resolveAlert, getCatalog, getOffers, offerAction, getScoreHistory, getActions, getActionStats, getConfig, updateConfig, resetConfig, getLeadIntelligence, feedbackAction, feedbackResult, feedbackAnalyze, feedbackReport, getAnalytics, getAnalyticsWords, getVendedores, applyPattern, getTopPattern, getLearningSettings, updateLearningSettings, resetLearningSettings };
