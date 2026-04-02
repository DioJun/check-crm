# 📍 Módulo de Google Maps Scraper

## Visão Geral

Sistema de scraping inteligente para extrair dados de negócios do Google Maps automaticamente, enriquecendo sua base de leads com informações precisas.

## 📁 Estrutura de Arquivos

```
backend/src/
├── services/scraper.service.js       # Lógica principal de scraping
├── controllers/scraper.controller.js  # Endpoints HTTP
└── routes/scraper.routes.js          # Definição de rotas

frontend/src/
└── components/Scraper/
    └── GoogleMapsScraper.jsx         # Modal do scraper
```

## 🔌 Endpoints da API

### 1. POST `/api/scraper/google-maps`
Faz scrape de uma URL individual do Google Maps.

**Request:**
```json
{
  "url": "https://maps.google.com/maps/place/Padaria+do+Joao/@-26.123,-.456,15z"
}
```

**Response Sucesso:**
```json
{
  "success": true,
  "data": {
    "nome": "Padaria do João",
    "telefone": "+5547999226015",
    "endereco": "Rua das Flores, 123",
    "avaliacoes": 4.5,
    "website": "https://padariajao.com.br",
    "source": "google_maps",
    "scrapedAt": "2024-04-02T10:30:00Z",
    "confianca": "alta"
  },
  "message": "Dados extraídos com sucesso!"
}
```

**Response Erro:**
```json
{
  "success": false,
  "error": "URL inválida. Use um link válido do Google Maps",
  "tip": "Certifique-se de usar uma URL válida do Google Maps"
}
```

### 2. POST `/api/scraper/validate-url`
Apenas valida se é uma URL do Google Maps (mais rápido).

**Request:**
```json
{
  "url": "https://maps.google.com/..."
}
```

**Response:**
```json
{
  "valid": true,
  "url": "https://maps.google.com/...",
  "message": "URL válida do Google Maps"
}
```

### 3. POST `/api/scraper/batch`
Faz scrape de múltiplas URLs em paralelo (máx 10 por requisição).

**Request:**
```json
{
  "urls": [
    "https://maps.google.com/maps/place/...",
    "https://maps.google.com/maps/place/..."
  ]
}
```

**Response:**
```json
{
  "success": true,
  "total": 2,
  "sucessos": 2,
  "falhas": 0,
  "results": [
    {
      "url": "https://maps.google.com/...",
      "success": true,
      "data": { /* dados normalizados */ }
    },
    {
      "url": "https://maps.google.com/...",
      "success": false,
      "error": "Erro ao fazer scrape"
    }
  ]
}
```

## 🧩 Integração com ImportLeads

Para adicionar o scraper à página de importação:

```jsx
// frontend/src/pages/ImportLeads.jsx

import GoogleMapsScraper from '../components/Scraper/GoogleMapsScraper';

export default function ImportLeads() {
  const [showScraper, setShowScraper] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);

  function handleScrapedData(data) {
    setScrapedData(data);
    // Preencher formulário com dados
    setLeads(prev => [...prev, {
      nome: data.nome,
      telefone: data.telefone,
      cidade: data.endereco?.split(',')[0] || '',
      servico: '',
      site: data.website || ''
    }]);
    setShowScraper(false);
  }

  return (
    <div>
      {/* Botão para abrir scraper */}
      <button
        onClick={() => setShowScraper(true)}
        className="btn btn-primary"
      >
        + Scraper Google Maps
      </button>

      {/* Modal do scraper */}
      {showScraper && (
        <GoogleMapsScraper
          onDataScraped={handleScrapedData}
          onClose={() => setShowScraper(false)}
        />
      )}
    </div>
  );
}
```

## 🔧 Métodos do ScraperService

### `scrapeGoogleMaps(url)`
Método principal que orquestra o scraping.

**Cache:** Mantém cache em memória por 24 horas (configurável)

### `isValidGoogleMapsUrl(url)`
Valida se URL é do Google Maps.

**Retorna:** `boolean`

### `parseGoogleMapsUrl(url)`
Extrai dados diretamente da URL (coordenadas, name).

**Retorna:** `Object` com campos básicos

### `scrapeWithHeadlessBrowser(url)`
Usa Puppeteer para scrape completo (requer instalação).

**Requer:** `npm install puppeteer`

### `normalizarDados(data)`
Padroniza dados extraídos.

