# Checkmate CRM - SaaS Licensing Setup Guide

## 📋 Visão Geral da Arquitetura

O Checkmate CRM usa um sistema de **licenciamento remoto com autenticação local de dados**:

```
┌─────────────────────────────────────────────────────────┐
│         USUÁRIO                                         │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │  Electron App  │
         │  (Desktop)     │
         └───────┬────────┘
                 │
          ┌──────┴──────┐
          │             │
    ┌─────▼─────┐   ┌──▼─────────┐
    │  Remoto   │   │ Local DB    │
    │  Auth API │   │ (SQLite)    │
    └───────────┘   └─────────────┘
    (Validação)     (Leads, dados)
```

### Dois Bancos de Dados:
1. **Autenticação/Licença (REMOTO)** - Hospedado em seu servidor SaaS
   - Controla quem pode acessar
   - Define qual plano cada usuário pagou
   - Rastreia expiração de assinatura

2. **Dados CRM (LOCAL)** - SQLite na máquina do cliente
   - Leads, interações, pipeline
   - Nunca sai da máquina do cliente
   - Pode funcionar offline

---

## 🔐 Sistema de Planos

O CRM inclui 3 planos padrão:

### FREE
- **Limite**: 50 leads
- **Features**: 
  - Importar leads
  - Visualizar leads
  - Filtros básicos
  - Contato WhatsApp
- **Preço**: Gratuito

### PRO
- **Limite**: 500 leads
- **Features**: 
  - Tudo do FREE +
  - Google Maps Scraper
  - Exportação em massa
  - Status customizados
  - Histórico de interações
  - Ações em lote
- **Preço**: $29/mês

### ENTERPRISE
- **Limite**: 10.000 leads
- **Features**:
  - Tudo do PRO +
  - Acesso à API
  - Campos customizados
  - Webhooks
  - Suporte prioritário
- **Preço**: $99/mês

---

## 🚀 Como Implementar (Opções)

### Opção 1: Usar Supabase (Recomendado - Rápido)

#### 1.1 Criar Projeto Supabase
```bash
# Acesse https://supabase.com/dashboard
# Crie novo projeto

# Copie a URL e chave pública
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=seu_anon_key
```

#### 1.2 Criar Tabela de Usuários
```sql
-- No editor SQL do Supabase:
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  plan TEXT DEFAULT 'free' ('free', 'pro', 'enterprise'),
  status TEXT DEFAULT 'active' ('active', 'inactive', 'suspended'),
  criado_em TIMESTAMP DEFAULT NOW(),
  vencimento_plano TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- Habilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
```

#### 1.3 Deploy da API de Autenticação

Use este exemplo Node.js com Express (hospedar em Vercel):

```javascript
// api/auth-saas.js (Vercel Serverless)
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  if (req.method === 'POST' && req.url.includes('/login')) {
    const { email, senha } = req.body;
    
    // Buscar usuário no Supabase
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Validar senha
    const senhaValida = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token JWT com plano
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        plan: user.plan,
        features: getPlanFeatures(user.plan)
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: { id: user.id, email, plan: user.plan } });
  }
}

function getPlanFeatures(plan) {
  const features = {
    free: ['import-leads', 'view-leads', 'whatsapp-contact'],
    pro: ['import-leads', 'view-leads', 'google-maps-scraper', 'bulk-export'],
    enterprise: ['import-leads', 'view-leads', 'google-maps-scraper', 'api-access']
  };
  return features[plan] || features.free;
}
```

Deploy:
```bash
npm install -g vercel
vercel deploy
# Adicione as variáveis de ambiente no dashboard de Vercel
```

### Opção 2: Firebase Authentication + Firestore

```javascript
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Cloud Function para login
exports.login = functions.https.onCall(async (data, context) => {
  const { email, password } = data;
  
  // Firebase Auth
  const user = await admin.auth().getUserByEmail(email);
  
  // Firestore com detalhes do plano
  const userDoc = await db.collection('usuarios').doc(user.uid).get();
  const plan = userDoc.data().plan;
  
  // Gerar JWT com plano
  const token = admin.auth().createCustomToken(user.uid, {
    plan: plan,
    email: email
  });
  
  return { token, user: { id: user.uid, email, plan } };
});
```

### Opção 3: Seu Próprio Backend (Máximo Controle)

```bash
# Node.js + PostgreSQL exemplo
npm install express bcryptjs jsonwebtoken pg

# Criar servidor em sua infra (AWS, DigitalOcean, etc)
node server.js

# Endpoints:
POST /api/auth/register    # Criar conta
POST /api/auth/login       # Login
POST /api/auth/upgrade     # Upgrade de plano
GET  /api/auth/user        # Dados do usuário
```

---

## 🔗 Integração com Seu Servidor SaaS

### Passo 1: Adicionar Endpoint de Autenticação

Seu servidor deve ter este endpoint:

