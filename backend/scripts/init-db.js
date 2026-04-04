const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../dev.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "senha" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "cidade" TEXT,
    "servico" TEXT,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "origem" TEXT,
    "dataEntrada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaInteracao" DATETIME,
    "avaliacao" TEXT,
    "reviews" TEXT,
    "temWhatsapp" BOOLEAN,
    "temSite" BOOLEAN,
    "site" TEXT
  );

  CREATE TABLE IF NOT EXISTS "Interacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'mensagem',
    "conteudo" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interacao_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS "Interacao_leadId_idx" ON "Interacao"("leadId");
`);

console.log('✅ Banco de dados SQLite initialized successfully at:', dbPath);
db.close();
