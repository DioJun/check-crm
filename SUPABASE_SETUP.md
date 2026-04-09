# Supabase Setup - Checkmate CRM

## 1️⃣ Criar Projeto Supabase

### Passo 1: Registrar
1. Vá para [supabase.com](https://supabase.com)
2. Sign up com GitHub
3. Create new project
4. **Project Name**: `checkmate-crm`
5. **Database Password**: Salve em lugar seguro
6. **Region**: Escolha mais próximo (ex: São Paulo se disponível)
7. Aguarde criar (2-5 minutos)

### Passo 2: Pegar CONNECTION STRING

Na dashboard Supabase:
1. **Settings** > **Database** > **Connection string**
2. Selecione **pgbouncer** mode (melhor para Vercel)
3. Copie a string

Exemplo:
```
postgresql://postgres.xxxxxxxxxxx:sua_senha@aws-x-xxxxx.pooler.supabase.com:6543/postgres
```

## 2️⃣ Configurar Vercel com Supabase

### Backend (Vercel)

1. Vá para [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecione projeto **Backend** (ou crie novo)
3. **Settings** > **Environment Variables**
4. Adicione:

```
DATABASE_URL = postgresql://postgres.xxxxxxxxxxx:sua_senha@aws-x-xxxxx.pooler.supabase.com:6543/postgres
JWT_SECRET = seu_secret_muito_longo_aqui_min_32_caracteres
CORS_ORIGIN = https://seu-frontend.vercel.app
NODE_ENV = production
```

5. **Redeploy** automático ativa

### Frontend (Vercel)

1. Selecione projeto **Frontend**
2. **Settings** > **Environment Variables**
3. Adicione:

```
VITE_API_URL = https://seu-backend.vercel.app/api
```

4. **Redeploy**

## 3️⃣ Executar Migrações

Supabase roda PostgreSQL, não SQLite. Precisa aplicar schema:

### Via CLI (Recomendado)

```bash
# Instalar Prisma CLI
npm install -D prisma

# Criar nova migração
npx prisma migrate deploy

# Ou resetar tudo (⚠️ apaga dados)
npx prisma migrate reset
```

### Via Vercel (Automático)

Adicione um `build.sh`:

```bash
#!/bin/bash
npm install
npx prisma migrate deploy
npm run build
```

Mas Vercel não suporta scripts personalizados nativamente. **Manualmente é melhor.**

## 4️⃣ Verificar Schema no Supabase

1. Supabase Dashboard > **SQL Editor**
2. Execute query:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

Deve retornar:
- `usuario`
- `lead`
- `interacao`

## 5️⃣ Testar Backend

```bash
# Local
DATABASE_URL="postgresql://..." npm run dev

# Ou produção
curl https://seu-backend.vercel.app/health
# Resposta: {"status":"ok"}
```

## 6️⃣ Testar Frontend

1. Abra browser: `https://seu-frontend.vercel.app`
2. **Register** com email  
3. Verifique console (F12) para erros
4. Backend logs em Vercel Dashboard

## 🔧 Environment Variables Resumidas

| Variável | Valor | Onde |
|----------|-------|------|
| `DATABASE_URL` | Supabase Connection String | Backend .env |
| `JWT_SECRET` | Random 32+ chars | Backend .env |
| `CORS_ORIGIN` | Frontend URL | Backend .env |
| `VITE_API_URL` | Backend API URL | Frontend .env |
| `NODE_ENV` | `production` | Backend .env |

## 🐛 Troubleshooting

### Erro: "connection timeout"
- Supabase pode estar iniciado
- Aguarde 1-2 min após criar projeto
- Teste connection via pgAdmin

### Erro: CORS bloqueado
- Verifique `CORS_ORIGIN` no backend
- Redeploy após mudar
- Clear browser cache (Ctrl+Shift+Delete)

### Erro: "relation does not exist"
- Migrations não rodaram
- Execute: `npx prisma migrate deploy`
- Verifique SQL Editor no Supabase

### Erro: 401 Unauthorized
- JWT_SECRET diferente entre dev/prod?
- Token expirado? Faça logout
- Re-login

## 💡 Dicas

✅ **Backup Regular**: Supabase > Database > Backups (automático diário)  
✅ **Monitor**: Supabase > Logs para ver queries  
✅ **Scale**: PostgreSQL é ilimitado até ~10GB Supabase Free  
⚠️ **Cuidado**: Não commiteie CONNECTION STRING no Git!  
⚠️ **Segurança**: Mude JWT_SECRET regularmente em produção

## Links Úteis

- [Supabase Docs](https://supabase.com/docs)
- [Prisma + Supabase](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Vercel Deployment](https://vercel.com/docs)
