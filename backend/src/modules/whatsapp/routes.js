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

// Analisa conversa, gera sugestão, atualiza o CRM e roda motor de alertas (não envia mensagens)
router.post('/analyze', whatsappController.analyze);

// Analisa conversa, gera sugestão e atualiza o CRM (não envia mensagens)
router.post('/suggest', whatsappController.suggest);

// Registra nova mensagem recebida e atualiza o CRM
router.post('/handle-message', whatsappController.handleMessage);

// Alertas de relacionamento
router.get('/alerts', whatsappController.getAlerts);
router.post('/alerts/:id/silence', whatsappController.silenceAlert);
router.post('/alerts/:id/resolve', whatsappController.resolveAlert);

// Catálogo e sugestão de ofertas
router.get('/catalog', whatsappController.getCatalog);
router.get('/offers', whatsappController.getOffers);
router.post('/offers/action', whatsappController.offerAction);

// Lead Score
router.get('/score-history', whatsappController.getScoreHistory);

// Log de ações do vendedor
router.get('/actions', whatsappController.getActions);
router.get('/actions/stats', whatsappController.getActionStats);

// Thresholds configuráveis
router.get('/config', whatsappController.getConfig);
router.put('/config', whatsappController.updateConfig);
router.post('/config/reset', whatsappController.resetConfig);

// CAMADA 1 — Perfil comportamental do lead
router.get('/intelligence/:leadId', whatsappController.getLeadIntelligence);

// CAMADA 2 — Feedback loop (aprendizado por correção)
router.post('/feedback/action', whatsappController.feedbackAction);
router.post('/feedback/result', whatsappController.feedbackResult);
router.post('/feedback/analyze', whatsappController.feedbackAnalyze);
router.get('/feedback/report', whatsappController.feedbackReport);

// CAMADA 4 — Analytics e dashboard de performance da IA
router.get('/analytics', whatsappController.getAnalytics);
router.get('/analytics/words', whatsappController.getAnalyticsWords);

// CAMADA 5 — Aprendizado entre vendedores
router.get('/learning/vendedores', whatsappController.getVendedores);
router.post('/learning/apply-pattern', whatsappController.applyPattern);
router.get('/learning/top-pattern', whatsappController.getTopPattern);

// PASS 8 — Configurações das camadas de aprendizado
router.get('/learning/settings', whatsappController.getLearningSettings);
router.put('/learning/settings', whatsappController.updateLearningSettings);
router.post('/learning/settings/reset', whatsappController.resetLearningSettings);

// CAMADA 3 — Base de Conhecimento (RAG)
const knowledgeController = require('./knowledge.controller');
router.get('/knowledge', knowledgeController.list);
router.post('/knowledge/manual', knowledgeController.addManual);
router.post('/knowledge/upload', knowledgeController.upload.single('file'), knowledgeController.uploadFile);
router.delete('/knowledge/:id', knowledgeController.remove);
router.post('/knowledge/reindex', knowledgeController.reindex);
router.get('/knowledge/search', knowledgeController.search);

module.exports = router;
