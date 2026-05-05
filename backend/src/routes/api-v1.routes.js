const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/apikey.middleware');
const { 
  listLeads, 
  getLead, 
  createLead, 
  updateLead, 
  deleteLead 
} = require('../controllers/v1-api.controller');

/**
 * API v1 - Rotas públicas com autenticação por API Key
 * Todas as rotas requerem header: Authorization: Bearer <CRM_API_KEY>
 */

// Leads endpoints
router.get('/leads', apiKeyAuth, listLeads);
router.get('/leads/:id', apiKeyAuth, getLead);
router.post('/leads', apiKeyAuth, createLead);
router.patch('/leads/:id', apiKeyAuth, updateLead);
router.delete('/leads/:id', apiKeyAuth, deleteLead);

module.exports = router;
