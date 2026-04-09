# Deploy Web - Checkmate CRM

## Visão Geral
Aplicação web com:
- **Backend**: Express.js + Prisma + SQLite (Vercel Serverless)
- **Frontend**: React + Vite + HashRouter (Vercel Static)
- **Database**: PostgreSQL (recomendado) ou SQLite com backup
- **Auth**: JWT

## Pré-requisitos
1. Conta Vercel (vercel.com)
2. GitHub com repo pushado
3. Variáveis de ambiente configuradas

## Step 1: Preparar Repositório

```bash
# Verificar status
git status
git log --oneline -5

# Se precisar de commits
git add -A
git commit -m "chore: Prepare for web deployment"
git push origin main
```

## Step 2: Deploy Backend (Vercel)

### Via CLI:
```bash
npm i -g vercel

# Na pasta backend/
cd backend
vercel --prod
```

### Via Dashboard:
1. Vá para vercel.com/dashboard
2. "Import Project"
3. Selecione GitHub repo
4. Root Directory: `backend`
5. Automatic Deployments: ✓ (padrão)
6. Framework: `Other` (Node.js)
7. Add Environment Variables:
   - `DATABASE_URL`: "postgresql://..." (ou SQLite file)
   - `JWT_SECRET`: random string (32+ chars)
   - `NODE_ENV`: production
   - `CORS_ORIGIN`: "https://seu-frontend.vercel.app"

Anote o URL: `https://seu-backend.vercel.app`

## Step 3: Deploy Frontend (Vercel)

### Via CLI:
```bash
cd frontend
vercel --prod
```

### Via Dashboard:
1. Add Environment Variables:
   - `VITE_API_BASE_URL`: "https://seu-backend.vercel.app"
2. Build Settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Deploy

Anote o URL: `https://seu-frontend.vercel.app`

## Step 4: Atualizar Backend CORS

1. Vá para Vercel Dashboard > Backend Project
2. Settings > Environment Variables
3. Atualize `CORS_ORIGIN` com o URL do frontend
4. Re-deploy (ou automático)

## Step 5: Testar

1. Abra frontend: https://seu-frontend.vercel.app
2. Teste registro/login
3. Verifique console (F12) para erros de API

## Database Setup

### Opção 1: PostgreSQL (Recomendado)
```
Use Vercel Postgres ou Neon/Supabase

DATABASE_URL="postgresql://user:pass@host:5432/db"
```

### Opção 2: SQLite (Desenvolvimento)
```
DATABASE_URL="file:./prisma/dev.db"
Backup manual necessário
```

## Variáveis de Ambiente Resumidas

**Backend (vercel/backend/.env.production):**
```
DATABASE_URL=postgresql://...
JWT_SECRET=seu_secret_muito_longo_aqui_pelo_menos_32_chars
NODE_ENV=production
CORS_ORIGIN=https://seu-frontend.vercel.app
PORT=3000
```

**Frontend (vercel/frontend/.env.production):**
```
VITE_API_BASE_URL=https://seu-backend.vercel.app
```

## Troubleshooting

### CORS Error
- Verifique `CORS_ORIGIN` no backend
- Tab Network vê erro 401 ou 403?

### 404 Page Not Found
- Frontend usa HashRouter (#) por isso funciona no file://
- Vercel já tem rewrite para /index.html configurado

### Database Connection
- Teste URL localmente: `npx prisma db push`
- Verifique variáveis no Vercel Dashboard

### Prisma Migration
- Não execute manualmente na Vercel
- Prisma migrate deploy roda automaticamente quando declarado

## URLs Esperadas

```
Frontend:  https://seu-nome.vercel.app
Backend:   https://seu-nome-api.vercel.app ou mesmo projeto
API Routes:
  POST   /api/auth/register
  POST   /api/auth/login
  GET    /api/auth/me
  GET    /api/leads
  POST   /api/leads
  ...etc
```

## Quick Commands

```bash
# Verificar status
vercel --list

# Ver logs
vercel logs --follow

# Rebuild
vercel deploy --force

# Cancelar deployment
vercel remove [project-name]
```

## Notas Importantes

⚠️ **Não committeie .env files** - use Vercel Dashboard para secrets  
⚠️ **SQLite em Vercel**: Ephemeral filesystem - dados perdem entre deploys  
⚠️ **JWT_SECRET**: Deve ser aleatório e seguro, nunca igual em dev/prod  
✅ **Recomendação**: Use PostgreSQL gratuito (Vercel Postgres ou Neon)
