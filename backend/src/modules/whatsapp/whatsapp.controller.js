/**
 * Controller do módulo WhatsApp
 * Endpoints para o assistente de vendas integrado ao WhatsApp Web.
 */
const { suggestResponse } = require('../../core/services/ai.service');
const prisma = require('../../core/lib/prisma');
const whatsappService = require('./whatsapp.service');

/**
 * POST /api/whatsapp/suggest
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

module.exports = { suggest, handleMessage };
