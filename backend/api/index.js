// Vercel serverless function entry point.
// Vercel imports this module and calls it as an HTTP handler, so we simply
// re-export the configured Express app from src/app.js.
const app = require('../src/app');

module.exports = app;
