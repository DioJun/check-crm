/**
 * Serviço de Scraping de Google Maps
 * Extrai dados de negócios: nome, telefone, endereço, avaliação
 *
 * Puppeteer-extra + stealth para evasão de detecção
 * Scroll automático, User-Agent rotation, delays humanizados
 */

const { URLSearchParams } = require('url');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// ==================== CONFIGURAÇÃO ====================

// Pool de User-Agents reais (Chrome Windows/Mac/Linux recentes)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/** Delay humanizado: base ± jitter ms */
function humanDelay(baseMs = 1000, jitter = 500) {
  const ms = baseMs + Math.floor(Math.random() * jitter * 2) - jitter;
  return new Promise(r => setTimeout(r, Math.max(200, ms)));
}

// Cache em memória (em produção, usar Redis)
const scrapCache = new Map();

class ScraperService {
  /**
   * Extrai dados de uma URL do Google Maps
   * @param {string} url - URL do Google Maps
   * @returns {Promise<Object>} Dados extraídos
   */
  static async scrapeGoogleMaps(url) {
    // Validar URL
    if (!this.isValidGoogleMapsUrl(url)) {
      throw new Error('URL inválida. Use um link válido do Google Maps');
    }

    // Verificar cache
    const cacheKey = Buffer.from(url).toString('base64');
    if (scrapCache.has(cacheKey)) {
      console.log('📦 Retornando dados do cache');
      return scrapCache.get(cacheKey);
    }

    try {
      const data = await this.extractDataFromUrl(url);
      
      // Cachear por 24 horas
      scrapCache.set(cacheKey, data);
      setTimeout(() => scrapCache.delete(cacheKey), 24 * 60 * 60 * 1000);
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao fazer scrape:', error.message);
      throw error;
    }
  }

  /**
   * Valida se é uma URL válida do Google Maps
   */
  static isValidGoogleMapsUrl(url) {
    try {
      // Se for URL completa, validar
      if (url.startsWith('http')) {
        const parsedUrl = new URL(url);
        // Basta ter google e maps
        return parsedUrl.hostname.includes('google') && parsedUrl.pathname.includes('maps');
      }
      
      // Se parecer texto/parâmetro, aceitar também (pode ser search query)
      // Basta ter alguns caracteres (mínimo 3)
      return url.trim().length >= 3;
    } catch {
      // Se falhar parse de URL, aceitar se tiver texto
      return url.trim().length >= 3;
    }
  }

  /**
   * Extrai dados da URL do Google Maps
   */
  static async extractDataFromUrl(url) {
    console.log('🔗 URL recebida:', url);
    
    // Se for apenas um parâmetro/código, é uma URL compartilhada
    let fullUrl = url;
    if (!url.startsWith('http') && url.length > 0) {
      fullUrl = `https://maps.google.com/?q=${encodeURIComponent(url)}`;
      console.log('🔗 URL reconstruída:', fullUrl);
    }

    // Verificar se é URL de BUSCA (dinâmica) ou LUGAR (estático)
    const isSearchUrl = fullUrl.includes('/search/') || fullUrl.includes('?q=');
    const isPlaceUrl = fullUrl.includes('/place/');

    if (isSearchUrl) {
      console.log('🔍 Detectado: URL de BUSCA (dinâmica)');
      throw new Error(
        'URLs de busca requerem a busca por termo. ' +
        'Use o campo de busca e digite o termo (ex: "Eletricistas em Curitiba") para obter múltiplos resultados.'
      );
    }

    if (isPlaceUrl) {
      console.log('📍 Detectado: URL de LUGAR (estático)');
      // Estrat\u00e9gia 1: Tentar extrair dados diretos da URL
      const dataFromUrl = this.parseGoogleMapsUrl(fullUrl);
      
      if (dataFromUrl.nome || (dataFromUrl.latitude && dataFromUrl.longitude)) {
        try {
          const result = await this.getBusinessDataByCoordinates(dataFromUrl);
          if (result) {
            return [result];
          }
        } catch (err) {
          console.error('Erro ao extrair dados do lugar:', err.message);
        }
      }

      // Tentar com Puppeteer
      try {
        const results = await this.scrapeWithHeadlessBrowser(fullUrl);
        if (results && results.length > 0) {
          return results;
        }
      } catch (puppeteerError) {
        console.error('⚠️ Puppeteer falhou para lugar:', puppeteerError.message);
      }
    }

    // Se chegou aqui, não conseguiu processar
    throw new Error(
      'Tipo de URL não suportado. ' +
      'Use: (1) Busca por termo no CRM, ou (2) URL de um lugar específico do Google Maps (com /place/ na URL).'
    );
  }

