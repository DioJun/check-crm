/**
 * Rotas de Scraping
 * POST /scraper/* endpoints
 * 
 * ⚠️ IMPORTANTE: Google Maps Scraper está disponível APENAS na versão Desktop (Electron)
 * Na versão Web (Vercel), todas as rotas de scraper retornam 403 Forbidden
 */

const express = require('express');
const router = express.Router();
const ScraperController = require('../controllers/scraper.controller');
const authMiddleware = require('../middleware/auth.middleware');

/**
 * GET /scraper/health
 * Teste se a rota de scraper está funcionando
 */
router.get('/health', (req, res) => {
  return res.json({ 
    ok: true, 
    message: 'Scraper routes are loaded',
    isElectron: process.env.IS_ELECTRON === 'true',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /scraper/validate-url
 * Apenas valida se é URL do Google Maps (sem auth)
 * ⚠️ Retorna 403 se não for Electron
 */
router.post('/validate-url', ScraperController.checkScraperEnabled, ScraperController.validateUrl.bind(ScraperController));

/**
 * POST /scraper/search
 * Pesquisa por termo (ex: "mecânicos em joinville")
 * Sem autenticação por enquanto (para testes)
 * ⚠️ Retorna 403 se não for Electron
 */
router.post('/search', ScraperController.checkScraperEnabled, ScraperController.searchGoogleMaps?.bind(ScraperController) || ((req, res) => res.status(501).json({ error: 'Not implemented' })));

/**
 * POST /scraper/google-maps
 * Scrape de uma URL do Google Maps (sem auth para fallback)
 * Usada quando busca por termo falha
 * ⚠️ Retorna 403 se não for Electron
 */
router.post('/google-maps', ScraperController.checkScraperEnabled, ScraperController.scrapeGoogleMaps.bind(ScraperController));

// Rotas abaixo requerem autenticação
router.use(authMiddleware);

/**
 * POST /scraper/batch
 * Scrape de múltiplas URLs
 * ⚠️ Retorna 403 se não for Electron
 */
router.post('/batch', ScraperController.checkScraperEnabled, ScraperController.scrapeBatch.bind(ScraperController));

module.exports = router;
