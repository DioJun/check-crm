require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Configurar CORS
app.use(cors({
  origin: function (origin, callback) {
    // Em desenvolvimento, aceitar localhost
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Em produção, aceitar qualquer vercel.app
    if (origin && origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // Aceitar origens configuradas via ENV
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn('[CORS] Bloqueado:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Favicon (prevent 404 errors)
app.get('/favicon.ico', (req, res) => {
  res.status(204).send();
});

app.get('/favicon.svg', (req, res) => {
  res.status(204).send();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ message: 'CRM API v1.0' });
});

// Try loading auth routes
try {
  const authRoutes = require('./routes/auth.routes');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded at /api/auth');
} catch (err) {
  console.error('❌ Auth routes error:', err.message);
  console.error(err.stack);
}

// Try loading lead routes
try {
  const leadRoutes = require('./routes/lead.routes');
  app.use('/api/leads', leadRoutes);
} catch (err) {
  console.error('Lead routes error:', err.message);
}

// Try loading interaction routes
try {
  const interactionRoutes = require('./routes/interaction.routes');
  app.use('/api/interactions', interactionRoutes);
} catch (err) {
  console.error('Interaction routes error:', err.message);
}

// Try loading scraper routes
try {
  const scraperRoutes = require('./routes/scraper.routes');
  app.use('/api/scraper', scraperRoutes);
  console.log('✅ Scraper routes loaded at /api/scraper');
} catch (err) {
  console.error('❌ Scraper routes error:', err.message);
}

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