  /**
   * Parse da URL do Google Maps para extrair dados básicos
   */
  static parseGoogleMapsUrl(url) {
    console.log('🔍 Analisando URL do Google Maps...');
    
    const data = {
      nome: null,
      telefone: null,
      endereco: null,
      avaliacoes: null,
      latitude: null,
      longitude: null,
      url_original: url
    };

    try {
      // Extrair coordenadas: /@lat,lng,
      const coordMatch = url.match(/@(-?[0-9.]+),(-?[0-9.]+)/);
      if (coordMatch) {
        data.latitude = parseFloat(coordMatch[1]);
        data.longitude = parseFloat(coordMatch[2]);
      }

      // Extrair nome da URL (geralmente no path)
      const nameMatch = url.match(/maps[^/]*\/place\/([^/]+)/i);
      if (nameMatch) {
        data.nome = decodeURIComponent(nameMatch[1]).replace(/\+/g, ' ');
      }

      // Extrair place_id se houver
      const placeIdMatch = url.match(/fbx=([^&]+)/);
      if (placeIdMatch) {
        data.place_id = placeIdMatch[1];
      }

    } catch (error) {
      console.error('Erro ao fazer parse da URL:', error);
    }

    return data;
  }

  /**
   * Obtém dados de negócio através de coordenadas
   */
  static async getBusinessDataByCoordinates(data) {
    console.log('📍 Extraindo dados da URL...');
    
    if (!data.nome && data.latitude && data.longitude) {
      console.log(`Coordenadas: ${data.latitude}, ${data.longitude}`);
    }
    
    if (data.nome || data.endereco) {
      return {
        ...data,
        fonte: 'url_parse',
        confianca: 'media'
      };
    }
    
    return null;
  }

