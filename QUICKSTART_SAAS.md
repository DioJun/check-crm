# Checkmate CRM v2.0.0 - SaaS Ready 🚀

## ✅ O Que Foi Implementado

### 1. **Sistema de Licenciamento Completo**
- ✅ 3 Planos (FREE, PRO, ENTERPRISE)
- ✅ Validação de tokens JWT
- ✅ Controle de features por plano
- ✅ Limite de leads por plano

### 2. **Correções de Bugs**
- ✅ **Endereço no scraper** - Agora diferencia endereços de avaliações de usuários
- ✅ **Tela branca em produção** - Resolvido com paths corretos para asar/extraResources
- ✅ **Backend em exe** - Incluído completo com node_modules em extraResources

### 3. **Executável Pronto**
```
📦 Checkmate CRM 2.0.0.exe (150.6 MB)
   ├─ Frontend Build (React)
   ├─ Backend (Node.js Express)
   ├─ SQLite Database
   └─ Google Maps Scraper (Puppeteer)
```

---

## 🎯 Próximos Passos Para SaaS

### Passo 1: Escolha Plataforma de Auth
**Recomendado: Supabase** (mais rápido)

```bash
# Acesse https://supabase.com/dashboard
# Crie um novo projeto
# Copie URL e API Key
```

### Passo 2: Deploy da API de Autenticação
Use Vercel (gratuito) para hospedar:

```javascript
// pages/api/auth/login.js (Next.js em Vercel)
export default async function handler(req, res) {
  const { email, senha } = req.body;
  
  // Seu banco de dados (Supabase/Postgres)
  const user = await db.usuarios.findOne({ email });
  
  // Validar senha
  const valid = await bcrypt.compare(senha, user.senha_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid' });
  
  // Retornar JWT com plano
  const token = jwt.sign({
    id: user.id,
    email: user.email,
    plan: user.plan, // 'free', 'pro', 'enterprise'
    features: getPlanFeatures(user.plan)
  }, process.env.JWT_SECRET, { expiresIn: '30d' });
  
  res.json({ token, user });
}
```

Deploy: `vercel deploy`

### Passo 3: Conectar ao CRM

Altere `.env` do CRM:
```env
VITE_AUTH_API_URL=https://sua-vercel-app.com/api
```

ou configure no código da plataforma SaaS.

### Passo 4: Cobrança
Use **Paddle** ou **Stripe** para processar pagamentos.

---

## 📊 Arquitetura SaaS

```
┌─────────────────────┐
│  Seu Servidor SaaS  │
│  (Supabase/Vercel)  │
│                     │
│  • Usuários         │
│  • Senhas           │
│  • Planos/Assinat.  │
│  • Pagamentos       │
└──────────┬──────────┘
           │ POST /auth/login
           │ → JWT token com plano
           ▼
┌─────────────────────┐
│  Checkpoint CRM     │
│  (Desktop App)      │
│                     │
│  • Valida token     │
│  • Usa plano local  │
│  • SQLite privado   │
└─────────────────────┘
```

---

## 🔐 Sistema de Planos

### FREE
```json
{
  "maxLeads": 50,
  "features": [
    "import-leads",
    "view-leads",
    "basic-filters",
    "whatsapp-contact"
  ]
}
```

### PRO
```json
{
  "maxLeads": 500,
  "features": [
    "import-leads", "view-leads", "advanced-filters",
    "whatsapp-contact", "google-maps-scraper",
    "bulk-export", "custom-status", "interaction-history"
  ]
}
```

### ENTERPRISE
```json
{
  "maxLeads": 10000,
  "features": ["...tudo", "api-access", "webhooks"]
}
```

---

## 💻 Como Usar o Executável

### Local (Desenvolvimento)
```bash
npm run dev:all
# Abre frontend em http://localhost:5173
# Backend em http://localhost:3001
```

### Em Produção
Duplo-clique em:
```
dist/Checkmate CRM 2.0.0.exe
```

