# Deploy Web - Checkmate CRM

## Visão Geral
Aplicação web com:
- **Backend**: Express.js + Prisma + PostgreSQL (Supabase)
- **Frontend**: React + Vite + HashRouter (Vercel)
- **Database**: PostgreSQL (Supabase - gratuito 500MB)
- **Auth**: JWT
- **Hosting**: Vercel (gratuito)

## 🚀 Quick Start (5 minutos)

### 1. Setup Supabase
```bash
# Vá para supabase.com
# Create project > Copy CONNECTION STRING
# Guarde a senha do DB
```

👉 **Guia completo**: `SUPABASE_SETUP.md`

### 2. Deploy Backend na Vercel
```bash
cd backend
vercel --prod
# Add Environment Variables:
# - DATABASE_URL (from Supabase)
# - JWT_SECRET (random string)
# - CORS_ORIGIN (seu frontend URL)
```

### 3. Deploy Frontend
```bash
cd frontend
vercel --prod
# Add Environment Variable:
# - VITE_API_URL (seu backend URL)
```

### 4. Pronto! ✅
- Frontend: https://seu-frontend.vercel.app
- Backend: https://seu-backend.vercel.app
- Database: Supabase

---

## Pré-requisitos
1. ✅ Conta Supabase (free tier)
2. ✅ Conta Vercel (free tier)
3. ✅ GitHub com repo pushado
4. ✅ Node.js + npm

## Step-by-Step Detalhado

### Step 1: Setup Supabase

