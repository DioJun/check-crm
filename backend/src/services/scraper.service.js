/**
 * Serviço de Scraping de Google Maps
 * Extrai dados de negócios: nome, telefone, endereço, avaliação
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
      const parsedUrl = new URL(url);
      // Verifica se é domínio Google (qualquer extensão) e contém 'maps' e 'place'
      return parsedUrl.hostname.includes('google') && 
             parsedUrl.pathname.includes('maps') &&
             parsedUrl.pathname.includes('place');
    } catch {
      return false;
    }
  }

  /**
   * Extrai dados da URL do Google Maps usando estratégia alternativa
   */
  static async extractDataFromUrl(url) {
    // Estratégia 1: Tentar extrair dados da URL encoded
    const dataFromUrl = this.parseGoogleMapsUrl(url);
    
    // Estratégia 2: Se forem coordenadas, buscar metadados
    if (dataFromUrl.latitude && dataFromUrl.longitude) {
      return await this.getBusinessDataByCoordinates(dataFromUrl);
    }

    // Estratégia 3: Tentar requests HTTP (pode ter limitações)
    return await this.scrapeWithHeadlessBrowser(url);
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
   * Obtém dados de negócio através de coordenadas (método alternativo)
   * Nota: Isso é uma simulação. Em produção, usar API do Google Maps
   */
  static async getBusinessDataByCoordinates(data) {
    console.log('📍 Buscando dados por coordenadas...');
    
    // Aqui entraria integração com Google Maps API
    // Por enquanto, retornamos os dados parseados como base
    return {
      ...data,
      fonte: 'coordinate_parse',
      confianca: 'media'
    };
  }

  /**
   * Scrape com browser headless (Puppeteer)
   * Requer: npm install puppeteer
   */
  static async scrapeWithHeadlessBrowser(url) {
    console.log('🤖 Iniciando scrape com browser headless...');
    
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
          website: 'a[data-tooltip*="Site"], a[href^="http"]:not([href*="maps"])'
        };

        // Tentar encontrar elementos
        for (const [key, selector] of Object.entries(selectors)) {
          const elem = document.querySelector(selector);
          if (elem) {
            data[key] = elem.textContent.trim();
          }
        }

        return data;
      });

      await browser.close();
      return { ...data, fonte: 'puppeteer', confianca: 'alta' };

    } catch (error) {
      console.warn('⚠️ Puppeteer não disponível, usando método alternativo');
      return this.parseGoogleMapsUrl(url);
    }
  }

  /**
   * Validar e normalizar dados extraídos
   */
  static normalizarDados(data) {
    return {
      nome: data.nome?.trim() || null,
      telefone: this.normalizarTelefone(data.telefone),
      endereco: data.endereco?.trim() || null,
      avaliacoes: data.avaliacoes ? parseFloat(data.avaliacoes) : null,
      website: this.normalizarUrl(data.website),
      source: 'google_maps',
      scrapedAt: new Date()
    };
  }

  /**
   * Normaliza número de telefone
   */
  static normalizarTelefone(telefone) {
    if (!telefone) return null;
    
    // Remove caracteres especiais
    let normalizado = telefone.replace(/\D/g, '');
    
    // Se tem 11 dígitos, adicionar +55
    if (normalizado.length === 11) {
      normalizado = '55' + normalizado;
    }
    
    // Se não tem +, adicionar
    if (!normalizado.startsWith('+')) {
      normalizado = '+' + normalizado;
    }
    
    return normalizado;
  }

  /**
   * Normaliza URL
   */
  static normalizarUrl(website) {
    if (!website) return null;
    if (!website.startsWith('http')) {
      website = 'https://' + website;
    }
    try {
      new URL(website);
      return website;
    } catch {
      return null;
    }
  }

  /**
   * Pesquisa Google Maps por termo (ex: "mecânicos em joinville")
   * @param {string} searchTerm - Termo de pesquisa (ex: "mecânicos em joinville")
   * @returns {Promise<Array>} Lista de resultados encontrados
   */
  static async searchGoogleMaps(searchTerm) {
    console.log(`🔎 Buscando: "${searchTerm}"`);
    
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
      // Usar Puppeteer para fazer a busca
      console.log('⏳ Iniciando Puppeteer (pode levar 30-45s)...');
      const results = await this.searchWithPuppeteer(searchTerm);

      // Cachear por 24 horas
      scrapCache.set(cacheKey, results);
      setTimeout(() => scrapCache.delete(cacheKey), 24 * 60 * 60 * 1000);

      return results;
    } catch (puppeteerError) {
      console.error('❌ Puppeteer falhou:', puppeteerError.message);
      
      // Fallback: tentar método leve
      try {
        console.log('🌐 Tentando alternativa sem Puppeteer...');
        const results = await this.searchWithAlternativeMethod(searchTerm);
        
        // Cachear por 24 horas
        scrapCache.set(cacheKey, results);
        setTimeout(() => scrapCache.delete(cacheKey), 24 * 60 * 60 * 1000);

        return results;
      } catch (altError) {
        console.error('❌ Alternativa também falhou:', altError.message);
        throw new Error('Nenhum resultado encontrado. Tente um termo diferente ou verifique sua conexão.');
      }
    }
  }

  /**
   * Método alternativo mais leve (sem Puppeteer)
   */
  static async searchWithAlternativeMethod(searchTerm) {
    console.log('📡 Usando método alternativo...');
    
    try {
      const fetch = require('node-fetch');
      
      // Tentar busca com timeout curto
      const searchUrl = `https://www.google.com.br/maps/search/${encodeURIComponent(searchTerm)}`;
      
      console.log(`Acessando: ${searchUrl}`);
      
      const response = await fetch(searchUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - Servidor não respondeu`);
      }
      
      const html = await response.text();
      
      // Google Maps renderiza com JavaScript, fetch puro não consegue
      console.warn('⚠️ Método leve não conseguiu extrair dados (Google Maps usa JavaScript)');
      throw new Error('Método alternativo insuficiente para Google Maps');
      
    } catch (error) {
      throw new Error(`Método alternativo falhou: ${error.message}`);
    }
  }

  /**
   * Pesquisa com Puppeteer (browser headless)
   * Coleta múltiplos resultados de pesquisa
   */
  static async searchWithPuppeteer(searchTerm) {
    console.log('🤖 Iniciando busca com Puppeteer...');
    
    try {
      const puppeteer = require('puppeteer');

      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      
      // Construir URL de pesquisa do Google Maps
      const searchUrl = `https://www.google.com.br/maps/search/${encodeURIComponent(searchTerm)}`;
      
      console.log(`📍 Acessando: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });

      // Dar tempo para renderizar resultados
      await page.waitForTimeout(4000);

      // Extrair lista de resultados com múltiplas estratégias
      const results = await page.evaluate(() => {
        const items = [];
        
        // Estratégia 1: role="option" (Google Maps padrão)
        let searchResults = document.querySelectorAll('[role="option"]');
        
        // Estratégia 2: Divs com dados específicos
        if (searchResults.length === 0) {
          searchResults = document.querySelectorAll('div[jsaction*="click"]');
        }
        
        // Estratégia 3: Buscar por jspb-v2
        if (searchResults.length === 0) {
          searchResults = document.querySelectorAll('[data-result-index]');
        }

        console.log(`Encontrados ${searchResults.length} resultados`);
        
        searchResults.forEach((result, index) => {
          if (index < 20) { // Limitar a 20 resultados
            try {
              // Extrair nome
              const titleElem = result.querySelector('div[role="img"], .TkSaBd, [data-name], span');
              const nome = titleElem?.textContent?.trim() || '';
              
              // Extrair endereço
              const addressElems = result.querySelectorAll('div span');
              let endereco = '';
              addressElems.forEach(el => {
                const text = el.textContent?.toLowerCase() || '';
                if (text.includes('rua') || text.includes('avenida') || text.includes('joinville') || text.includes(',')) {
                  endereco = el.textContent?.trim() || '';
                }
              });
              
              // Extrair avaliação
              const ratingElem = result.querySelector('[aria-label*="estrela"], [data-rating]');
              const avaliacoes = ratingElem?.textContent?.trim() || '';
              
              // Extrair href se houver link
              const linkElem = result.querySelector('a');
              const url = linkElem?.href || '';
              
              if (nome && nome.length > 2) {
                items.push({
                  nome: nome.substring(0, 80),
                  endereco: endereco.substring(0, 100) || 'Endereço não disponível',
                  avaliacoes: avaliacoes.substring(0, 10) || '',
                  website: null,
                  telefone: null,
                  url_maps: url,
                  latitude: null,
                  longitude: null
                });
              }
            } catch (e) {
              console.error('Erro ao processar resultado:', e.message);
            }
          }
        });
        
        return items;
      });

      await browser.close();

      if (results.length === 0) {
        throw new Error('Nenhum resultado encontrado com Puppeteer');
      }

      console.log(`✅ ${results.length} resultados extraídos com Puppeteer`);
      return results;

    } catch (error) {
      console.error('❌ Erro em searchWithPuppeteer:', error.message);
      throw error;
    }
  }

}

module.exports = ScraperService;
