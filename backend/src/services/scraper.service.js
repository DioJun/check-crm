/**
 * Serviço de Scraping de Google Maps
 * Extrai dados de negócios: nome, telefone, endereço, avaliação
 */

const axios = require('axios');
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
      const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
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
}

module.exports = ScraperService;
