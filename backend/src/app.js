require('dotenv').config();
const { setupDatabase } = require('./core/lib/database');
const express = require('express');
const cors = require('cors');
const { registerCore } = require('./core');
const { registerModules } = require('./core/modules');

// Log de ambiente
console.log('\n[Bootstrap] ============================================');
console.log('[Bootstrap] Iniciando backend (arquitetura modular)...');
console.log('[Bootstrap] IS_ELECTRON:', process.env.IS_ELECTRON);
console.log('[Bootstrap] NODE_ENV:', process.env.NODE_ENV);
console.log('[Bootstrap] DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
console.log('[Bootstrap] ============================================\n');

// Configurar banco de dados antes de importar modelos
setupDatabase();

const app = express();

// Configurar CORS (ambiente local - aceitar tudo)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ==================== REGISTRO DE ROTAS ====================
// 1. Núcleo (rotas base da plataforma)
registerCore(app);

// 2. Módulos de negócio (CRM, Prospecção, etc.)
registerModules(app);

// ==================== HANDLERS FINAIS ====================

// 404
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`✅ [Server] Listening on http://localhost:${PORT}`);
    console.log(`✅ [Server] API ready at http://localhost:${PORT}/api`);
  });
}

module.exports = app;
