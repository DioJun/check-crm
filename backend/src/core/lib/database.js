/**
 * Configuração do banco de dados SQLite local
 */

const path = require('path');
const fs = require('fs');

function setupDatabase() {
  const dbPath = path.join(__dirname, '..', '..', 'dev.db');
  
  // Só define se ainda não foi definido (prioriza .env)
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'file:./dev.db') {
    process.env.DATABASE_URL = `file:${dbPath}`;
  }
  
  process.env.DATABASE_PROVIDER = 'sqlite';
  
  console.log(`[Database] SQLite - Path: ${process.env.DATABASE_URL}`);
  
  return {
    type: 'sqlite',
    path: dbPath,
    isLocal: true,
  };
}

module.exports = { setupDatabase };
