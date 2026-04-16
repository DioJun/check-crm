# CheckCRM - Desktop

CRM Desktop com Google Maps Scraper para geração de leads.

## Funcionalidades

- **Dashboard** - Visão geral: total de leads, por status, taxa de conversão
- **Lista de Leads** - Tabela com filtros por status, cidade, serviço e nome
- **Pipeline (Kanban)** - Colunas Novo / Sem Contato / Contatado / Interessado / Fechado com drag-and-drop
- **Detalhe do Lead** - Histórico de interações e botão WhatsApp
- **Google Maps Scraper** - Busca por termo (ex: "Eletricistas em Curitiba") e importa leads
- **Importação em lote** - Upload de planilha ou importação via scraper
- **Autenticação JWT** - Login com e-mail e senha

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Desktop | Electron |
| Frontend | React 19 + TailwindCSS + Vite |
| Backend | Node.js + Express |
| ORM | Prisma |
| Banco de dados | SQLite (local) |
| Scraper | Puppeteer |
| Auth | JWT + bcryptjs |

## Estrutura do Projeto

```
check-crm/
├── package.json                  # Scripts root (dev, build, electron)
├── electron/
│   ├── main.js                   # Processo principal Electron
│   ├── preload.js                # Bridge seguro (IPC)
│   └── ipc-handlers.js           # Handlers IPC → Backend API
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Schema do banco (SQLite)
│   ├── src/
│   │   ├── controllers/          # Camada HTTP
│   │   ├── services/             # Regras de negócio
│   │   ├── repositories/         # Acesso ao banco via Prisma
│   │   ├── middleware/           # auth.middleware.js (JWT)
│   │   ├── routes/               # Rotas Express + Scraper
│   │   ├── lib/prisma.js         # Instância Prisma com path resolution
│   │   └── app.js
│   ├── scripts/
│   │   └── init-db.js            # Inicialização do banco SQLite
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout/           # Sidebar + Layout
    │   │   ├── Leads/            # LeadModal
    │   │   ├── Scraper/          # GoogleMapsScraper
    │   │   └── ui/               # StatusBadge, WhatsAppButton
    │   ├── context/              # AuthContext
    │   ├── pages/                # Login, Dashboard, Leads, Pipeline, etc.
    │   ├── services/api.js       # Wrapper axios/electronAPI
    │   └── App.jsx
    └── package.json
```

## Como Rodar

### Pré-requisitos

- Node.js >= 18
- npm >= 9

### Instalação

```bash
# Instalar dependências do root
npm install

# Instalar dependências do backend
cd backend
npm install --ignore-scripts
npx prisma generate
node scripts/init-db.js
cd ..

# Instalar dependências do frontend
cd frontend
npm install
cd ..
```

### Desenvolvimento

```bash
# Iniciar backend + frontend juntos
npm run dev

# Em outro terminal, iniciar Electron (opcional)
npm run dev:electron

# Ou iniciar tudo junto
npm run dev:all
```

O app fica disponível em:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Build Desktop

```bash
npm run dist
# Gera instalador em dist/
```

## API Endpoints

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Login (retorna JWT) |

### Leads (requer autenticação)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/leads` | Listar leads |
| GET | `/api/leads/stats` | Estatísticas do dashboard |
| GET | `/api/leads/:id` | Buscar lead por ID |
| POST | `/api/leads` | Criar lead |
| PUT | `/api/leads/:id` | Atualizar lead |
| DELETE | `/api/leads/:id` | Deletar lead |
| POST | `/api/leads/import` | Importar lista de leads |

### Scraper (sem autenticação)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/scraper/search` | Busca por termo no Google Maps |
| POST | `/api/scraper/google-maps` | Scrape de URL do Google Maps |

### Interações (requer autenticação)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/interactions/:leadId` | Listar interações do lead |
| POST | `/api/interactions/:leadId` | Adicionar interação |

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
  status          LeadStatus   @default(novo)  // novo | sem_contato | contatado | interessado | fechado
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
