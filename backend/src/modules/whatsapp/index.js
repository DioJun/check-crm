/**
 * Módulo WhatsApp — Assistente de Vendas integrado ao WhatsApp Web
 * 
 * Lê conversas em tempo real (somente leitura), analisa com IA,
 * sugere respostas ao vendedor e atualiza o CRM automaticamente.
 * ⚠️ NUNCA envia mensagens — envio é sempre manual pelo vendedor.
 */
const router = require('./routes');

module.exports = {
  name: 'whatsapp',
  label: 'WhatsApp',
  description: 'Assistente de vendas integrado ao WhatsApp Web',
  icon: 'MessageSquare',
  register(app) {
    app.use('/api/whatsapp', router);
    console.log(`✅ Módulo [whatsapp] registrado em /api/whatsapp`);
  },
};
