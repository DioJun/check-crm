/**
 * Módulo Sites — Criação de sites de demonstração
 *
 * Gera sites de amostra (landing pages) para leads, com deploy no
 * Vercel, envio do link pelo WhatsApp e fluxo de fechamento de venda.
 * ⚠️ Apenas demonstração para vender o produto final.
 */
const router = require('./sites.routes');

module.exports = {
  name: 'sites',
  label: 'Sites',
  description: 'Sites de demonstração para fechamento de vendas',
  icon: 'Globe',
  register(app) {
    app.use('/api/sites', router);
    console.log(`✅ Módulo [sites] registrado em /api/sites`);
  },
};
