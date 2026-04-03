/**
 * Controller de Scraping
 * Endpoints para fazer scrape de dados do Google Maps
 */

const ScraperService = require('../services/scraper.service');

class ScraperController {
  /**
   * POST /scraper/google-maps
   * Recebe URL do Google Maps e retorna dados extraídos
   */
  static async scrapeGoogleMaps(req, res) {
    try {
      const { url } = req.body;

      // Validações
      if (!url) {
        return res.status(400).json({ 
          error: 'URL é obrigatória',
          success: false 
        });
      }

      console.log('🔗 Scraping URL:', url);

      // Fazer scrape
      const data = await ScraperService.scrapeGoogleMaps(url);

      // Normalizar dados
      const dadosNormalizados = ScraperService.normalizarDados(data);

      return res.json({
        success: true,
        data: dadosNormalizados,
        message: 'Dados extraídos com sucesso!'
      });

    } catch (error) {
      console.error('❌ Erro no scraper:', error.message);

      return res.status(400).json({
        success: false,
        error: error.message || 'Erro ao fazer scrape da URL',
        tip: 'Certifique-se de usar uma URL válida do Google Maps'
      });
    }
  }

  /**
   * POST /scraper/validate-url
   * Apenas valida a URL sem fazer o scrape
   */
  static validateUrl(req, res) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ 
          valid: false,
          error: 'URL é obrigatória' 
        });
      }

      const isValid = ScraperService.isValidGoogleMapsUrl(url);

      return res.json({
        valid: isValid,
        url: url,
        message: isValid 
          ? 'URL válida do Google Maps' 
          : 'URL não parece ser do Google Maps'
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /scraper/batch
   * Fazer scrape de múltiplas URLs
   */
  static async scrapeBatch(req, res) {
    try {
      const { urls } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
          error: 'Envie um array de URLs',
          success: false
        });
      }

      // Limitar a 10 URLs por requisição
      if (urls.length > 10) {
        return res.status(400).json({
          error: 'Máximo de 10 URLs por requisição',
          success: false
        });
      }

      console.log(`📊 Scraping ${urls.length} URLs...`);

      const results = await Promise.allSettled(
        urls.map(url => 
          ScraperService.scrapeGoogleMaps(url)
            .then(data => ({
              url,
              success: true,
              data: ScraperService.normalizarDados(data)
            }))
            .catch(error => ({
              url,
              success: false,
              error: error.message
            }))
        )
      );

      const processedResults = results.map(result => result.value);
      const successCount = processedResults.filter(r => r.success).length;

      return res.json({
        success: true,
        total: urls.length,
        sucessos: successCount,
        falhas: urls.length - successCount,
        results: processedResults
      });

    } catch (error) {
      console.error('❌ Erro no scraper batch:', error.message);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /scraper/search
   * Pesquisa múltiplos resultados por termo (ex: "mecânicos em joinville")
   */
  static async searchGoogleMaps(req, res) {
    try {
      const { searchTerm } = req.body;

      // Validações
      if (!searchTerm || searchTerm.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Termo de pesquisa é obrigatório',
          exemplo: 'ex: "mecânicos em joinville"'
        });
      }

      console.log(`🔎 Buscando: "${searchTerm}"`);

      // Fazer busca
      const results = await ScraperService.searchGoogleMaps(searchTerm);

      return res.json({
        success: true,
        searchTerm,
        total: results.length,
        data: results,
        message: `${results.length} resultados encontrados!`
      });

    } catch (error) {
      console.error('❌ Erro ao buscar:', error.message);

      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao fazer a busca',
        tip: 'Certifique-se de ter Puppeteer instalado: npm install puppeteer'
      });
    }
  }
}

module.exports = ScraperController;
