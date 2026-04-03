/**
 * Rotas de Scraping
 * POST /scraper/* endpoints
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
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /scraper/validate-url
 * Apenas valida se é URL do Google Maps (sem auth)
 */
router.post('/validate-url', ScraperController.validateUrl.bind(ScraperController));

// Rotas abaixo requerem autenticação
router.use(authMiddleware);

/**
 * POST /scraper/google-maps
 * Scrape de uma URL do Google Maps
 */
router.post('/google-maps', ScraperController.scrapeGoogleMaps.bind(ScraperController));

/**
 * POST /scraper/batch
 * Scrape de múltiplas URLs
 */
router.post('/batch', ScraperController.scrapeBatch.bind(ScraperController));

/**
 * POST /scraper/search
 * Pesquisa por termo (ex: "mecânicos em joinville")
 */
router.post('/search', ScraperController.searchGoogleMaps.bind(ScraperController));

module.exports = router;
