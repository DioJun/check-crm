/**
 * Módulo Prospecção — Google Maps Scraper
 * 
 * Busca automatizada de negócios no Google Maps
 * e extração de dados de prospecção.
 */
const scraperRouter = require('./scraper.routes');

module.exports = {
  name: 'prospection',
  label: 'Prospecção',
  description: 'Google Maps Scraper para captura de leads',
  icon: 'MapPin',
  register(app) {
    app.use('/api/scraper', scraperRouter);
    console.log(`✅ Módulo [prospection] registrado em /api/scraper`);
  },
};
