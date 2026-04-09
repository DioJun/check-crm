# 🚀 Checkmate CRM - Quick Deploy Guide

## Antes de Começar ✅

- [ ] Conta Supabase (gratuito em supabase.com)
- [ ] Conta Vercel (gratuito em vercel.com)
- [ ] Git instalado e repo synchronized
- [ ] Node.js + npm

---

## 5️⃣ Passos Simples

### 1. Setup Supabase (3 min)
```bash
# supabase.com
1. Sign up com GitHub
2. New Project
   - Name: "checkmate-crm"
   - Password: SALVE!
   - Region: próxima
3. Aguarde criar (2-5 min)
4. Settings > Database > Connection String (pgbouncer)
5. Copie a URL
```

**Salve:**
- DATABASE_URL (postgresql://...)
- Senha do DB

### 2. Deploy Backend (2 min)
```bash
cd backend
npm i -g vercel
vercel --prod

# Quando pedir "Link this project": N (novo projeto)
# Vercel vai criar projeto automaticamente
```

**Quando pedir Environment Variables, adicione:**
```
DATABASE_URL = (copie do Supabase)
JWT_SECRET = gere uma string longa/aleatória min 32 chars
NODE_ENV = production
```

**Anote:** Backend URL (`https://seu-nome-xxxxxx.vercel.app`)

### 3. Rodar Migrations (1 min)
```bash
# Na sua máquina local:
export DATABASE_URL="postgresql://..."
cd backend
npx prisma migrate deploy

# Se tudo ok: "Prisma schema updated"
```

### 4. Deploy Frontend (2 min)
```bash
cd frontend
vercel --prod

# Quando pedir Environment Variables:
VITE_API_URL = (seu backend URL + /api)
# Exemplo: https://seu-nome-xxxxxx.vercel.app/api
```

**Anote:** Frontend URL (`https://seu-nome-frontend.vercel.app`)

### 5. Update Backend CORS (1 min)
```bash
# Vercel Dashboard > Backend Project > Settings > Environment Variables
# Mude CORS_ORIGIN para o Frontend URL real
# Redeploy automático
```

---

## ✅ Pronto!

- **Frontend**: https://seu-nome-frontend.vercel.app
- **Backend**: https://seu-nome-backend.vercel.app
- **Database**: Supabase (PostgreSQL)

Teste:
1. Abra frontend
2. Register com email
3. Login
4. Tá funcionando! 🎉

---

## 🔗 Documentos Principais

- **SUPABASE_SETUP.md** - Setup Supabase detalhado
- **DEPLOY_WEB.md** - Deploy Vercel completo
- **backend/.env.example** - Template de variáveis

---

## ❓ Dúvidas?

| Problema | Solução |
|----------|---------|
| CORS error | Cheque CORS_ORIGIN no backend, redeploy |
| 401 Unauthorized | Logout/login, ou JWT_SECRET diferente |
| DB connection failed | Aguarde Supabase criar (pode levar 5 min) |
| Migrations falharam | Execute `npx prisma migrate deploy` local |

---

## 📌 Checklist Final

- [ ] Supabase PROJECT criado ✓
- [ ] DATABASE_URL copiada ✓
- [ ] Backend deployado na Vercel ✓
- [ ] Migrations rodaram ✓
- [ ] Frontend deployado ✓
- [ ] CORS_ORIGIN atualizado ✓
- [ ] Teste registro funcionando ✓

Pronto! Sua app está no ar! 🚀
