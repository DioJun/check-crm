const axios = require('axios');
const { generateWebhookSignature } = require('../middleware/webhook.middleware');

/**
 * Disparar webhook para URL registrada
 */
async function triggerWebhook(event, payload) {
  const webhookUrl = process.env.WEBHOOK_URL;
  const secret = process.env.CRM_WEBHOOK_SECRET;

  if (!webhookUrl || !secret) {
    console.log('[Webhook] Webhook não configurado');
    return;
  }

  try {
    const signature = generateWebhookSignature(payload, secret);
    
    console.log(`[Webhook] Enviando ${event}:`, {
      url: webhookUrl,
      event,
      timestamp: new Date().toISOString()
    });

    await axios.post(webhookUrl, 
      {
        event,
        timestamp: new Date().toISOString(),
        data: payload
      },
      {
        headers: {
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );

    console.log(`[Webhook] ✅ ${event} enviado com sucesso`);
  } catch (error) {
    console.error(`[Webhook] ❌ Erro ao enviar ${event}:`, error.message);
    // Não fazer throw - webhook é assíncrono e não deve bloquear a operação
  }
}

/**
 * Webhook: Lead criado
 */
async function onLeadCreated(lead) {
  await triggerWebhook('lead.created', {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    status: lead.status,
    source: lead.source,
    value: lead.value,
    createdAt: lead.createdAt
  });
}

/**
 * Webhook: Lead atualizado
 */
async function onLeadUpdated(lead) {
  await triggerWebhook('lead.updated', {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    status: lead.status,
    source: lead.source,
    value: lead.value,
    updatedAt: lead.updatedAt
  });
}

/**
 * Webhook: Lead deletado
 */
async function onLeadDeleted(leadId) {
  await triggerWebhook('lead.deleted', {
    id: leadId,
    deletedAt: new Date().toISOString()
  });
}

/**
 * Webhook: Interação criada
 */
async function onInteractionCreated(interaction) {
  await triggerWebhook('interaction.created', {
    id: interaction.id,
    leadId: interaction.leadId,
    type: interaction.type,
    notes: interaction.notes,
    createdAt: interaction.createdAt
  });
}

module.exports = {
  triggerWebhook,
  onLeadCreated,
  onLeadUpdated,
  onLeadDeleted,
  onInteractionCreated
};
