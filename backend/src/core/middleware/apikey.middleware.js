/**
 * Middleware de autenticação por API Key
 * Valida CRM_API_KEY enviada no header Authorization: Bearer <api_key>
 */
module.exports = (req, res, next) => {
  const apiKey = process.env.CRM_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'API not properly configured'
    });
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Missing Authorization header'
    });
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer') {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication scheme. Use: Bearer <api_key>'
    });
  }

  if (!token || token !== apiKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  next();
};
