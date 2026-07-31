/**
 * Núcleo da Plataforma — rotas base (auth, config, license, health)
 * 
 * Estas rotas são independentes de qualquer módulo de negócio.
 */
const authRoutes = require('./routes/auth.routes');
const configRoutes = require('./routes/config.routes');
const licenseRoutes = require('./routes/license.routes');

/**
 * Registra as rotas do núcleo no app Express.
 * @param {import('express').Express} app
 */
function registerCore(app) {
  // Favicon (prevent 404 errors)
  app.get('/favicon.ico', (req, res) => res.status(204).send());
  app.get('/favicon.svg', (req, res) => res.status(204).send());

  // Health check
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/', (req, res) => res.json({ message: 'Checkmate Platform API' }));

  // Rotas do núcleo
  try {
    app.use('/api/auth', authRoutes);
    console.log('✅ Core: auth em /api/auth');
  } catch (err) {
    console.error('❌ Core auth error:', err.message);
  }

  try {
    app.use('/api/config', configRoutes);
    console.log('✅ Core: config em /api/config');
  } catch (err) {
    console.error('❌ Core config error:', err.message);
  }

  try {
    app.use('/api/license', licenseRoutes);
    console.log('✅ Core: license em /api/license');
  } catch (err) {
    console.error('❌ Core license error:', err.message);
  }
}

module.exports = { registerCore };
