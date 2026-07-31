const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const licenseController = require('../controllers/license.controller');

const router = express.Router();

/**
 * Rotas de Licença/Planos
 * 
 * POST   /license/validate       - Validar token (sem auth necessária)
 * GET    /license/plans          - Listar planos (público)
 * GET    /license/current        - Licença do usuário atual (requer auth)
 * GET    /license/usage          - Uso de recursos (requer auth)
 */

// Públicas (sem autenticação)
router.get('/plans', licenseController.listPlans);
router.post('/validate', licenseController.validateToken);

// Protegidas (requer token válido)
router.get('/current', authMiddleware, licenseController.getCurrentLicense);
router.get('/usage', authMiddleware, licenseController.getUsage);

module.exports = router;
