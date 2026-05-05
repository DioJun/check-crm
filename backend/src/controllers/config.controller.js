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
    const dbProvider = process.env.DATABASE_PROVIDER || 'postgresql';

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
    const isElectron = process.env.IS_ELECTRON === 'true';

    return res.json({
      success: true,
      capabilities: {
        desktop: isElectron ? {
          enabled: true,
          features: ['Google Maps Scraper', 'Local Database', 'Offline Mode', 'AI Analysis'],
          platform: process.platform,
          appVersion: process.env.APP_VERSION || '1.0.0',
        } : null,
        web: !isElectron ? {
          enabled: true,
          features: ['Cloud Database', 'Team Collaboration', 'AI Analysis', 'Import/Export'],
          deployment: 'Vercel',
        } : null,
        shared: [
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
