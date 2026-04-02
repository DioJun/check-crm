/**
 * Rotas de Scraping
 * POST /scraper/* endpoints
 */

const express = require('express');
const router = express.Router();
const ScraperController = require('../controllers/scraper.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * POST /scraper/google-maps
 * Scrape de uma URL do Google Maps
 */
router.post('/google-maps', ScraperController.scrapeGoogleMaps.bind(ScraperController));

/**
 * POST /scraper/validate-url
 * Apenas valida se é URL do Google Maps
 */
router.post('/validate-url', ScraperController.validateUrl.bind(ScraperController));

/**
 * POST /scraper/batch
 * Scrape de múltiplas URLs
 */
router.post('/batch', ScraperController.scrapeBatch.bind(ScraperController));

module.exports = router;
