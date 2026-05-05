/**
 * Rotas de Configuração
 * GET /config/* endpoints
 */

const express = require('express');
const router = express.Router();
const ConfigController = require('../controllers/config.controller');

/**
 * GET /config/environment
 * Retorna informações do ambiente (Web vs Desktop)
 */
router.get('/environment', (req, res) => ConfigController.getEnvironment(req, res));

/**
 * GET /config/capabilities
 * Retorna lista de funcionalidades disponíveis
 */
router.get('/capabilities', (req, res) => ConfigController.getCapabilities(req, res));

module.exports = router;
