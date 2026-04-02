const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nome: user.nome },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
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
    data: { nome, email, senha: hashedSenha },
  });

  const token = generateToken(user);
  return { token, user: { id: user.id, nome: user.nome, email: user.email } };
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

  const token = generateToken(user);
  return { token, user: { id: user.id, nome: user.nome, email: user.email } };
}

module.exports = { register, login };
