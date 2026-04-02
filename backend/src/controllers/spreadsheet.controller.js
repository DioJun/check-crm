const multer = require('multer');
const XLSX = require('xlsx');
const leadService = require('../services/lead.service');

// Configurar multer para aceitar apenas xlsx e csv
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];
    
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel (.xlsx, .xls) e CSV (.csv) são permitidos'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

/**
 * Detecta se é uma planilha do Google Maps
 */
function isGoogleMapsPlanilha(columns) {
  return columns.some(col => 
    col.toLowerCase().includes('href') || 
    col.toLowerCase().includes('src') ||
    col.toLowerCase().includes('maps')
  );
}

/**
 * Extrai dados de uma planilha do Google Maps
 */
function parseGoogleMapsPlanilha(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const leads = [];

  rows.forEach((row) => {
    const values = Object.values(row)
      .map(v => String(v).trim())
      .filter(v => v.length > 0);

    if (values.length >= 2) {
      // Google Maps format: [URL, Nome, Rating, Reviews, Serviço, ...]
      const nome = values[1]; // 2ª coluna é sempre o nome
      const servico = values.length >= 5 ? values[4] : 'Serviço'; // 5ª coluna é o serviço
      const avaliacao = values.length >= 3 ? values[2] : '';
      const reviews = values.length >= 4 ? values[3] : '';

      // Filtrar linhas vazias ou headers
      if (nome && nome.length > 2) {
        leads.push({
          nome: nome.trim(),
          servico: servico.trim(),
          avaliacao: avaliacao.replace(',', '.'),
          reviews,
          telefone: '',
          cidade: '',
          origem: 'Google Maps'
        });
      }
    }
  });

  // Remover duplicatas baseado no nome
  const unique = [];
  const seen = new Set();
  leads.forEach(lead => {
    const key = lead.nome.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(lead);
    }
  });

  return unique;
}

async function parseSpreadsheet(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    // Ler o arquivo com xlsx
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      return res.status(400).json({ error: 'A planilha está vazia' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Nenhuma linha de dados foi encontrada' });
    }

    const columns = Object.keys(rows[0]);

    // Detectar tipo de planilha
    const isGoogleMaps = isGoogleMapsPlanilha(columns);

    if (isGoogleMaps) {
      const leads = parseGoogleMapsPlanilha(req.file.buffer);
      return res.json({
        message: 'Planilha do Google Maps detectada automaticamente',
        isGoogleMaps: true,
        totalRows: leads.length,
        preview: leads.slice(0, 5),
        data: leads,
        detectType: 'google-maps'
      });
    } else {
      // Retornar os dados para o frontend confirmar o mapeamento
      return res.json({
        message: 'Planilha normal lida com sucesso',
        isGoogleMaps: false,
        totalRows: rows.length,
        preview: rows.slice(0, 5),
        columns: columns,
        data: rows,
        detectType: 'normal'
      });
    }
  } catch (err) {
    return res.status(400).json({ error: `Erro ao processar arquivo: ${err.message}` });
  }
}

async function importFromSpreadsheet(req, res) {
  try {
    const { data, mapping } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    if (!mapping || typeof mapping !== 'object') {
      return res.status(400).json({ error: 'Mapeamento de colunas é obrigatório' });
    }

    // Mapear os dados conforme especificado no frontend
    const mappedLeads = data.map((row) => {
      const lead = {};
      
      if (mapping.nome && row[mapping.nome]) lead.nome = String(row[mapping.nome]).trim();
      if (mapping.telefone && row[mapping.telefone]) {
        let phone = String(row[mapping.telefone]).replace(/\D/g, '');
        if (!phone.startsWith('55')) {
          phone = '55' + phone;
        }
        if (!phone.startsWith('+')) {
          phone = '+' + phone;
        }
        lead.telefone = phone;
      }
      if (mapping.cidade && row[mapping.cidade]) lead.cidade = String(row[mapping.cidade]).trim();
      if (mapping.servico && row[mapping.servico]) lead.servico = String(row[mapping.servico]).trim();
      if (mapping.origem && row[mapping.origem]) lead.origem = String(row[mapping.origem]).trim();
      
      lead.status = 'novo';
      
      return lead;
    }).filter((lead) => lead.nome && lead.telefone);

    if (mappedLeads.length === 0) {
      return res.status(400).json({ error: 'Nenhum lead válido foi encontrado após mapeamento' });
    }

    const result = await leadService.importLeads(mappedLeads);

    return res.json({
      message: 'Leads importados com sucesso',
      ...result
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function importGoogleMapsLeads(req, res) {
  try {
    const { data, cities, hasWhatsapp, hasSite } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Mapear cidades aos leads
    const leadsWithData = data
      .map((lead, idx) => {
        const cidade = cities?.[idx] || '';
        const temWhatsapp = hasWhatsapp?.[idx] || false;
        const temSite = hasSite?.[idx] || false;
        
        // Se não tem nome, não é um lead válido
        if (lead.nome) {
          const telefone = (lead.telefone && lead.telefone.trim()) 
            ? lead.telefone 
            : '';

          return {
            nome: lead.nome,
            telefone: telefone,
            cidade: cidade.trim(),
            servico: lead.servico || 'Serviço',
            status: 'novo',
            origem: 'Google Maps',
            avaliacao: lead.avaliacao,
            reviews: lead.reviews,
            temWhatsapp: temWhatsapp || (telefone ? true : false), // Se tiver telefone, assume que tem WhatsApp
            temSite: temSite,
            site: lead.site || ''
          };
        }
        return null;
      })
      .filter(Boolean);

    if (leadsWithData.length === 0) {
      return res.status(400).json({ error: 'Nenhum lead válido encontrado' });
    }

    const result = await leadService.importLeads(leadsWithData);

    return res.json({
      message: `${result.created || 0} leads importados com sucesso`,
      ...result
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function checkDuplicates(req, res) {
  try {
    const { leads } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Normalizar telefones
    const leadsDuplicateInfo = leads.map((lead, idx) => {
      let telefone = '';
      if (lead.telefone && lead.telefone.trim()) {
        telefone = lead.telefone.replace(/\D/g, '');
        if (!telefone.startsWith('55')) {
          telefone = '55' + telefone;
        }
        if (!telefone.startsWith('+')) {
          telefone = '+' + telefone;
        }
      }
      
      return {
        idx,
        nome: lead.nome,
        telefone,
      };
    });

    // Buscar leads existentes por telefone
    const telefonesComValor = leadsDuplicateInfo
      .filter(l => l.telefone)
      .map(l => l.telefone);
    
    let existingLeads = [];
    if (telefonesComValor.length > 0) {
      const prisma = require('../lib/prisma');
      existingLeads = await prisma.lead.findMany({
        where: { telefone: { in: telefonesComValor } },
        select: { id: true, nome: true, telefone: true }
      });
    }

    // Criar mapa de telefones existentes
    const existingMap = new Map();
    existingLeads.forEach(lead => {
      if (lead.telefone) {
        existingMap.set(lead.telefone, lead);
      }
    });

    // Marcar duplicatas
    const duplicates = leadsDuplicateInfo
      .filter(l => l.telefone && existingMap.has(l.telefone))
      .map(l => ({
        idx: l.idx,
        nome: l.nome,
        telefone: l.telefone,
        existingLead: existingMap.get(l.telefone)
      }));

    return res.json({
      totalLeads: leads.length,
      duplicateCount: duplicates.length,
      duplicates: duplicates
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { 
  upload: upload.single('file'), 
  parseSpreadsheet, 
  importFromSpreadsheet,
  importGoogleMapsLeads,
  checkDuplicates
};
