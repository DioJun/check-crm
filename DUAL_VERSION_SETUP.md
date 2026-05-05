# Implementação Dual-Version (Web + Desktop)

## Visão Geral

O Check-CRM agora está disponível em **duas versões**:

1. **Web** - Hospedada em `https://check-crm.vercel.app`
   - Funciona em qualquer navegador
   - Banco de dados em PostgreSQL (Supabase)
   - Sem acesso ao Google Maps Scraper
   - Ideal para uso em equipe e multiplataforma

2. **Desktop** - Versão Electron com SQLite
   - Instalável em Windows, macOS e Linux
   - Banco de dados local (SQLite)
   - Acesso ao **Google Maps Scraper com Puppeteer**
   - Análise AI (Gemini)
   - Funciona offline (quando implementado)

---

## Ativação da Versão Electron (Desktop)

### Pré-requisitos

- Node.js 18+ instalado
- Git (para clonar o repositório)
- 500MB de espaço livre (aproximadamente)

### Passos para Rodar Localmente

#### 1. Instalar Dependências

```bash
npm install
```

#### 2. Instalar Dependências do Backend

```bash
cd backend
npm install
cd ..
```

#### 3. Rodar Desenvolvimento Completo (Web + Desktop)

```bash
npm run dev:all
```

Isso vai:
- Iniciar o backend Node.js (porta 3001)
- Iniciar o frontend React (porta 5173)
- Iniciar o Electron e carregar a aplicação

#### 4. Ou Rodar Separadamente

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

**Terminal 3 - Electron:**
```bash
npm run dev:electron
```

---

## Estrutura de Ambientes

### Web (Vercel)

Quando `IS_ELECTRON=false`:
- **Database Provider**: PostgreSQL
- **Database URL**: Supabase (DIRECT_URL usado)
- **Google Maps Scraper**: ❌ Desabilitado (403 Forbidden)
- **Ambiente**: Production (Vercel)

Variáveis de Ambiente Necessárias:
```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=...
GEMINI_API_KEY=...
CORS_ORIGIN=...
```

### Desktop (Electron)

Quando `IS_ELECTRON=true`:
- **Database Provider**: SQLite
- **Database URL**: `file:${userData}/checkmate-crm.db`
- **Google Maps Scraper**: ✅ Habilitado (Puppeteer)
- **Ambiente**: Development ou Production (packaged)

Variáveis de Ambiente (auto-geradas em `backend/.env`):
```
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:/path/to/checkmate-crm.db
IS_ELECTRON=true
JWT_SECRET=...
PORT=3001
CORS_ORIGIN=http://localhost:5173,http://localhost:3001
```

---

## Configuração Automática

### Backend (`electron/main.js`)

O arquivo `electron/main.js` **automaticamente**:

1. ✅ Detecta se está rodando em Electron
2. ✅ Define `IS_ELECTRON=true` na variável de ambiente
3. ✅ Cria arquivo `.env` com SQLite se não existir
4. ✅ Instala dependências do backend (npm install)
5. ✅ Executa migrações Prisma
6. ✅ Inicia o backend Node.js (porta 3001)
7. ✅ Carrega React DevServer (localhost:5173) em dev
8. ✅ Carrega build estático em produção

### Frontend

O componente GoogleMapsScraper **automaticamente**:

1. Verifica `/api/config/environment` ao abrir
2. Se `isElectron = false` → mostra mensagem de não disponível
3. Se `isElectron = true` → habilita scraper com Puppeteer

---

## APIs de Configuração

### GET `/api/config/environment`

Retorna informações do ambiente:

```json
{
  "success": true,
  "environment": {
    "isElectron": true,
    "isDevelopment": true,
    "isProduction": false,
    "databaseProvider": "sqlite",
    "version": "1.0.0"
  },
  "features": {
    "googleMapsScraper": true,
    "aiAnalysis": true,
    "spreadsheetImport": true,
    "pipelineKanban": true
  },
  "timestamp": "2024-05-10T..."
}
```

### GET `/api/config/capabilities`

Retorna lista de funcionalidades por versão:

