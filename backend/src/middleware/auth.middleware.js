const jwt = require('jsonwebtoken');
const LicenseService = require('../services/license.service');

/**
 * Middleware de autenticação + validação de licença
 * Valida o token JWT e carrega informações de plano/features
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Descodificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Validar licença (contém informações de plano)
    const license = LicenseService.validateToken(token, process.env.JWT_SECRET);
    
    if (!license.isValid) {
      return res.status(401).json({ error: 'Licença inválida: ' + license.error });
    }

    // Anexar usuário e licença ao request
    req.user = decoded;
    req.license = license;
    
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/**
 * Middleware para validar acesso a um recurso específico
 * @param {string} featureName - Nome da feature (ex: 'google-maps-scraper')
 */
function requireFeature(featureName) {
  return (req, res, next) => {
    if (!req.license || !LicenseService.canUseFeature(req.license, featureName)) {
      return res.status(403).json({ 
        error: `Feature "${featureName}" não disponível no seu plano`,
        plan: req.license?.plan || 'unknown',
        requiredPlan: 'pro' // Ajustar conforme necessário
      });
    }
    next();
  };
}

module.exports = authMiddleware;
module.exports.requireFeature = requireFeature;
