const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Garantir que o caminho do SQLite resolve corretamente independente do CWD
const dbPath = path.resolve(__dirname, '../../dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