**Normaliza:**
- Telefone → formato +55XXXXX
- Website → URL válida com https
- Avaliações → número float

### `normalizarTelefone(telefone)`
Converte telefones para formato padrão.

**Exemplos:**
- `(47) 99922-6015` → `+5547999226015`
- `11 99999-9999` → `+5511999999999`

### `normalizarUrl(website)`
Valida e formata URLs.

**Exemplos:**
- `exemplo.com` → `https://exemplo.com`
- `www.site.com.br` → `https://www.site.com.br`

## 🛠️ Instalação Opcional (Puppeteer)

Para scraping mais robusto com browser headless:

```bash
cd backend
npm install puppeteer
```

**Nota:** Puppeteer é pesado (~150MB). Para Vercel, configure na gerência de tamanho:

```json
// backend/vercel.json
{
  "functions": {
    "api/*.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

## 📊 Estratégias de Scraping

### 1️⃣ Parse de URL (Padrão)
- ✅ Rápido (< 100ms)
- ✅ Sem deps extras
- ⚠️  Dados limitados
- Extrai: nome, coordenadas, place_id

### 2️⃣ Puppeteer (Opcional)
- ✅ Dados completos
- ✅ JavaScript renderizado
- ⚠️ Lento (10-30s)
- ⚠️  Alto consumo de memória
- Extrai: tudo (nome, tel, endereço, site, horários)

### 3️⃣ API do Google Maps (Futuro)
- ✅ Mais rápido e confiável
- ⚠️ Requer chave API (paga)
- Melhor para produção em larga escala

## 💡 Casos de Uso

### Caso 1: Adicionar um lead manualmente
1. Usuário clica em "Scraper Google Maps"
2. Cola URL da localização
3. Sistema extrai dados
4. Usuário revisa/edita
5. Dados são adicionados à lista

### Caso 2: Importação em lote
```javascript
// Script para importar múltiplas URLs
const urls = [
  'https://maps.google.com/maps/place/Padaria+do+Joao/...',
  'https://maps.google.com/maps/place/Restaurante+Maria/...',
  // ... mais URLs
];

const response = await api.post('/api/scraper/batch', { urls });
console.log(`✅ ${response.data.sucessos}/${response.data.total} importados`);
```

## ⚙️ Configuração

**Cache:**
```javascript
// Em scraper.service.js
// Alterar duração do cache:
setTimeout(() => scrapCache.delete(cacheKey), 
  48 * 60 * 60 * 1000  // 48 horas
);
```

**Rate Limiting (Futuro):**
```javascript
const rateLimit = require('express-rate-limit');

const scraperLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minuto
  max: 10,                  // máx 10 requisições
  message: 'Muitos scrapes. Aguarde 1 minuto.'
});

router.post('/google-maps', scraperLimiter, 
  ScraperController.scrapeGoogleMaps);
```

## 🔐 Segurança

✅ **Autenticação:** Todos endpoints requerem JWT
✅ **Rate limiting:** Implementável (veja config acima)
✅ **Validação:** URLs validadas antes de scrape
✅ **Cache:** Evita múltiplas requisições

## 📈 Performance

| Operação | Tempo | Notas |
|----------|-------|-------|
| Parse URL | <100ms | Instantâneo |
| Puppeteer | 10-30s | Depende da página |
| Cache hit | <10ms | Muito rápido |
| Batch (10) | 1-5s | Paralelo |

## 🐛 Troubleshooting

**Problema:** "URL inválida"
- ✅ Solução: Use URL completa de maps.google.com

**Problema:** Puppeteer timeout
- ✅ Solução: Aumentar timeout em scrapeWithHeadlessBrowser

**Problema:** Dados incompletos
- ✅ Solução: Google Maps pode ter informações limitadas

## 🚀 Próximas Fases

**Fase 2:**
- [ ] Google Maps API (chave paga)
- [ ] Rate limiting automático
- [ ] Redis cache (produção)
- [ ] Fila de jobs (Bull)

**Fase 3:**
- [ ] Instagram scraper
- [ ] LinkedIn scraper
- [ ] Scraper de sites genéricos

## 📞 Suporte

Para erros ou dúvidas:
1. Verifique console.log (backend)
2. Valide URL do Google Maps
3. Confirme autenticação JWT ativa

---

**Status:** ✅ Alpha (Pronto para uso)
**Última atualização:** 2024-04-02