```json
{
  "success": true,
  "capabilities": {
    "desktop": {
      "enabled": true,
      "features": [
        "Google Maps Scraper",
        "Local Database",
        "Offline Mode",
        "AI Analysis"
      ]
    },
    "shared": [
      "Lead Management",
      "Pipeline Kanban",
      "AI Analysis with Gemini",
      ...
    ]
  }
}
```

---

## Google Maps Scraper (Desktop Only)

### Como Funciona

1. **Puppeteer + Stealth Plugin** - Simula navegador real
2. **User-Agent Rotation** - Evita bloqueios do Google
3. **Delays Humanizados** - Comportamento realista
4. **Cache em Memória** - Valida por 24h

### Endpoints

**POST `/api/scraper/google-maps`** (Apenas em Electron)

Request:
```json
{
  "url": "https://www.google.com/maps/place/..."
}
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "nome": "Empresa XYZ",
      "telefone": "+55 11 98765-4321",
      "endereco": "Rua ABC, 123",
      "avaliacoes": "4.8",
      "website": "https://...",
      "horario": "Seg-Sex: 9:00-18:00"
    }
  ]
}
```

**Erro (Web/Vercel):**
```json
{
  "success": false,
  "error": "Google Maps Scraper não disponível nesta versão",
  "message": "Este recurso está disponível apenas na versão Desktop (Electron)"
}
```

---

## Build para Distribuição

### Gerar Executáveis

```bash
npm run dist
```

Isso vai:
1. Build do frontend (React)
2. Build Electron com electron-builder
3. Gerar:
   - Windows: `dist/Checkmate CRM Setup 1.0.0.exe`
   - macOS: `dist/Checkmate CRM 1.0.0.dmg`
   - Linux: `dist/checkmate-crm 1.0.0.AppImage`

### Distribuir

Fazer upload dos arquivos em `dist/` para um servidor de distribuição.

---

## Debugging

### Verificar Variáveis de Ambiente

**No Backend (terminal):**
```
[Env] DATABASE_URL: file:/path/to/checkmate-crm.db
[Env] IS_ELECTRON: true
[Database] SQLite (Desktop) - Path: ...
```

**No Frontend (console do browser):**
```javascript
// No DevTools (F12)
const config = await fetch('/api/config/environment').then(r => r.json());
console.log(config);
```

### Logs do Electron

Em desenvolvimento, abra DevTools: `View → Toggle Developer Tools`

Procure por:
- `[Backend]` - logs do backend
- `[Database]` - informações de banco
- `[Scraper]` - logs do scraper

---

## Roadmap Futuro

- [ ] Sincronização Web ↔ Desktop
- [ ] Modo offline completo
- [ ] Notificações do sistema
- [ ] Auto-update do executável
- [ ] Suporte a múltiplas contas
- [ ] Backup automático local

---

## FAQ

**P: Preciso de Electron para usar o CRM?**
R: Não! A versão Web (vercel.app) funciona perfeitamente sem Electron. Electron é apenas se você quer o scraper do Google Maps.

**P: Posso sincronizar dados entre Web e Desktop?**
R: Ainda não, mas está planejado. Por enquanto, são bancos de dados separados.

**P: O scraper funciona em Vercel?**
R: Não. Puppeteer não é suportado em serverless (Vercel). Apenas em desktop local.

**P: Como faço backup do banco SQLite?**
R: O arquivo está em `~/.config/Checkmate CRM/checkmate-crm.db` (Linux/macOS) ou `%APPDATA%\Checkmate CRM\checkmate-crm.db` (Windows).

---

## Troubleshooting

### Backend não inicia

```
[Backend] Backend não respondeu após 30 segundos
```

**Causa**: Node.js não instalado ou dependências faltando.

**Solução**:
```bash
node --version  # Verificar instalação
cd backend && npm install --no-save
```

### Erro "FATAL: DATABASE_URL not configured"

**Causa**: Arquivo `.env` não gerado.

**Solução**: Deletar `backend/.env` e reiniciar Electron (vai regenerar).

### Google Maps Scraper não funciona no Desktop

**Verificar**: `/api/config/environment` retorna `isElectron: true`?

Se não, a variável de ambiente não foi configurada. Verificar `electron/main.js`.

---

**Versão**: 1.0.0  
**Última atualização**: 2024-05-10  
**Mantido por**: Dioni
