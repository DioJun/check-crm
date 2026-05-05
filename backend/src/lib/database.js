/**
 * Configuração dinâmica de banco de dados
 * - Web (Vercel): PostgreSQL (Supabase)
 * - Desktop (Electron): SQLite (local)
 */

const path = require('path');
const fs = require('fs');

function setupDatabase() {
  const isElectron = process.env.IS_ELECTRON === 'true';
  const isDev = process.env.NODE_ENV === 'development';
  const userDataPath = process.env.USER_DATA_PATH || process.cwd();

  if (isElectron) {
    // Desktop: SQLite local
    const dbPath = path.join(userDataPath, 'checkmate-crm.db');
    
    // Garantir que o diretório existe
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    process.env.DATABASE_PROVIDER = 'sqlite';
    process.env.DATABASE_URL = `file:${dbPath}`;
    
    console.log(`[Database] SQLite (Desktop) - Path: ${dbPath}`);
    
    return {
      type: 'sqlite',
      path: dbPath,
      isLocal: true,
    };
  } else {
    // Web: PostgreSQL (Supabase)
    if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
      throw new Error('DATABASE_URL ou DIRECT_URL não configurados no Vercel');
    }

    process.env.DATABASE_PROVIDER = 'postgresql';
    
    console.log('[Database] PostgreSQL (Vercel/Web)');
    
    return {
      type: 'postgresql',
      isLocal: false,
    };
  }
}

module.exports = { setupDatabase };