**Primeira vez:**
1. Clique em "Registrar-se" ou "Login"
2. Use suas credenciais (vão para seu servidor SaaS)
3. Recebe token JWT com seu plano
4. Acesso liberado conforme plano

---

## 🛠️ Endpoints da API

### Públicos (sem auth)
```
GET  /api/license/plans          # Listar planos
POST /api/license/validate       # Validar token
```

### Com Autenticação
```
GET  /api/license/current        # Licença do usuário
GET  /api/license/usage          # Uso de recursos
```

### Exemplo
```bash
# Listar planos
curl https://seu-crm.com/api/license/plans

# Validar token
curl -X POST https://seu-crm.com/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{"token":"eyJhbGc..."}'

# Licença atual
curl https://seu-crm.com/api/license/current \
  -H "Authorization: Bearer eyJhbGc..."
```

---

## 📋 Sistema de Features

Código no CRM:
```javascript
import { useAuth } from '@/context/AuthContext';

function GoogleMapsButton() {
  const { canUseFeature } = useAuth();
  
  if (!canUseFeature('google-maps-scraper')) {
    return <UpgradeToPro />;
  }
  
  return <GoogleMapsSearchButton />;
}
```

---

## 🔧 Customização

### Adicionar Novo Plano

**1. Backend** (`license.service.js`)
```javascript
const PLAN_FEATURES = {
  // ... existing plans
  starter: {
    maxLeads: 100,
    features: ['import-leads', 'view-leads'],
    monthlyPrice: 9
  }
};
```

**2. Banco de dados**
Certifique-se que sua tabela `usuarios.plan` aceita 'starter':
```sql
ALTER TABLE usuarios ADD CONSTRAINT check_plan 
  CHECK (plan IN ('free', 'pro', 'enterprise', 'starter'));
```

### Adicionar Nova Feature
```javascript
// 1. Adicionar em PLAN_FEATURES
pro: {
  features: ['... existing', 'new-feature']
}

// 2. Frontend - usar canUseFeature
if (canUseFeature('new-feature')) { }

// 3. Backend - middleware
app.post('/api/new', requireFeature('new-feature'), handler);
```

---

## 📈 Monitoramento

Monte dashboard para acompanhar:
- Quantos usuários por plano
- Taxa de conversão (free → pro)
- Churn rate (cancelamentos)
- Uso de features por plano
- Revenue mensal

Ferramentas:
- **Supabase Analytics** - Dashboard nativo
- **Metabase** - Free, open-source
- **Segment** - Eventos customizados
- **Amplitude** - Product analytics

---

## 🚨 Segurança - Checklist

- ✅ HTTPS em produção (obrigatório)
- ✅ Validar JWT no servidor (nunca confiar client)
- ✅ Hash de senhas (bcryptjs, 10+ rounds)
- ✅ Rate limiting em login
- ✅ CORS configurado
- ✅ Token expiration (30 dias)
- ✅ Refresh token strategy (opcional)

---

## 📞 Suporte & Referências

### Documentação
- [SAAS_SETUP.md](./SAAS_SETUP.md) - Guia completo
- [license.service.js](./backend/src/services/license.service.js) - Código
- [license.routes.js](./backend/src/routes/license.routes.js) - Endpoints

### Exemplo Completo Supabase + Vercel
```bash
# 1. Clone template
git clone https://github.com/vercel/examples
cd nextjs/auth-supabase

# 2. Configure .env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# 3. Deploy
npm run deploy
```

### Onde Hospedar
- **Backend/Auth**: Vercel, Railway, Heroku
- **Banco de Dados**: Supabase, Firebase, Postgres
- **Pagamentos**: Stripe, Paddle, Lemon Squeezy
- **Analíticos**: Supabase/Mixpanel

---

## 🎉 Você Está Pronto!

Executável: `dist/Checkmate CRM 2.0.0.exe`

Próximas ações:
1. Setup servidor SaaS (Supabase/Vercel)
2. Integrar pagamentos (Stripe/Paddle)
3. Deploy em produção
4. Marketing & venda 💰

**Boa sorte! 🚀**
