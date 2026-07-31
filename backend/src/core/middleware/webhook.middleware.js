const crypto = require('crypto');

/**
 * Middleware para validar webhook HMAC signature
 * Header esperado: X-Webhook-Signature: sha256=<signature>
 */
module.exports = (req, res, next) => {
  const secret = process.env.CRM_WEBHOOK_SECRET;
  
  if (!secret) {
    console.warn('[Webhook] CRM_WEBHOOK_SECRET não configurado');
    return res.status(500).json({
      success: false,
      error: 'Webhook not properly configured'
    });
  }

  const signature = req.headers['x-webhook-signature'];
  
  if (!signature) {
    return res.status(401).json({
      success: false,
      error: 'Missing X-Webhook-Signature header'
    });
  }

  // Extrair hash do header (formato: sha256=<hash>)
  const [algo, hash] = signature.split('=');
  
  if (!hash || algo !== 'sha256') {
    return res.status(401).json({
      success: false,
      error: 'Invalid signature format. Expected: sha256=<hash>'
    });
  }

  // Calcular HMAC com body
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Comparação segura (timing-safe)
  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash))) {
    return res.status(403).json({
      success: false,
      error: 'Invalid webhook signature'
    });
  }

  next();
};

/**
 * Função helper para gerar signature HMAC
 * Usar ao enviar webhooks para clientes
 */
function generateWebhookSignature(payload, secret) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

module.exports.generateWebhookSignature = generateWebhookSignature;
