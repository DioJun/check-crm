/**
 * Middleware de autenticação - DESATIVADO (modo local/desktop)
 * Sempre permite acesso com usuário padrão local
 */
function authMiddleware(req, res, next) {
  req.user = { id: 'local', email: 'local@checkmate.app', nome: 'Usuário Local' };
  next();
}

module.exports = authMiddleware;
