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
    const result = await authService.login(email, senha);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = { register, login };
