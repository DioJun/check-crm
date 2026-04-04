/**
 * Serviço de Scraping de Google Maps
 * Extrai dados de negócios: nome, telefone, endereço, avaliação
 * 
 * ⚠️ IMPORTANTE: Puppeteer funciona APENAS localmente
 * Em Vercel/cloud, use URL scraping de lugares específicos (/place/)
 */

const { URLSearchParams } = require('url');

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
   * Scrape com browser headless (Puppeteer) - LOCAL ONLY
   */
  static async scrapeWithHeadlessBrowser(url) {
    console.log('🤖 Tentando extrair com browser headless...');
    
    try {
      const puppeteer = require('puppeteer');
      
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Extrair dados da página
      const data = await page.evaluate(() => {
        const data = {
          nome: null,
          telefone: null,
          endereco: null,
          avaliacoes: null,
          website: null,
          horario: null
        };

        // Selectors para Google Maps
        const selectors = {
          nome: 'h1, [data-item-id*="name"] h2, .section-star-display-title',
          telefone: '[data-tooltip*="Telefone"], a[href^="tel:"]',
          endereco: '[data-tooltip*="Endereço"], .section-copy-content',
          avaliacoes: '.section-star-display, .rating-span',
        };

        // Tentar extrair usando os seletores
        Object.keys(selectors).forEach(key => {
          const element = document.querySelector(selectors[key]);
          if (element) {
            data[key] = element.innerText || element.textContent;
          }
        });

        return data;
      });

      await browser.close();
      
      return data.nome ? [data] : [];

    } catch (error) {
      console.error('❌ Browser headless falhou:', error.message);
      throw error;
    }
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
      const results = await this.searchWithPuppeteer(searchTerm);

      if (!results || results.length === 0) {
        throw new Error('Nenhum resultado encontrado');
      }

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
   * Busca com Puppeteer - APENAS LOCAL
   * Coleta múltiplos resultados de pesquisa
   */
  static async searchWithPuppeteer(searchTerm) {
    console.log(`🌐 Buscando "${searchTerm}" com Puppeteer...`);
    
    try {
      const puppeteer = require('puppeteer');

      console.log('🚀 Lançando browser...');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
        ],
        timeout: 60000
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      
      const searchUrl = `https://www.google.com.br/maps/search/${encodeURIComponent(searchTerm)}`;
      console.log(`📍 Acessando: ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });

      console.log('⏳ Aguardando renderização completa...');
      // Aguardar mais tempo para elementos renderizarem
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Tentar esperar por seletores específicos (com timeout)
      try {
        await page.waitForSelector('[role="option"]', { timeout: 5000 }).catch(() => {
          console.log('⚠️ [role="option"] não encontrado dentro do timeout');
        });
      } catch (e) {
        console.log('⚠️ Seletor [role="option"] não disponível');
      }

      // Extrair resultados
      const results = await page.evaluate(() => {
        const items = [];
        
        // Estratégia 1: Procurar por [role="option"]
        let searchResults = document.querySelectorAll('[role="option"]');
        console.log(`[page] Encontrados ${searchResults.length} com [role="option"]`);
        
        // Estratégia 2: Se não encontrou, procurar por outros seletores
        if (searchResults.length === 0) {
          searchResults = document.querySelectorAll('div[data-item-id]');
          console.log(`[page] Tentativa 2 (data-item-id): ${searchResults.length}`);
        }
        
        // Estratégia 3: Procurar por divs com texto relevante
        if (searchResults.length === 0) {
          const allDivs = document.querySelectorAll('div');
          searchResults = Array.from(allDivs).filter(div => {
            const text = div.innerText || '';
            return text.length > 20 && text.includes('\n');
          }).slice(0, 30);
          console.log(`[page] Tentativa 3 (divs com texto): ${searchResults.length}`);
        }
        
        searchResults.forEach((result, index) => {
          if (index < 20) {
            const text = result.innerText || result.textContent;
            if (text && text.length > 5) {
              const lines = text.split('\n').filter(l => l.trim());
              
              if (lines.length > 0) {
                items.push({
                  nome: lines[0] || 'Sem nome',
                  endereco: lines[1] || lines[2] || 'Endereço não disponível',
                  avaliacoes: lines.find(l => l.includes('⭐') || l.includes('★') || l.includes('(')) || '',
                  fonte: 'google_maps_search'
                });
              }
            }
          }
        });

        return items;
      });

      await browser.close();

      console.log(`✅ Encontrados ${results.length} resultados`);
      return results;

    } catch (error) {
      console.error('❌ Puppeteer error:', error.message);
      throw new Error(`Puppeteer falhou: ${error.message}`);
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
}

module.exports = ScraperService;
