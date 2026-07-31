/**
 * Serviço do módulo WhatsApp
 * 
 * Lógica de negócio do assistente de WhatsApp:
 * - Match de conversa → Lead no CRM (por telefone ou nome)
 * - Atualização automática do perfil do lead
 * - Geração de sugestões via IA
 * 
 * ⚠️ SEGURANÇA: Este serviço NUNCA envia mensagens. Apenas analisa e sugere.
 */
const prisma = require('../../core/lib/prisma');
const { suggestResponse } = require('../../core/services/ai.service');

/** Extrair apenas dígitos de um texto (para match por telefone) */
function onlyDigits(text) {
  return String(text || '').replace(/\D/g, '');
}

/** Normalizar telefone para comparação (remove 55 do início quando aplicável) */
function normalizePhone(digits) {
  let d = digits;
  // Remover 55 do início se o número ficar com 12 dígitos (DDD + 9 dígitos)
  if (d.startsWith('55') && d.length >= 12) {
    d = d.slice(2);
  }
  return d;
}

/**
 * Busca o lead correspondente a uma conversa do WhatsApp.
 * Estratégia: primeiro por telefone, depois por nome (fuzzy).
 */
async function findLeadByChat(chatName) {
  if (!chatName) return null;

  const digits = onlyDigits(chatName);

  // 1) Tenta por telefone (se o título da conversa tiver números)
  if (digits.length >= 8) {
    const normalized = normalizePhone(digits);
    // Busca leads cujo telefone contenha os dígitos
    const byPhone = await prisma.lead.findFirst({
      where: { telefone: { contains: normalized.slice(-11) } },
    });
    if (byPhone) return byPhone;
  }

  // 2) Tenta por nome (case-insensitive — SQLite LIKE já é insensível p/ ASCII)
  if (chatName.length >= 3) {
    const byName = await prisma.lead.findFirst({
      where: { nome: { contains: chatName } },
    });
    if (byName) return byName;
  }

  return null;
}

/** Cria um resumo seguro (trunca e limpa) */
function summarize(text, maxLen = 500) {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim().substring(0, maxLen);
}

/**
 * Aplica a análise da IA no lead: atualiza status, observações e registra interação.
 * Retorna o lead atualizado + log da ação.
 */
async function applyAIUpdate(lead, aiAnalysis, chatName, newMessageText) {
  const updates = {};

  // Status sugerido pela IA
  if (aiAnalysis.atualizacaoLead?.status) {
    const validStatus = ['novo', 'sem_contato', 'contatado', 'interessado', 'fechado'];
    if (validStatus.includes(aiAnalysis.atualizacaoLead.status)) {
      updates.status = aiAnalysis.atualizacaoLead.status;
    }
  }

  // Observação automática (append)
  const newNote = aiAnalysis.atualizacaoLead?.observacoes;
  if (newNote) {
    const existing = lead.observacoes ? lead.observacoes + '\n' : '';
    updates.observacoes = summarize(existing + `[WhatsApp] ${newNote}`);
  }

  // Registrar interação com resumo da conversa
  const interactionText = summarize(
    `[WhatsApp - ${chatName}] ${aiAnalysis.resumoConversa || ''}${newMessageText ? ` Última msg do lead: "${summarize(newMessageText, 150)}"` : ''}`
  );

  await prisma.interacao.create({
    data: {
      leadId: lead.id,
      tipo: 'mensagem',
      conteudo: interactionText,
      data: new Date(),
    },
  });

  // Atualizar lead
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...updates,
      ultimaInteracao: new Date(),
    },
  });

  return {
    lead: updatedLead,
    updates,
    interactionCreated: true,
    log: {
      leadId: lead.id,
      leadName: lead.nome,
      chatName,
      statusChanged: updates.status || null,
      observacaoAdicionada: !!newNote,
      interacaoRegistrada: true,
    },
  };
}

module.exports = { findLeadByChat, applyAIUpdate, onlyDigits, normalizePhone };
