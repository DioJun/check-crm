const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const LicenseService = require('./license.service');

/**
 * Gerar token JWT com informações de licença
 * Em produção, o plano vem do banco da SaaS remota
 * Em dev, usa plano padrão baseado no usuário local
 */
function generateToken(user, plan = 'free') {
  return LicenseService.generateToken(
    user,
    plan,
    process.env.JWT_SECRET,
    '30d'
  );
}

async function register(nome, email, senha) {
  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('Email já cadastrado');
    err.status = 409;
    throw err;
  }

  const hashedSenha = await bcrypt.hash(senha, 10);
  const user = await prisma.usuario.create({
    data: { 
      nome, 
      email, 
      senha: hashedSenha,
      // Em produção SaaS, esses dados viriam do servidor remoto
      plan: 'free'
    },
  });

  const token = generateToken(user, user.plan || 'free');
  return { 
    token, 
    user: { 
      id: user.id, 
      nome: user.nome, 
      email: user.email,
      plan: user.plan || 'free'
    } 
  };
}

async function login(email, senha) {
  const user = await prisma.usuario.findUnique({ where: { email } });
  if (!user) {
    const err = new Error('Credenciais inválidas');
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(senha, user.senha);
  if (!valid) {
    const err = new Error('Credenciais inválidas');
    err.status = 401;
    throw err;
  }

  const token = generateToken(user, user.plan || 'free');
  return { 
    token, 
    user: { 
      id: user.id, 
      nome: user.nome, 
      email: user.email,
      plan: user.plan || 'free'
    } 
  };
}

module.exports = { register, login };
