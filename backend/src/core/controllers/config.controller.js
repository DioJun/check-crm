/**
 * Controller de Configuração da Aplicação
 * Retorna informações sobre o ambiente (Web vs Desktop)
 */

class ConfigController {
  /**
   * GET /config/environment
   * Retorna informações do ambiente de execução
   */
  static getEnvironment(req, res) {
    const isElectron = process.env.IS_ELECTRON === 'true';
    const isProd = process.env.NODE_ENV === 'production';
    const dbProvider = process.env.DATABASE_PROVIDER || 'sqlite';

    console.log('[ConfigController] Environment check:');
    console.log('[ConfigController]   IS_ELECTRON env var:', process.env.IS_ELECTRON);
    console.log('[ConfigController]   isElectron boolean:', isElectron);
    console.log('[ConfigController]   GoogleMaps Scraper enabled:', isElectron);

    return res.json({
      success: true,
      environment: {
        isElectron,
        isDevelopment: !isProd,
        isProduction: isProd,
        databaseProvider: dbProvider,
        version: process.env.APP_VERSION || '1.0.0',
      },
      features: {
        googleMapsScraper: isElectron, // Apenas em Electron/Desktop
        aiAnalysis: true, // Disponível em ambas as versões
        spreadsheetImport: true, // Disponível em ambas as versões
        pipelineKanban: true, // Disponível em ambas as versões
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /config/capabilities
   * Retorna quais funcionalidades estão disponíveis
   */
  static getCapabilities(req, res) {
    return res.json({
      success: true,
      capabilities: {
        desktop: {
          enabled: true,
          features: ['Google Maps Scraper', 'Local Database', 'AI Analysis'],
          platform: process.platform,
          appVersion: process.env.APP_VERSION || '1.0.0',
        },
        features: [
          'Lead Management',
          'Pipeline Kanban',
          'AI Analysis with Gemini',
          'Phone Normalization',
          'Spreadsheet Import',
          'Lead Interactions',
        ],
      },
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = ConfigController;
