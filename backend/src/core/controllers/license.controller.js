const LicenseService = require('../services/license.service');
const prisma = require('../lib/prisma');

/**
 * GET /license/plans
 * Listar todos os planos disponíveis
 */
async function listPlans(req, res) {
  try {
    const plans = LicenseService.getAllPlans();
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /license/current
 * Obter informações de licença do usuário atual
 * Requer autenticação
 */
async function getCurrentLicense(req, res) {
  try {
    if (!req.license) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const planInfo = LicenseService.getPlanInfo(req.license.plan);
    
    res.json({ 
      success: true, 
      license: {
        ...req.license,
        planInfo
      }
    });
  } catch (error) {
    console.error('Erro ao obter licença:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /license/validate
 * Validar um token JWT de licença
 * Útil para sincronizar com servidor SaaS remoto
 */
async function validateToken(req, res) {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token não fornecido' });
    }

    const license = LicenseService.validateToken(token, process.env.JWT_SECRET);
    
    if (!license.isValid) {
      return res.status(401).json({ 
        success: false,
        error: license.error 
      });
    }

    res.json({ 
      success: true, 
      license,
      planInfo: LicenseService.getPlanInfo(license.plan)
    });
  } catch (error) {
    console.error('Erro ao validar token:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /license/usage
 * Obter utilização de recursos do plano
 * (ex: quantos leads já foram criados vs limite)
 * Requer autenticação
 */
async function getUsage(req, res) {
  try {
    if (!req.license) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Contar leads do usuário
    const leadCount = await prisma.lead.count();
    
    const planInfo = LicenseService.getPlanInfo(req.license.plan);
    const usage = {
      leads: {
        current: leadCount,
        max: planInfo.maxLeads,
        percentUsed: Math.round((leadCount / planInfo.maxLeads) * 100),
        canAddMore: leadCount < planInfo.maxLeads
      },
      features: planInfo.features,
      plan: req.license.plan
    };

    res.json({ success: true, usage });
  } catch (error) {
    console.error('Erro ao calcular uso:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listPlans,
  getCurrentLicense,
  validateToken,
  getUsage
};
