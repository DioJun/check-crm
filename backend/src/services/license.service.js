const jwt = require('jsonwebtoken');

/**
 * Serviço de validação de licença/assinatura
 * 
 * Tokens JWT contêm informações do plano:
 * - plan: 'free' | 'pro' | 'enterprise'
 * - features: array de features habilitadas
 * - maxLeads: limite de leads
 * - expiresAt: data de expiração
 */

const PLAN_FEATURES = {
  free: {
    maxLeads: 50,
    features: ['import-leads', 'view-leads', 'basic-filters', 'whatsapp-contact'],
    monthlyPrice: 0,
    description: 'Até 50 leads'
  },
  pro: {
    maxLeads: 500,
    features: [
      'import-leads',
      'view-leads',
      'advanced-filters',
      'whatsapp-contact',
      'google-maps-scraper',
      'bulk-export',
      'custom-status',
      'interaction-history',
      'bulk-actions'
    ],
    monthlyPrice: 29,
    description: 'Até 500 leads + Google Maps Scraper'
  },
  enterprise: {
    maxLeads: 10000,
    features: [
      'import-leads',
      'view-leads',
      'advanced-filters',
      'whatsapp-contact',
      'google-maps-scraper',
      'bulk-export',
      'custom-status',
      'interaction-history',
      'bulk-actions',
      'api-access',
      'custom-fields',
      'webhooks',
      'priority-support'
    ],
    monthlyPrice: 99,
    description: 'Ilimitado + API + Webhooks'
  }
};

class LicenseService {
  /**
   * Validar token de licença JWT
   * @param {string} token - Token JWT retornado pelo servidor de autenticação
   * @param {string} secret - JWT_SECRET para verificar assinatura
   * @returns {Object} Dados decodificados do token
   */
  static validateToken(token, secret) {
    try {
      const decoded = jwt.verify(token, secret);
      
      // Validar estrutura mínima
      if (!decoded.id || !decoded.email || !decoded.plan) {
        throw new Error('Token inválido: faltam campos obrigatórios');
      }
      
      // Validar plano
      if (!PLAN_FEATURES[decoded.plan]) {
        throw new Error(`Plano desconhecido: ${decoded.plan}`);
      }
      
      return {
        ...decoded,
        features: PLAN_FEATURES[decoded.plan].features,
        maxLeads: PLAN_FEATURES[decoded.plan].maxLeads,
        isValid: true,
      };
    } catch (error) {
      console.error('❌ Token inválido:', error.message);
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  /**
   * Gerar token de licença (usado no servidor SaaS remoto)
   * @param {Object} user - Dados do usuário
   * @param {string} plan - Plano ('free', 'pro', 'enterprise')
   * @param {string} secret - JWT_SECRET
   * @param {number} expiresIn - Expiração em segundos (padrão: 30 dias)
   * @returns {string} Token JWT
   */
  static generateToken(user, plan = 'free', secret, expiresIn = '30d') {
    if (!PLAN_FEATURES[plan]) {
      throw new Error(`Plano inválido: ${plan}`);
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        nome: user.nome,
        plan: plan,
        features: PLAN_FEATURES[plan].features,
        maxLeads: PLAN_FEATURES[plan].maxLeads,
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      { expiresIn }
    );

    return token;
  }

  /**
   * Verificar se um usuário pode acessar uma feature
   */
  static canUseFeature(decodedToken, featureName) {
    if (!decodedToken.isValid) return false;
    return Array.isArray(decodedToken.features) && 
           decodedToken.features.includes(featureName);
  }

  /**
   * Verificar se usuário atingiu limite de leads
   */
  static canAddLead(decodedToken, currentLeadCount) {
    if (!decodedToken.isValid) return false;
    return currentLeadCount < decodedToken.maxLeads;
  }

  /**
   * Obter informações do plano
   */
  static getPlanInfo(plan) {
    return PLAN_FEATURES[plan] || null;
  }

  /**
   * Listar todos os planos disponíveis
   */
  static getAllPlans() {
    return Object.entries(PLAN_FEATURES).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }
}

module.exports = LicenseService;
