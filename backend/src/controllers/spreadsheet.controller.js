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

    // Retornar os dados para o frontend confirmar o mapeamento
    return res.json({
      message: 'Planilha lida com sucesso',
      totalRows: rows.length,
      preview: rows.slice(0, 5), // Primeiras 5 linhas como preview
      columns: Object.keys(rows[0]), // Colunas encontradas
      data: rows // Todos os dados para processar
    });
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
    }).filter((lead) => lead.nome && lead.telefone); // Filtrar leads incompletos

    if (mappedLeads.length === 0) {
      return res.status(400).json({ error: 'Nenhum lead válido foi encontrado após mapeamento' });
    }

    // Usar o serviço de import existente
    const result = await leadService.importLeads(mappedLeads);

    return res.json({
      message: 'Leads importados com sucesso',
      ...result
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { upload: upload.single('file'), parseSpreadsheet, importFromSpreadsheet };
