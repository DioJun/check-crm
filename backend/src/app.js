require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Configurar CORS para múltiplos origins
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = ['http://localhost:5173', 'https://check-crm-opf9.vercel.app', 'localhost'];
    
    // Se for desenvolvimento ou origin está na lista
    if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Basic routes (test first)
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
} catch (err) {
  console.error('Auth routes error:', err.message);
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
app.use((req, res) => res.status(404).json({ error: 'not found' }));

// Error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

if (require.main === module) {
  app.listen(process.env.PORT || 3001);
}

module.exports = app;
