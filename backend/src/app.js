require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const leadRoutes = require('./routes/lead.routes');
const interactionRoutes = require('./routes/interaction.routes');
const scraperRoutes = require('./routes/scraper.routes');

const app = express();

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

    // Allow requests with no origin (like mobile apps or Vercel Functions)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      console.warn(`Allowed origins: ${allowedOrigins.join(', ')}`);
      // Em prod, descomentar: callback(new Error('Not allowed by CORS'));
      callback(null, true); // Permitir por enquanto para debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};

app.use(cors(corsOptions));

// Log CORS info on startup (simplified for Vercel)
if (process.env.CORS_ORIGIN) {
  console.log('CORS configured for:', process.env.CORS_ORIGIN);
}

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'TemplatesHub CRM Backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/scraper', scraperRoutes);

// Only start the HTTP server when this file is run directly (local dev).
// On Vercel the module is imported by api/index.js and used as a handler.
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
