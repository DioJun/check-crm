/**
 * Rotas do módulo Sites
 */
const express = require('express');
const router = express.Router();
const SitesController = require('./sites.controller');

// Health do módulo
router.get('/health', SitesController.health);

// Templates/ramos disponíveis
router.get('/templates', SitesController.getTemplates);

// Deploy Vercel (config vem antes de /:id para não ser capturada como id)
router.get('/deploy/config', SitesController.getDeployConfig);
router.put('/deploy/config', SitesController.saveDeployConfig);

// GitHub (backup/versionamento)
router.get('/github/config', SitesController.getGitHubConfig);
router.put('/github/config', SitesController.saveGitHubConfig);

// CRUD de sites de demonstração
router.post('/', SitesController.create);
router.get('/', SitesController.list);
router.get('/stats', SitesController.getStats);
router.get('/:id', SitesController.getById);
router.put('/:id', SitesController.update);
router.delete('/:id', SitesController.remove);

// Renderização e preview
router.post('/:id/render', SitesController.render);
router.get('/:id/preview', SitesController.preview);
router.get('/:id/conteudo', SitesController.getConteudo);

// Tracking de visitas
router.post('/sem-acesso', SitesController.verificarSemAcesso);
router.post('/:id/visita', SitesController.registrarVisita);
router.post('/:id/aprovar', SitesController.aprovarSite);

// Fluxo de fechamento (briefing → proposta → contrato)
router.get('/:id/briefing', SitesController.getBriefing);
router.put('/:id/briefing', SitesController.saveBriefing);
router.post('/:id/proposta', SitesController.gerarProposta);
router.post('/:id/contrato', SitesController.gerarContrato);
router.post('/:id/fechar', SitesController.fecharSite);

// Deploy Vercel
router.post('/:id/publicar', SitesController.publicar);

// GitHub
router.post('/:id/github', SitesController.enviarGitHub);

module.exports = router;