  /**
   * Scrape com browser headless (Puppeteer+Stealth) - LOCAL ONLY
   * Extrai dados de um lugar específico (/place/) do Google Maps
   */
  static async scrapeWithHeadlessBrowser(url) {
    console.log('🤖 Extraindo lugar com Puppeteer Stealth...');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
      ],
    });

    try {
      const page = await browser.newPage();
      const ua = randomUA();
      await page.setUserAgent(ua);
      await page.setViewport({ width: 1366, height: 768 });
      // Definir idioma pt-BR para seletores consistentes
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await humanDelay(2000, 800);

      // Fechar popups de consentimento se aparecerem
      await this._dismissConsent(page);

      // Extrair dados usando seletores estáveis do Google Maps
      const data = await page.evaluate(() => {
        const result = {
          nome: null,
          telefone: null,
          endereco: null,
          avaliacoes: null,
          website: null,
          horario: null,
        };

        // NOME — h1 principal ou aria-label do header
        const h1 = document.querySelector('h1');
        if (h1) result.nome = h1.textContent.trim();

        // TELEFONE — botão com aria-label "Telefone:" ou link tel:
        const phoneBtn = document.querySelector('a[data-item-id^="phone:"], a[href^="tel:"], button[data-item-id^="phone:"]');
        if (phoneBtn) {
          const label = phoneBtn.getAttribute('aria-label') || phoneBtn.textContent || '';
          const m = label.match(/\(?\d{2,3}\)?\s*\d{4,5}[\s.-]?\d{4}/);
          if (m) result.telefone = m[0];
        }

        // ENDEREÇO — botão com data-item-id="address"
        const addrBtn = document.querySelector('button[data-item-id="address"], [data-item-id="address"]');
        if (addrBtn) {
          result.endereco = (addrBtn.getAttribute('aria-label') || addrBtn.textContent || '').replace(/^Endereço:\s*/i, '').trim();
        }

        // AVALIAÇÃO — span com role="img" perto de estrelas
        const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"], span.ceNzKf, div[jsaction*="pane.rating"] span');
        if (ratingEl) result.avaliacoes = ratingEl.textContent.trim();

        // WEBSITE — link com data-item-id="authority"
        const webBtn = document.querySelector('a[data-item-id="authority"], a[data-item-id^="olak"]');
        if (webBtn) result.website = webBtn.href || webBtn.getAttribute('aria-label') || null;

        // HORÁRIO — item com aria-label contendo "horário"
        const hourEl = document.querySelector('[data-item-id="oh"], [aria-label*="horário"], [aria-label*="Horário"]');
        if (hourEl) result.horario = (hourEl.getAttribute('aria-label') || hourEl.textContent || '').trim();

        return result;
      });

      return data.nome ? [data] : [];
    } finally {
      await browser.close();
    }
  }

  /**
   * Fecha popups de consentimento/cookies do Google
   */
  static async _dismissConsent(page) {
    try {
      const consentBtn = await page.$('button[aria-label="Aceitar tudo"], form[action*="consent"] button, button[jsname="b3VHJd"]');
      if (consentBtn) {
        await consentBtn.click();
        await humanDelay(1000, 400);
      }
    } catch { /* sem popup */ }
  }

  /**
   * Qualificar e normalizar dados extraídos
   * Retorna score de qualidade (0-100) e dados normalizados
   */
  static qualifyLead(lead) {
    let score = 0;
    const issues = [];

    // ✓ Nome válido (max 15 pontos)
    if (lead.nome && lead.nome.length > 5) {
      score += 15;
    } else {
      issues.push('Nome muito curto ou vazio');
    }

    // ✓ Endereço válido (max 25 pontos)
    if (lead.endereco && lead.endereco.length > 10 && /\d+/.test(lead.endereco)) {
      score += 25;
    } else if (lead.endereco && lead.endereco.length > 5) {
      score += 10;
      issues.push('Endereço incompleto');
    } else {
      issues.push('Endereço ausente');
    }

    // ✓ Telefone válido (max 30 pontos)
    if (lead.telefone && /\(\d{2,3}\)\s*\d{4,5}-\d{3,4}/.test(lead.telefone)) {
      score += 30;
    } else if (lead.telefone) {
      score += 10;
      issues.push('Telefone inválido ou incompleto');
    } else {
      issues.push('Telefone ausente');
    }

    // ✓ Avaliação/Status (max 15 pontos)
    if (lead.avaliacoes && lead.avaliacoes.length > 3) {
      score += 15;
    }

    // ✓ Dados adicionais (max 15 pontos)
    if (lead.website || lead.horario) {
      score += 5;
    }

    return {
      ...lead,
      quality_score: Math.min(score, 100),
      quality_level: score >= 80 ? 'ALTA' : score >= 50 ? 'MÉDIA' : 'BAIXA',
      issues: issues
    };
  }

  /**
   * Extrair telefone de forma normalizada
   */
  static extractPhone(text) {
    if (!text) return null;
    // Padrão: (XX) XXXXX-XXXX ou variações
    const match = text.match(/\(\d{2,3}\)\s*\d{4,5}-\d{3,4}/);
    return match ? match[0] : null;
  }

  /**
   * Normalizar endereço (remover excesso de espaços, limpeza)
   */
  static normalizeAddress(text) {
    if (!text) return '';
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 150);
  }

  /**
   * Deduplicar leads por múltiplos critérios
   * Telefone é a chave primária de deduplicação
   * Se telefone for igual, mescla os dados
   */
  static deduplicateLeads(leads) {
    console.log(`📊 Deduplicando ${leads.length} leads...`);
    
    const byPhone = new Map(); // Chave primária: telefone
    const byAddress = new Map(); // Índice secundário: endereço

    leads.forEach(lead => {
      const phone = this.extractPhone(lead.telefone);
      const addr = this.normalizeAddress(lead.endereco);

      // Se tem telefone, usar como chave primária
      if (phone) {
        if (byPhone.has(phone)) {
          // MESCLAR: Combinar dados do lead existente com novo
          const existing = byPhone.get(phone);
          console.log(`🔗 Mesclando leads com telefone ${phone}`);

          // Manter nome mais completo
          if (lead.nome.length > existing.nome.length) {
            existing.nome = lead.nome;
          }

          // Manter endereço mais completo
          if (lead.endereco && lead.endereco.length > existing.endereco.length) {
            existing.endereco = lead.endereco;
          }

          // Adicionar campo indicando merge
          if (!existing.merged_from) {
            existing.merged_from = [];
          }
          existing.merged_from.push(lead.nome);
        } else {
          // Novo lead
          byPhone.set(phone, { ...lead, merged_from: [] });
        }
      } else if (addr && addr.length > 10) {
        // Se não tem telefone, tentar agrupar por endereço
        if (!byAddress.has(addr)) {
          byAddress.set(addr, lead);
        }
      }
    });

    // Combinar leads por telefone com os por endereço
    const deduplicated = Array.from(byPhone.values());
    
    // Adicionar leads que só têm endereço (sem duplicatas)
    byAddress.forEach((lead, addr) => {
      const phone = this.extractPhone(lead.telefone);
      if (!phone) {
        deduplicated.push(lead);
      }
    });

    console.log(`✅ Reduzidos para ${deduplicated.length} leads únicos`);
    return deduplicated;
  }

  /**
   * BUSCA POR TERMO - Funciona APENAS LOCALMENTE com Puppeteer
   * 
   * Em Vercel/cloud: Retorna erro claro
   * Localmente: Usa Puppeteer para buscar e coletar múltiplos resultados
   */
  static async searchGoogleMaps(searchTerm) {
    console.log(`🔎 Iniciando busca: "${searchTerm}"`);
    
    if (!searchTerm || searchTerm.trim().length === 0) {
      throw new Error('Termo de pesquisa inválido');
    }

    // Verificar cache
    const cacheKey = `search_${Buffer.from(searchTerm).toString('base64')}`;
    if (scrapCache.has(cacheKey)) {
      console.log('📦 Retornando resultados do cache');
      return scrapCache.get(cacheKey);
    }

    try {
      console.log('🚀 Usando Puppeteer para buscar...');
      let results = await this.searchWithPuppeteer(searchTerm);

      if (!results || results.length === 0) {
        throw new Error('Nenhum resultado encontrado');
      }

      // PROCESSAR 1: Deduplicar leads duplicados
      results = this.deduplicateLeads(results);
      
      // PROCESSAR 2: Qualificar cada lead
      results = results.map(lead => this.qualifyLead(lead));
      
      // PROCESSAR 3: NOVO - Melhorar qualidade (enriquecer dados, validar endereços)
      results = await this.improveLeadQuality(results);
      
      // ORDENAR: Leads de melhor qualidade de endereço primeiro, depois qualidade geral
      results = results.sort((a, b) => {
        // Primeiro por qualidade de endereço
        const addrDiff = (b.address_validation_score || 0) - (a.address_validation_score || 0);
        if (addrDiff !== 0) return addrDiff;
        // Se iguais, por quality_score geral
        return b.quality_score - a.quality_score;
      });

      // Cachear por 24 horas
      scrapCache.set(cacheKey, results);
      setTimeout(() => scrapCache.delete(cacheKey), 24 * 60 * 60 * 1000);

      return results;
      
    } catch (puppeteerError) {
      console.error('❌ Busca falhou:', puppeteerError.message);
      
      throw new Error(
        `Busca falhou: ${puppeteerError.message}.\n\n` +
        'Execute o CRM localmente ou use URL de um lugar específico.'
      );
    }
  }

  /**
   * Busca com Puppeteer Stealth + scroll automático - APENAS LOCAL
   * Coleta múltiplos resultados rolando a lista lateral do Google Maps
   */
  static async searchWithPuppeteer(searchTerm) {
    console.log(`🌐 Buscando "${searchTerm}" com Puppeteer Stealth...`);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1366,768',
      ],
      timeout: 60000,
    });

    try {
      const page = await browser.newPage();
      const ua = randomUA();
      await page.setUserAgent(ua);
      await page.setViewport({ width: 1366, height: 768 });
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });
      console.log(`🕵️ UA: ${ua.substring(0, 60)}...`);

      const searchUrl = `https://www.google.com.br/maps/search/${encodeURIComponent(searchTerm)}`;
      console.log(`📍 Acessando: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await humanDelay(3000, 1000);

      // Fechar popup de consentimento
      await this._dismissConsent(page);
      await humanDelay(1500, 500);

      // ─── SCROLL AUTOMÁTICO DA LISTA LATERAL ───
      // O painel de resultados usa role="feed" ou é um div scrollável na lateral esquerda
      console.log('📜 Iniciando scroll automático da lista de resultados...');

      const scrollResults = await page.evaluate(async () => {
        // Localizar o container scrollável dos resultados
        // Google Maps usa role="feed" ou um div com overflow-y dentro do painel lateral
        const feed = document.querySelector('div[role="feed"]');
        const scrollContainer = feed
          || document.querySelector('div[aria-label*="Resultados"] div[tabindex="-1"]')
          || document.querySelector('.m6QErb.DxyBCb');

        if (!scrollContainer) {
          console.log('[scroll] Container de resultados não encontrado');
          return { scrolled: false, attempts: 0 };
        }

        let previousHeight = 0;
        let stableCount = 0;
        let scrollAttempts = 0;
        const MAX_SCROLLS = 12; // ~60 resultados máx
        const MAX_STABLE = 3; // parar se altura não muda 3x seguidas

        while (scrollAttempts < MAX_SCROLLS && stableCount < MAX_STABLE) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
          scrollAttempts++;

          // Delay humanizado (400-800ms) — executado dentro do page context
          await new Promise(r => setTimeout(r, 400 + Math.floor(Math.random() * 400)));

          const currentHeight = scrollContainer.scrollHeight;
          if (currentHeight === previousHeight) {
            stableCount++;
          } else {
            stableCount = 0;
          }
          previousHeight = currentHeight;
        }

        // Verificar se encontrou o marcador de "fim dos resultados"
        const endMarker = document.querySelector('span.HlvSq, p[jstcache]');
        return {
          scrolled: true,
          attempts: scrollAttempts,
          reachedEnd: !!endMarker,
        };
      });

      console.log(`📜 Scroll: ${scrollResults.attempts} iterações, fim=${scrollResults.reachedEnd}`);
      await humanDelay(2000, 500);

      // ─── EXTRAÇÃO COM SELETORES ESTÁVEIS ───
      console.log('🔍 Extraindo resultados com seletores aria-label/data-*...');

      const results = await page.evaluate(() => {
        const items = [];
        const seenNames = new Set();
        const seenPhones = new Set();

        // Detectar se uma linha é review/avaliação de usuário (NÃO é endereço)
        function isReviewText(line) {
          // Texto entre aspas (reviews do Google Maps)
          if (/^[""\u201C\u201D«»']/.test(line)) return true;
          if (/[""\u201C\u201D«»']$/.test(line)) return true;
          // Palavras comuns em reviews
          if (/\b(nota\s+\d|recomendo|excelente|péssimo|ótimo|horrível|atendimento|profissional|gostei|amei|adorei|indico|voltarei|nunca\s+mais|muito\s+bom|muito\s+ruim|super\s+indico|maravilh|parabéns|melhor\s+|pior\s+)/i.test(line)) return true;
          // Frases longas sem números de rua (provavelmente review)
          if (line.length > 60 && !/\b\d{1,5}\b/.test(line)) return true;
          return false;
        }

        // Detectar se uma linha é endereço
        function isAddressLine(line) {
          if (line.length < 5 || line.length > 150) return false;
          if (isReviewText(line)) return false;
          // Tem prefixo de logradouro
          if (/\b(Rua|Av\.|Avenida|Praça|Travessa|Trav\.|Rod\.|Rodovia|Estrada|Estr\.|Alameda|Al\.|R\.|Pç\.|Largo|Via|BR-|SC-|PR-|SP-|RJ-|MG-)\b/i.test(line)) return true;
          // Tem CEP
          if (/\b\d{5}-?\d{3}\b/.test(line)) return true;
          // Tem padrão "cidade - estado" ou "bairro, cidade"
          if (/\b[A-Z][a-záàãéêíóôõúç]+\s*[-–]\s*[A-Z]{2}\b/.test(line)) return true;
          // Tem número de endereço + vírgula (ex: "1234, Bairro" ou "Rua X, 123")
          if (/\d{1,5}\s*,/.test(line) && !line.includes('·') && !line.includes('(')) return true;
          // Número + hífen ou texto curto com vírgula e número (padrão endereço)
          if (/,\s*\d{1,5}/.test(line) && line.length < 80 && !line.includes('(')) return true;
          return false;
        }

        // Detectar se é info de categoria/serviço (ex: "Loja de eletrônicos · Centro")
        function isCategoryLine(line) {
          if (line.includes('·')) return true;
          if (/^(Loja|Serviço|Restaurante|Hotel|Oficina|Consultório|Clínica|Escritório|Agência|Escola|Academia)\b/i.test(line)) return true;
          return false;
        }

        // SELETOR PRIMÁRIO: cada resultado é um <a> com class "hfpxzc" e aria-label
        const resultLinks = document.querySelectorAll('a.hfpxzc');

        if (resultLinks.length > 0) {
          resultLinks.forEach(link => {
            if (items.length >= 60) return;

            const nome = (link.getAttribute('aria-label') || '').trim();
            if (!nome || nome.length < 3 || seenNames.has(nome)) return;

            // O container pai contém todos os dados
            const card = link.closest('[jsaction*="mouseover"]') || link.parentElement?.parentElement;
            if (!card) { seenNames.add(nome); items.push({ nome, endereco: '', telefone: '', avaliacoes: '', fonte: 'google_maps_search' }); return; }

            const cardText = card.innerText || '';
            const lines = cardText.split('\n').map(l => l.trim()).filter(Boolean);

            let endereco = '';
            let telefone = '';
            let avaliacoes = '';
            let categoria = '';

            for (const line of lines) {
              // Pular o próprio nome do negócio
              if (line === nome) continue;

              // Telefone
              if (!telefone) {
                const pm = line.match(/\(?\d{2,3}\)?\s*\d{4,5}[\s.-]?\d{4}/);
                if (pm) { telefone = pm[0]; continue; }
              }
              // Avaliação (ex: "4,5" seguido de estrelas ou "(123)")
              if (!avaliacoes && /^\d[.,]\d/.test(line)) {
                avaliacoes = line;
                continue;
              }
              // Categoria (ex: "Loja de eletrônicos · Centro")
              if (!categoria && isCategoryLine(line)) {
                // Extrair endereço parcial se a categoria tiver " · Endereço"
                const parts = line.split('·').map(p => p.trim());
                if (parts.length >= 2) {
                  categoria = parts[0];
                  // O segundo fragmento pode ser bairro/zona
                  const rest = parts.slice(1).join(', ').trim();
                  if (rest && !endereco && rest.length > 3 && /[A-Za-záàãéêíóôõúç]/.test(rest)) {
                    endereco = rest;
                  }
                } else {
                  categoria = line;
                }
                continue;
              }
              // Endereço — só aceitar se passar na heurística
              if (!endereco && isAddressLine(line)) {
                endereco = line;
              } else if (endereco && !endereco.includes(',') && isAddressLine(line) && line.length > endereco.length) {
                // Se já tem endereço curto (só bairro), substituir por um mais completo
                endereco = line;
              }
            }

            // Telefone alternativo: procurar link tel: dentro do card
            if (!telefone) {
              const telLink = card.querySelector('a[href^="tel:"]');
              if (telLink) {
                const m = (telLink.href || '').match(/\d[\d\s()-]{8,}/);
                if (m) telefone = m[0].trim();
              }
            }

            if (telefone && seenPhones.has(telefone)) return;
            if (telefone) seenPhones.add(telefone);
            seenNames.add(nome);

            items.push({
              nome: nome.substring(0, 100),
              endereco: endereco.substring(0, 150),
              telefone: telefone.substring(0, 50),
              avaliacoes: avaliacoes.substring(0, 100),
              fonte: 'google_maps_search',
            });
          });
        }

        // FALLBACK: Se o seletor primário falhou, usar análise de divs
        if (items.length === 0) {
          const allDivs = Array.from(document.querySelectorAll('div'));
          allDivs.forEach(div => {
            if (items.length >= 30) return;
            const text = (div.innerText || '').trim();
            if (text.length < 15 || text.length > 600) return;

            const lines = text.split('\n').map(l => l.trim()).filter(l => l && l.length < 200);
            if (lines.length < 2) return;

            const potentialName = lines[0];
            if (potentialName.length < 3 || potentialName.length > 80) return;
            if (seenNames.has(potentialName)) return;

            const uiWords = ['Recolher','Abrir','Compartilhar','Filtro','Menu','Ajuda','©','Mapa','Termos','Privacidade','Verificado'];
            if (uiWords.some(w => potentialName.includes(w))) return;

            let endereco = '', telefone = '', avaliacoes = '', hasData = false;
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i];
              if (isReviewText(line)) continue;
              const pm = line.match(/\(?\d{2,3}\)?\s*\d{4,5}[\s.-]?\d{4}/);
              if (pm && !telefone) { telefone = pm[0]; hasData = true; }
              if (!endereco && isAddressLine(line)) { endereco = line; hasData = true; }
              if (/⭐|★|\d+[.,]\d+\s*\(|\bAberto\b|\bFechado\b/.test(line)) { avaliacoes = line; hasData = true; }
            }
            if (!hasData) return;
            if (telefone && seenPhones.has(telefone)) return;
            if (telefone) seenPhones.add(telefone);
            seenNames.add(potentialName);

            items.push({
              nome: potentialName.substring(0, 100),
              endereco: endereco.substring(0, 150),
              telefone: telefone.substring(0, 50),
              avaliacoes: avaliacoes.substring(0, 100),
              fonte: 'google_maps_search',
            });
          });
        }

        return items;
      });

      console.log(`✅ Encontrados ${results.length} resultados`);
      return results;
    } finally {
      await browser.close();
    }
  }

  /**
   * Faz scrape de múltiplas URLs
   */
  static async scrapeBatch(urls) {
    console.log(`🔄 Fazendo scrape de ${urls.length} URLs...`);
    
    const results = [];
    const errors = [];

    for (const url of urls) {
      try {
        const data = await this.scrapeGoogleMaps(url);
        results.push({ url, data, success: true });
      } catch (error) {
        errors.push({ url, error: error.message });
      }
    }

    return { results, errors };
  }

  /**
   * Normaliza dados para o formato esperado
   */
  static normalizarDados(dados) {
    if (!Array.isArray(dados)) {
      dados = [dados];
    }

    return dados.map(item => ({
      nome: item.nome || 'Sem nome',
      endereco: item.endereco || 'Não informado',
      telefone: item.telefone || null,
      website: item.website || null,
      avaliacoes: item.avaliacoes || 'Sem avaliação',
      horario: item.horario || null,
      latitude: item.latitude || null,
      longitude: item.longitude || null,
      fonte: item.fonte || 'unknown'
    }));
  }

  /**
   * ENRIQUECIMENTO DE DADOS - Integra múltiplas fontes
   * Usa OpenStreetMap/Nominatim (GRATUITO) para complementar endereços
   * 
   * Não custo de API, sem limites práticos para CRM local
   */
  static async enrichLeadData(lead) {
    try {
      // Se tem endereço incompleto, tentar completar com Nominatim
      if (lead.endereco && lead.endereco.length > 0) {
        const enriched = await this.complementarEnderecoNominatim(lead);
        return enriched;
      }
      return lead;
    } catch (error) {
      console.log(`⚠️ Erro ao enriquecer "${lead.nome}":`, error.message);
      return lead; // Retornar lead original em caso de erro
    }
  }

  /**
   * Buscar dados completos via OpenStreetMap (Nominatim)
   * GRATUITO - Não precisa de API key
   * 
   * Exemplo: "Eletricista, Curitiba, Brasil" → Nominatim retorna lat/lon/endereço completo
   */
  static async complementarEnderecoNominatim(lead) {
    try {
      // Montar query para busca
      const query = `${lead.nome}, Curitiba, Brasil`;
      const encoded = encodeURIComponent(query);
      
      // Request para Nominatim (10 requests/segundo é o limite, ok para CRM)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'CheckCRM-App (Scraper tool)'
          }
        }
      );

      if (!response.ok) {
        return lead; // Retornar original se falhar
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        console.log(`📍 ${lead.nome}: Nominatim encontrou`);
        
        return {
          ...lead,
          // Usar endereço do Nominatim se o original for incompleto
          endereco: lead.endereco || result.display_name.split(',').slice(0, 3).join(','),
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          // Campo que indica enriquecimento
          data_enriched: true,
          source_nominatim: true
        };
      }
      
      return lead;
    } catch (error) {
      console.log(`⚠️ Nominatim indisponível para "${lead.nome}"`);
      return lead;
    }
  }

  /**
   * Validar endereço usando padrão brasileiro
   * Retorna score de compltude: 0-100%
   */
  static validateAddress(endereco) {
    if (!endereco) return 0;
    
    let score = 0;
    
    // Tem nome de rua/avenida (20%)
    if (/\b(Rua|Av\.|Avenida|Praça|Travessa|Pça|Trav|Estrada|Rodovia|R\.)\b/i.test(endereco)) {
      score += 20;
    }
    
    // Tem número (30%)
    if (/\d+/.test(endereco)) {
      score += 30;
    }
    
    // Tem bairro (20%)
    if (endereco.includes(',')) {
      score += 20;
    }
    
    // Tem CEP (20%)
    if (/\b\d{5}-?\d{3}\b/.test(endereco)) {
      score += 20;
    }
    
    // Tem complemento como "apto", "sala", etc (10%)
    if (/\b(apto|sala|loja|bloco|apt|ap|sl)\b/i.test(endereco)) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Extrair CEP de um endereço
   */
  static extractCEP(endereco) {
    if (!endereco) return null;
    const match = endereco.match(/\b(\d{5})-?(\d{3})\b/);
    return match ? match[1] + match[2] : null;
  }

  /**
   * Melhorar qualidade dos dados antes de retornar
   * Aplica validação e enriquecimento
   */
  static async improveLeadQuality(leads) {
    console.log(`📊 Melhorando qualidade de ${leads.length} leads...`);
    
    // Para cada lead, tentar enriquecer dados
    const improved = await Promise.all(
      leads.map(async (lead) => {
        // Tentar enriquecer com Nominatim
        let enrichedLead = await this.enrichLeadData(lead);
        
        // Calcular score de endereço
        enrichedLead.address_validation_score = this.validateAddress(enrichedLead.endereco);
        
        // Extrair CEP se houver
        const cep = this.extractCEP(enrichedLead.endereco);
        if (cep) {
          enrichedLead.cep = cep;
        }
        
        return enrichedLead;
      })
    );
    
    // Ordenar por qualidade de endereço
    improved.sort((a, b) => {
      const scoreB = b.address_validation_score || 0;
      const scoreA = a.address_validation_score || 0;
      return scoreB - scoreA;
    });
    
    console.log(`✅ ${improved.length} leads melhorados com validação de endereço`);
    return improved;
  }

}

module.exports = ScraperService;
