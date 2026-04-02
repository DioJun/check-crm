# TemplatesHub CRM

Sistema completo de CRM focado em geração de leads e contato via WhatsApp para o negócio **TemplatesHub**.

## 📋 Funcionalidades

- **Dashboard** – Visão geral de leads: total, hoje, taxa de conversão, novos e breakdown por status
- **Lista de Leads** – Tabela com filtros por status, cidade, serviço e nome; ações de editar, ver detalhes e abrir WhatsApp
- **Pipeline (Kanban)** – Colunas Novo / Contatado / Interessado / Fechado com drag-and-drop
- **Detalhe do Lead** – Histórico de interações (mensagem, ligação, anotação) e botão WhatsApp
- **Importação em lote** – `POST /api/leads/import` remove duplicados por telefone e padroniza DDI +55
- **Autenticação JWT** – Login com e-mail e senha, rotas protegidas

## 🧱 Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TailwindCSS 3 + Vite |
| Backend | Node.js + Express |
| ORM | Prisma |
| Banco de dados | PostgreSQL |
| Auth | JWT + bcryptjs |
| Drag & Drop | @dnd-kit |

## 🗂️ Estrutura do Projeto

```
check-crm/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Schema do banco (Lead, Interacao, Usuario)
│   ├── src/
│   │   ├── controllers/          # Camada HTTP (auth, lead, interaction)
│   │   ├── services/             # Regras de negócio
│   │   ├── repositories/         # Acesso ao banco via Prisma
│   │   ├── middleware/           # auth.middleware.js (JWT)
│   │   ├── routes/               # Rotas Express
│   │   └── app.js
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout/           # Sidebar + Layout
    │   │   ├── Leads/            # LeadModal
    │   │   └── ui/               # StatusBadge, WhatsAppButton
    │   ├── context/              # AuthContext (useAuth hook)
    │   ├── pages/                # Login, Dashboard, Leads, Pipeline, LeadDetail
    │   ├── services/             # api.js (Axios + interceptors)
    │   └── App.jsx
    └── package.json
```

## 🚀 Como Rodar Localmente

### Pré-requisitos

- Node.js >= 18
- PostgreSQL rodando localmente (ou Supabase)
- npm >= 9

### 1. Backend

```bash
cd backend

# Copie e configure as variáveis de ambiente
cp .env.example .env
# Edite .env com sua DATABASE_URL e JWT_SECRET

# Instale dependências
npm install

# Gere o Prisma Client e aplique o schema
npm run db:generate
npm run db:push      # ou npm run db:migrate (para migrations com histórico)

# Inicie o servidor (desenvolvimento)
npm run dev
# Servidor disponível em http://localhost:3001
```

### 2. Frontend

```bash
cd frontend

# Instale dependências
npm install

# Inicie em modo desenvolvimento
npm run dev
# App disponível em http://localhost:5173

# Build para produção
npm run build
```

### Variáveis de Ambiente

**backend/.env**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/templateshub_crm"
JWT_SECRET="sua-chave-secreta-aqui"
PORT=3001
```

**frontend/.env** (opcional – padrão já configurado)
```env
VITE_API_URL=http://localhost:3001/api
```

## 📡 API

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Login (retorna JWT) |

> Todas as rotas abaixo exigem `Authorization: Bearer <token>`

### Leads
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/leads` | Listar leads (query: status, cidade, servico) |
| GET | `/api/leads/stats` | Estatísticas do dashboard |
| GET | `/api/leads/:id` | Buscar lead por ID |
| POST | `/api/leads` | Criar lead |
| PUT | `/api/leads/:id` | Atualizar lead |
| DELETE | `/api/leads/:id` | Deletar lead |
| POST | `/api/leads/import` | Importar lista de leads |

#### Exemplo de Importação
```json
POST /api/leads/import
{
  "leads": [
    { "nome": "Maria Silva", "telefone": "11987654321", "cidade": "São Paulo", "servico": "Site" },
    { "nome": "João Costa", "telefone": "21912345678", "cidade": "Rio de Janeiro", "servico": "Automação" }
  ]
}
```
Resposta: `{ "imported": 2, "skipped": 0, "total": 2 }`

### Interações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/interactions/:leadId` | Listar interações do lead |
| POST | `/api/interactions/:leadId` | Adicionar interação |

#### Tipos de interação: `mensagem`, `ligacao`, `anotacao`

## 📲 Integração WhatsApp

O botão WhatsApp abre diretamente:
```
https://wa.me/55{telefone}?text=Oi%20{nome},%20tudo%20bem
```

A estrutura do backend está preparada para futura integração com **Z-API** ou **Evolution API** no serviço de leads.

## 🔄 Integração com Automações

O endpoint `POST /api/leads/import` é compatível com:
- **n8n** – Use o nó HTTP Request
- **Make (Integromat)** – Use o módulo HTTP
- **Planilha Google** – Via Apps Script ou Zapier

## 🗄️ Schema do Banco de Dados

```prisma
model Lead {
  id              String       @id @default(uuid())
  nome            String
  telefone        String       @unique
  cidade          String?
  servico         String?
  status          LeadStatus   @default(novo)  // novo | contatado | interessado | fechado
  origem          String?
  dataEntrada     DateTime     @default(now())
  ultimaInteracao DateTime?
  interacoes      Interacao[]
}

model Interacao {
  id       String        @id @default(uuid())
  leadId   String
  tipo     InteracaoTipo                       // mensagem | ligacao | anotacao
  conteudo String
  data     DateTime      @default(now())
}

model Usuario {
  id        String   @id @default(uuid())
  nome      String
  email     String   @unique
  senha     String
  createdAt DateTime @default(now())
}
```
