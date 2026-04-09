# 🎯 Guia Rápido - Colocar Checkmate CRM no Ar

## Objetivo
Aplicação web rodando em: supabase.com + vercel.com (ambos GRATUITOS)

---

## 📋 Pré-Requisitos
- Conta GitHub com este repo
- Email para Supabase
- Email para Vercel

---

## ⏱️ Leva 15 minutos total

### PASSO 1️⃣ - Supabase (5 min)

1. Vá para **supabase.com**
2. Clique "Sign Up"
3. Use sua conta GitHub
4. Clique "New Project"
   - Nome: `checkmate-crm`
   - Password: **Salve em lugar seguro** 🔐
   - Region: Escolha a mais próxima
5. Aguarde criar (pode levar 2-5 minutos)
6. Quando terminar:
   - Vá em **Settings** > **Database** > **Connection Pooling**
   - Selecione `pgbouncer` mode
   - Clique em **Connection string**
   - Copie a string (começa com `postgresql://`)

**Salve essa string em um bloco de notas!**

---

### PASSO 2️⃣ - Deploy Backend (3 min)

#### 2.1 Instalar Vercel CLI
```bash
npm install -g vercel
```

#### 2.2 Deploy
```bash
cd backend
vercel --prod
```

#### 2.3 Perguntas do Vercel:
- "Link to existing project?" → **N** (novo)
- "What's your project's name?" → `checkmate-crm-api`
- "Which directory?" → `.` (atual)

#### 2.4 Adicionar Variáveis de Ambiente

Quando aparecer "Environment Variables", adicione:

| Chave | Valor |
|-------|-------|
| `DATABASE_URL` | Cole aquela string do Supabase |
| `JWT_SECRET` | Gere algo como: `aSuperLongRandomString123456789!x` |
| `NODE_ENV` | `production` |

**Copie o URL final que aparecer. Vai ser algo como:**
```
https://checkmate-crm-api-xxxxx.vercel.app
```

---

### PASSO 3️⃣ - Rodar Migrations (2 min)

No seu computador, abra terminal:

```bash
# Vá para pasta backend
cd backend

# Rode as migrações
npx prisma migrate deploy
```

Se tudo correu bem, vai aparecer:
```
✓ Your database is now in sync with your schema.
```

---

### PASSO 4️⃣ - Deploy Frontend (3 min)

```bash
cd frontend
vercel --prod
```

#### Perguntas:
- "Link to existing project?" → **N**
- "Project name?" → `checkmate-crm`
- "Directory?" → `.`

#### Variável de Ambiente:
| Chave | Valor |
|-------|-------|
| `VITE_API_URL` | `https://seu-backend-url.vercel.app/api` |

**Exemplo:**
```
https://checkmate-crm-api-xxxxx.vercel.app/api
```

**Copie o URL do frontend que aparecer!**

---

### PASSO 5️⃣ - Atualizar CORS (2 min)

Agora que tem o URL do frontend, volte pro backend:

1. Vá para **vercel.com/dashboard**
2. Selecione projeto `checkmate-crm-api`
3. Clique em **Settings**
4. Vá em **Environment Variables**
5. Edite `CORS_ORIGIN`
6. Coloque o URL do frontend
7. Clique em **Redeploy** (canto superior direito)

**Exemplo:**
```
https://checkmate-crm-xxxxx.vercel.app
```

---

## ✅ PRONTO!

Sua aplicação está no ar! 🎉

### Testar:
1. Abra: https://seu-frontend-url.vercel.app
2. Clique em **Register**
3. Digite email e senha
4. Se passar, está funcionando! ✨

### URLs Finais:
```
Frontend:  https://checkmate-crm-xxxxx.vercel.app
Backend:   https://checkmate-crm-api-xxxxx.vercel.app
```

---

## 🐛 Se Algo Quebrar

| Erro | O Que Fazer |
|------|------------|
| "Cannot GET /" | Backend não recebe requisições - check CORS_ORIGIN |
| "401 Unauthorized" | Logout e login novamente, ou JWT_SECRET errado |
| "Connection refused" | Supabase ainda está criando, aguarde 5 min |
| "Migrations failed" | Execute `npx prisma migrate deploy` localmente |
| Página em branco | Abra console (F12) e veja se tem erro |

---

## 💾 Backup Importante

Salve em lugar seguro:
- ✅ DATABASE_URL (string do Supabase)
- ✅ JWT_SECRET (aquela string aleatória)
- ✅ Frontend URL (para CORS)
- ✅ Backend URL (para API calls)

---

## 📚 Documentos de Referência

Se precisar de mais detalhes:
- **DEPLOY_WEB.md** - Guia super detalhado
- **SUPABASE_SETUP.md** - Setup Supabase completo
- **QUICK_DEPLOY.md** - Resumido em inglês

---

## 🎊 Parabéns!

Sua aplicação CRM está rodando em produção! Agora pode usar, compartilhar e escalar! 🚀

---

**Precisa de ajuda?**
- Supabase Docs: supabase.com/docs
- Vercel Docs: vercel.com/docs
- GitHub Issues: Este repositório