**Login / Create Account**
- [supabase.com](https://supabase.com)
- Sign up with GitHub

**Create Project**
1. "New Project"
2. Name: `checkmate-crm`
3. Password: Salve em lugar seguro!
4. Region: Escolha a mais próxima
5. Create (aguarde 2-5 min)

**Get Connection String**
1. Settings > Database
2. Connection pooling: `pgbouncer`
3. Copy the connection string

Exemplo:
```
postgresql://postgres.xxxxx:password@aws-x-xxxxx.pooler.supabase.com:6543/postgres
```

**Anote:**
- Connection String
- Database Password

### Step 2: Deploy Backend (Vercel)

**Via CLI:**
```bash
npm install -g vercel
cd backend
vercel --prod
```

**Via Dashboard:**
1. [vercel.com/dashboard](https://vercel.com/dashboard)
2. "Add New Project"
3. Import from Git > Select `check-crm`
4. Framework: `Other`
5. Root Directory: `backend`
6. **Environment Variables**:
   ```
   DATABASE_URL = postgresql://postgres.xxxxx:password@...
   JWT_SECRET = aSuperLongRandomString32CharsMinimum!
   CORS_ORIGIN = https://seu-nome-frontend.vercel.app
   NODE_ENV = production
   ```
7. Deploy

**Anote o URL**: `https://seu-backend-xxxxx.vercel.app`

### Step 3: Deploy Frontend (Vercel)

1. [vercel.com/dashboard](https://vercel.com/dashboard)
2. "Add New Project"
3. Import `check-crm`
4. Framework: `Vite`
5. Root Directory: `frontend`
6. **Environment Variables**:
   ```
   VITE_API_URL = https://seu-backend-xxxxx.vercel.app/api
   ```
7. Deploy

**Anote o URL**: `https://seu-frontend-xxxxx.vercel.app`

### Step 4: Update Backend CORS

Agora que tem o frontend URL final:

1. Vercel Dashboard > Backend Project > Settings
2. Environment Variables > `CORS_ORIGIN`
3. Mude para o URL real do frontend
4. Redeploy (automático)

### Step 5: Run Migrations

Backend precisa criar tabelas no Supabase.

**Local Machine:**
```bash
export DATABASE_URL="postgresql://postgres.xxxxx:password@..."
npx prisma migrate deploy
```

**Ou Vercel CLI:**
```bash
vercel env pull  # Pull .env from Vercel
npx prisma migrate deploy
```

### Step 6: Verificar

1. **Backend Health Check**:
   ```bash
   curl https://seu-backend.vercel.app/health
   # Resposta: {"status":"ok"}
   ```

2. **Frontend**:
   - Abra: https://seu-frontend.vercel.app
   - Teste registro com email
   - Verifique console (F12)

3. **Database** (Supabase):
   - SQL Editor > Execute:
   ```sql
   SELECT * FROM usuario LIMIT 1;
   ```

## Environment Variables

### Backend (.env ou Vercel)
```
DATABASE_URL=postgresql://postgres.xxxxx:password@pooler.supabase.com:6543/postgres
JWT_SECRET=aSuperLongRandomStringMin32CharsForSecurity!
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://seu-frontend.vercel.app
```

### Frontend (.env ou Vercel)
```
VITE_API_URL=https://seu-backend.vercel.app/api
```

## Architecture

```
┌─────────────────────────────────────┐
│  seu-frontend.vercel.app (React)    │
│  ├─ src/pages/Login.jsx             │
│  ├─ src/pages/Dashboard.jsx         │
│  └─ src/services/api.js             │
└────────────┬────────────────────────┘
             │ fetch API
             ↓
┌─────────────────────────────────────┐
│ seu-backend.vercel.app (Express)    │
│ ├─ /api/auth/register               │
│ ├─ /api/auth/login                  │
│ ├─ /api/leads                       │
│ └─ /api/interactions                │
└────────────┬────────────────────────┘
             │ SQL
             ↓
┌─────────────────────────────────────┐
│  Supabase PostgreSQL (Free)         │
│  ├─ usuario (account)               │
│  ├─ lead (contacts)                 │
│  └─ interacao (interactions)        │
└─────────────────────────────────────┘
```

## Troubleshooting

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Fix:**
- Verifique `CORS_ORIGIN` no backend
- Redeploy após mudar
- Clear cache do browser

### 401 Unauthorized
```
Error: Invalid token
```
**Fix:**
- Logout e login novamente
- Verifique JWT_SECRET é igual local/prod
- Check console.log de errors

### Database Connection Error
```
Error: connect ECONNREFUSED
```
**Fix:**
- Supabase project fully created? Aguarde 2-5 min
- DATABASE_URL copiada corretamente?
- Supabase > SQL Editor deve funcionar

### Migrations Failed
```
Error: relation "usuario" does not exist
```
**Fix:**
```bash
npx prisma migrate deploy
# Verifique em Supabase > SQL Editor > Tables
```

### Schema out of sync
```bash
npx prisma db push  # Sync from schema.prisma
# ou
npx prisma migrate reset  # ⚠️ DELETE ALL DATA and restart
```

## Common Issues & Solutions

| Erro | Causa | Solução |
|------|-------|---------|
| CORS | Backend CORS_ORIGIN diferente | Atualizar env e redeploy |
| 401 | JWT diferente | Usar mesmo JWT_SECRET |
| 404 | Routes não carregam | Verifique src/routes/*.js existe |
| DB timeout | Supabase não criado | Aguarde projeto criar completamente |
| Blank frontend | API base URL errado | Verifique VITE_API_URL |

##📚 Documentos Importantes

- `SUPABASE_SETUP.md` - Guia Supabase detalhado
- `backend/.env.example` - Template variáveis
- `frontend/.env.example` - Template frontend
- `backend/src/app.js` - Código CORS
- `frontend/src/services/api.js` - Cliente HTTP

## URLs Finais

```
Frontend:  https://seu-nome-frontend.vercel.app
Backend:   https://seu-nome-backend.vercel.app
API:       https://seu-nome-backend.vercel.app/api
Health:    https://seu-nome-backend.vercel.app/health
```

## Segurança

⚠️ **IMPORTANTE:**
- Nunca commiteie `.env` files
- Use Vercel Environment Variables
- JWT_SECRET deve ser random e longo
- DATABASE_URL é a senha - proteja!
- Mude JWT_SECRET regularmente em produção

✅ **Recomendações:**
- Use HTTPS (Vercel automático)
- Enable 2FA no Supabase/Vercel/GitHub
- Backup regular (Supabase > Backups)
- Monitor logs (Vercel & Supabase)

## Support

- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Prisma + Postgres](https://www.prisma.io/docs/orm/overview/databases/postgresql)
