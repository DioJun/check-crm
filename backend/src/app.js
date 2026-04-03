require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const leadRoutes = require('./routes/lead.routes');
const interactionRoutes = require('./routes/interaction.routes');
const scraperRoutes = require('./routes/scraper.routes');

const app = express();

// Simple CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'TemplatesHub CRM Backend' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'TemplatesHub CRM API', version: '1.0.0', health: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/scraper', scraperRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error',
    status: err.status || 500
  });
});

// Only start the HTTP server when this file is run directly (local dev).
// On Vercel the module is imported by api/index.js and used as a handler.
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
