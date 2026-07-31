/**
 * Rotas do módulo WhatsApp
 */
const express = require('express');
const router = express.Router();
const whatsappController = require('./whatsapp.controller');

// Health do módulo
router.get('/health', (req, res) => {
  return res.json({ ok: true, message: 'WhatsApp module loaded' });
});

// Analisa conversa, gera sugestão e atualiza o CRM (não envia mensagens)
router.post('/suggest', whatsappController.suggest);

// Registra nova mensagem recebida e atualiza o CRM
router.post('/handle-message', whatsappController.handleMessage);

module.exports = router;