```javascript
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "senha": "senha123"
}

// Resposta:
{
  "token": "eyJhbGc...",
  "user": {
    "id": "user123",
    "email": "usuario@exemplo.com",
    "nome": "João Silva",
    "plan": "pro"
  }
}
```

Token deve conter (JWT):
```json
{
  "id": "user123",
  "email": "usuario@exemplo.com",
  "plan": "pro",
  "features": ["import-leads", "google-maps-scraper", ...],
  "maxLeads": 500,
  "exp": 1234567890
}
```

### Passo 2: Configurar no CRM

No arquivo `.env` ou em produção:

```env
# Seu servidor de autenticação
VITE_AUTH_API_URL=https://sua-saas.com/api
VITE_AUTH_ENABLED=true
```

Atualizar `api.js` do frontend:

```javascript
export const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001/api';

export default {
  baseURL: AUTH_API_URL,
  // ... resto da config
};
```

### Passo 3: Validação em Tempo Real

O aplicativo:
1. Faz login em seu servidor SaaS
2. Recebe token JWT com plano
3. Armazena localmente (`localStorage`)
4. A cada 24h, valida o token contra seu servidor
5. Bloqueia/desbloqueia features conforme plano

---

## 💳 Cobrança de Assinatura

Recomendações para processar pagamentos:

### Stripe (Recomendado)
```javascript
// Servidor SaaS
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-subscription', async (req, res) => {
  const { userId, planId } = req.body;

  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: planId }],
  });

  // Atualizar banco de dados com plano
  await db.usuarios.update(userId, { 
    plan: 'pro', 
    vencimento: subscription.current_period_end 
  });

  res.json({ subscription });
});
```

### Outras Opções
- **Paddle** - Mais fácil, bom para SaaS (RECOMENDADO)
- **Lemon Squeezy** - Simples, bom UX
- **PagSeguro/Stripe** - Se Brasil

---

## 🛡️ Segurança

### Checklist de Segurança

- ✅ HTTPS em produção (obrigatório)
- ✅ Validar JWT no servidor (não confiar só no client)
- ✅ Hash de senhas (bcrypt, mín 10 rounds)
- ✅ CORS configurado (apenas origens conhecidas)
- ✅ Rate limiting em endpoints de auth
- ✅ Logs de acesso/falhas de login
- ✅ Recuperação de senha com token temporário

### Rate Limiting (Express)
```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // 5 tentativas
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
});

app.post('/api/auth/login', loginLimiter, authController.login);
```

---

## 📊 Monitoramento e Analytics

Rastreie:
- Quantos usuários por plano
- Taxa de churn (cancelamentos)
- Uso de features por plano
- Tempo médio no app

Ferramentas grátis:
- **Sentry** - Erros em produção
- **LogRocket** - Sessões de usuário
- **Supabase Analytics** - Banco de dados

---

## 🔄 Fluxo Completo de Login

```
1. Cliente abre app
   ↓
2. Tenta acessar offline (SQLite local)
   ├─ Se token válido → Abre
   └─ Se token expirado → Pede login
   ↓
3. Digite email + senha
   ↓
4. App envia para SEU servidor: POST /auth/login
   ↓
5. Seu servidor valida no banco SaaS
   ├─ Senha incorreta → Erro
   ├─ Plano expirou → Aviso
   └─ OK → Retorna JWT com plano
   ↓
6. App valida JWT (checagem local)
   ↓
7. Armazena token + plano localmente
   ↓
8. Carrega interface com features do plano
   ↓
9. Todos os comandos respeitam limite de leads/features
```

---

## 🎯 Próximos Passos

1. **Escolha plataforma**: Supabase / Firebase / Próprio
2. **Deploy da API**: Vercel, Railway, Heroku
3. **Configure pagamento**: Stripe ou Paddle
4. **Teste em produção**: Usar executável .exe
5. **Monitore**: Logs, analytics, suporte

---

## 📱 Exemplo com Supabase (Mais Rápido)

```bash
# 1. Crie tabela em Supabase
CREATE TABLE usuarios (
  id uuid PRIMARY KEY,
  email TEXT UNIQUE,
  senha_hash TEXT,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMP DEFAULT now()
);

# 2. Crie função serverless (deploy em Vercel)
npm create nextjs-app
# Crie páginas em /pages/api/auth/login.js

# 3. Configure variáveis no .env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# 4. Deploy
vercel --env SUPABASE_SERVICE_ROLE_KEY=...

# 5. Configure no CRM
# Adicione no .env do CRM
VITE_AUTH_API_URL=https://seu-servidor-vercel.com/api
```

---

## 📞 Suporte

Dúvidas? Verifique:
- `/backend/src/services/license.service.js` - Lógica de validação
- `/frontend/src/context/AuthContext.jsx` - Integração frontend
- `/backend/src/routes/license.routes.js` - Endpoints públicos

**Você controla tudo.** O CRM valida e respeita o plano, mas você gerencia usuários e pagamentos no seu servidor.
