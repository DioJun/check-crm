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

/** Normalizar texto para comparação: minúsculas, sem acentos, sem pontuação/emoji */
function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')    // remove pontuação/emoji
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dividir texto em palavras-chave significativas (3+ chars) */
function tokenize(text) {
  return normalizeText(text)
    .split(' ')
    .filter((w) => w.length >= 3);
}

/**
 * Busca o lead correspondente a uma conversa do WhatsApp.
 * Estratégia em camadas (robusta a nomes salvos diferentes no WhatsApp):
 * 1) Telefone — normaliza dígitos dos DOIS lados (banco pode ter formatação
 *    como "(47) 99661-5745", "+55 47 9966-1574" etc.) e compara em memória.
 * 2) Nome exato normalizado (substring, tolerante a acentos/pontuação)
 * 3) Match fuzzy por palavras-chave do título (cobre nomes longos do CRM)
 */
async function findLeadByChat(chatName) {
  if (!chatName) return null;

  // ---- CAMADA 1: Telefone (normalizado nos dois lados) ----
  const digits = onlyDigits(chatName);
  if (digits.length >= 8) {
    const tituloNorm = normalizePhone(digits);
    // Busca leads com telefone e compara dígitos em memória (projeto pequeno)
    const leadsComTel = await prisma.lead.findMany({
      where: { telefone: { not: null } },
      select: { id: true, nome: true, telefone: true },
    });
    for (const lead of leadsComTel) {
      const leadDigitos = onlyDigits(lead.telefone);
      if (leadDigitos.length < 8) continue;
      const leadNorm = normalizePhone(leadDigitos);
      // Compara os últimos 10-11 dígitos (ignora DDI/DDD/formatação)
      const alvo = tituloNorm.slice(-11);
      const fonte = leadNorm.slice(-11);
      if (alvo === fonte) return lead;
      // Tolerância: um contém o outro (ex: título sem DDD, lead com DDD)
      if (alvo.length >= 10 && fonte.length >= 10 && (alvo.includes(fonte) || fonte.includes(alvo))) return lead;
    }
  }

  // ---- CAMADA 2 + 3: Nome (fuzzy) ----
  const chatNorm = normalizeText(chatName);
  const chatTokens = tokenize(chatName);

  if (chatNorm.length >= 3) {
    // Busca ampla de leads para avaliar em memória (projeto pequeno)
    const leads = await prisma.lead.findMany({
      select: { id: true, nome: true, telefone: true },
    });

    let melhor = null;
    let melhorScore = 0;

    for (const lead of leads) {
      const nomeNorm = normalizeText(lead.nome);
      if (!nomeNorm) continue;

      // 2a) Substring exata normalizada (uma contém a outra)
      if (nomeNorm.includes(chatNorm) || chatNorm.includes(nomeNorm)) {
        return lead;
      }

      // 3a) Match fuzzy por tokens: quantas palavras do título aparecem no nome?
      if (chatTokens.length > 0) {
        let matches = 0;
        for (const token of chatTokens) {
          if (nomeNorm.includes(token)) matches++;
        }
        const cobertura = matches / chatTokens.length;
        // Exige >= 60% das palavras-chave, preferindo a maior cobertura
        if (cobertura >= 0.6 && cobertura > melhorScore) {
          melhor = lead;
          melhorScore = cobertura;
        }
      }
    }

    if (melhor) return melhor;
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

module.exports = { findLeadByChat, applyAIUpdate, onlyDigits, normalizePhone, normalizeText, tokenize };
