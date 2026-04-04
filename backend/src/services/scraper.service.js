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

      // Extrair resultados com estratégia específica para Google Maps
      const results = await page.evaluate(() => {
        const items = [];
        
        // Google Maps coloca os nomes dos negócios em estrutura específica
        // Normalmente temos: ícone + nome + endereço + avaliação em um container
        
        // Procurar por divs que têm a estrutura típica de um resultado:
        // - Contêm texto com endereço (rua, número, bairro)
        // - Podem ter avaliação com ⭐
        // - Têm múltiplas linhas de texto
        
        const allDivs = Array.from(document.querySelectorAll('div'));
        
        allDivs.forEach(div => {
          if (items.length >= 20) return;
          
          const text = (div.innerText || div.textContent || '').trim();
          
          // Critérios para identificar um resultado válido
          const hasGoogleMapsStructure = 
            // Tem pelo menos 2 linhas (nome e endereço)
            text.split('\n').length >= 2 &&
            // Tem um comprimento razoável
            text.length > 10 && text.length < 1000 &&
            // NÃO é elemento de Menu/UI
            !text.includes('Recolher') &&
            !text.includes('Abrir à') &&
            !text.includes('Classificação') &&
            !text.includes('Filtro') &&
            !text.includes('Resultado') &&
            !text.includes('© Google') &&
            !text.includes('Mapa') &&
            !text.includes('Compartilhar') &&
            !text.includes('Menu') &&
            !text.includes('Central de ajuda') &&
            !text.includes('Configurações');
          
          if (!hasGoogleMapsStructure) return;
          
          // Dividir em linhas e limpar
          let lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l && l.length > 1);
          
          // Remover linhas de ícones e símbolos
          lines = lines.filter(l => 
            !l.match(/^[⭐★🗺️📍🔍✉️📞🌐]+$/) &&
            !l.includes('hr') &&
            !l.match(/^\d+$/)
          );
          
          if (lines.length < 2) return;
          
          // Primeira linha é geralmente o nome
          const nome = lines[0];
          
          // Descartar se for tão curto que provavelmente é ícone ou label
          if (nome.length < 3) return;
          
          // Buscar por linha que parece ser endereço
          // Endereços geralmente tem rua + número ou número + bairro
          let endereco = '';
          let avaliacoes = '';
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            // Se tem números e texto, é provavelmente endereço
            if (/\d/.test(line) && line.length > 5) {
              endereco = line;
              break;
            }
          }
          
          // Procurar por avaliação
          avaliacoes = lines.find(l => 
            l.includes('⭐') || 
            l.includes('★') ||
            /\d+,\d+\s*\(\d+\)/.test(l)
          ) || '';
          
          // Validação final: tem nome? Parece um negócio real?
          if (nome && nome.length > 3 && 
              !nome.includes('Abrir') && 
              !nome.includes('Fechar') &&
              !nome.toLowerCase().includes('menu')) {
            
            items.push({
              nome: nome.substring(0, 100),
              endereco: endereco || 'Endereço não informado',
              avaliacoes: avaliacoes.substring(0, 100),
              fonte: 'google_maps_search'
            });
          }
        });
        
        console.log(`[page] Extraídos ${items.length} resultados válidos`);
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
