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

      // PROCESSAR: Deduplicar leads duplicados
      results = this.deduplicateLeads(results);
      
      // PROCESSAR: Qualificar cada lead
      results = results.map(lead => this.qualifyLead(lead));
      
      // ORDENAR: Leads de melhor qualidade primeiro
      results = results.sort((a, b) => b.quality_score - a.quality_score);

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

      // Extrair resultados - ESTRATÉGIA ROBUSTA
      const results = await page.evaluate(() => {
        const items = [];
        const seenNames = new Set();
        
        // Buscar TODOS os divs e analisá-los
        const allDivs = Array.from(document.querySelectorAll('div'));
        
        console.log(`[page] Analisando ${allDivs.length} divs...`);
        
        allDivs.forEach(div => {
          if (items.length >= 20) return;
          
          // Obter texto do div e seus filhos
          const text = (div.innerText || div.textContent || '').trim();
          
          // Pular divs vazios ou muito pequenos
          if (text.length < 10 || text.length > 500) return;
          
          // Dividir em linhas
          let lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l && l.length > 0 && l.length < 200);
          
          if (lines.length < 1) return;
          
          // Primeira linha é potencialmente o NOME
          const potentialName = lines[0];
          
          // FILTRAR UI ELEMENTS
          const uiKeywords = [
            'Recolher', 'Abrir', 'Compartilhar', 'Classificação', 
            'Filtro', 'Menu', 'Ajuda', 'Configurações', 'Resultado',
            '© Google', 'Mapa', 'Termos', 'Privacidade', 'Contribua'
          ];
          
          // Pular se tiver palavras-chave de UI
          if (uiKeywords.some(kw => potentialName.includes(kw))) return;
          
          // Nome deve ter tamanho razoável (3-80 chars)
          if (potentialName.length < 3 || potentialName.length > 80) return;
          
          // Pular se já adicionado
          if (seenNames.has(potentialName)) return;
          
          // Procurar por padrões de negócio (endereço, telefone, rating)
          let hasBusinessPattern = false;
          let endereco = '';
          let telefone = '';
          let avaliacoes = '';
          
          for (let i = 1; i < lines.length && i < 5; i++) {
            const line = lines[i];
            
            // Padrão de endereço: tem números (street number)
            if (/\d+/.test(line) && line.length > 5) {
              endereco = line;
              hasBusinessPattern = true;
            }
            
            // Padrão de telefone: (XX) XXXXX-XXXX
            if (/\(\d{2,3}\)\s*\d{4,5}-\d{3,4}/.test(line)) {
              telefone = line;
              hasBusinessPattern = true;
            }
            
            // Padrão de rating: ⭐4,5 (100) ou similar
            if (/⭐|★|\d+,\d+\s*\(/.test(line)) {
              avaliacoes = line;
              hasBusinessPattern = true;
            }
            
            // Padrão de horário: "Aberto" ou "Fechado"
            if (/Aberto|Fechado|Horário/.test(line)) {
              hasBusinessPattern = true;
            }
          }
          
          // Só adicionar se parecer um negócio real
          if (hasBusinessPattern && potentialName.length > 3) {
            seenNames.add(potentialName);
            items.push({
              nome: potentialName.substring(0, 100),
              endereco: endereco.substring(0, 100),
              telefone: telefone.substring(0, 50),
              avaliacoes: avaliacoes.substring(0, 100),
              fonte: 'google_maps_search'
            });
            
            console.log(`[page] ✓ Encontrado: ${potentialName}`);
          }
        });
        
        console.log(`[page] Extraídos ${items.length} resultados`);
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
