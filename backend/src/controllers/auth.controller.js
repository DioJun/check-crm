const authService = require('../services/auth.service');

async function register(req, res) {
  try {
    const { nome, email, senha } = req.body;
    const result = await authService.register(nome, email, senha);
    return res.status(201).json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    
    const result = await authService.login(email, senha);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Auth Login Error]', err);
    
    // Se for erro de banco de dados, tentar diagnosticar
    if (err.message && (err.message.includes('FATAL') || err.message.includes('SQLITE'))) {
      return res.status(500).json({ 
        error: 'Erro ao conectar ao banco de dados',
        details: 'Verifique se o banco SQLite foi criado corretamente' 
      });
    }
    
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = { register, login };
