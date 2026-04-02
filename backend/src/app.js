require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const leadRoutes = require('./routes/lead.routes');
const interactionRoutes = require('./routes/interaction.routes');

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'TemplatesHub CRM Backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/interactions', interactionRoutes);

// Only start the HTTP server when this file is run directly (local dev).
// On Vercel the module is imported by api/index.js and used as a handler.
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
