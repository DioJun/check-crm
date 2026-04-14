const leadRepository = require('../repositories/lead.repository');
const { normalizarTelefone } = require('./phone.service');

async function getAll(filters) {
  return leadRepository.findAll(filters);
}

async function getById(id) {
  const lead = await leadRepository.findById(id);
  if (!lead) {
    const err = new Error('Lead não encontrado');
    err.status = 404;
    throw err;
  }
  return lead;
}

async function create(data) {
  // Mapear campos do scraper para schema Prisma
  const mappedData = mapScraperDataToSchema(data);
  return leadRepository.create(mappedData);
}

/**
 * Mapear campos do scraper para o schema do Prisma
 * Converte avaliacoes → avaliacao, remove fields extras, etc
 */
function mapScraperDataToSchema(lead) {
  const tel = (lead.telefone && lead.telefone.trim()) ? normalizarTelefone(lead.telefone) : '';
  
  return {
    nome: lead.nome?.trim() || 'Sem nome',
    telefone: tel || null,
    cidade: lead.cidade?.trim() || null,
    servico: lead.servico?.trim() || null,
    origem: lead.origem || 'Google Maps Scraper',
    // IMPORTANTE: Mapear 'avaliacoes' → 'avaliacao' (singular)
    avaliacao: lead.avaliacoes?.trim() || lead.avaliacao?.trim() || null,
    temWhatsapp: lead.temWhatsapp || false,
    temSite: lead.temSite || false,
    site: lead.site?.trim() || null,
    // Se tem endereço enriquecido, guardar em reviews
    reviews: lead.endereco?.trim() || null,
  };
}

async function update(id, data) {
  await getById(id);
  return leadRepository.update(id, { ...data, ultimaInteracao: new Date() });
}

async function deleteLead(id) {
  await getById(id);
  return leadRepository.delete(id);
}

async function getDashboardStats() {
  const [total, byStatus, today] = await Promise.all([
    leadRepository.findAll({}).then((leads) => leads.length),
    leadRepository.countByStatus(),
    leadRepository.countToday(),
  ]);

  const fechados = byStatus.fechado || 0;
  const conversionRate = total > 0 ? ((fechados / total) * 100).toFixed(2) : '0.00';

  return { total, byStatus, today, conversionRate: parseFloat(conversionRate) };
}

async function importLeads(leads) {
  const now = new Date();

  // Normalize and map fields from scraper to database schema
  const seen = new Set();
  const normalized = [];
  
  for (const lead of leads) {
    const tel = (lead.telefone && lead.telefone.trim()) ? normalizarTelefone(lead.telefone) : '';
    const key = tel || lead.nome;
    
    if (!seen.has(key)) {
      seen.add(key);
      
      // Usar função de mapeamento reutilizável
      const mappedLead = mapScraperDataToSchema(lead);
      mappedLead.dataEntrada = now;
      mappedLead.status = 'novo';
      
      normalized.push(mappedLead);
    }
  }

  // Find which telefones already exist (apenas se tiverem telefone)
  const telefonesComValor = normalized
    .filter(l => l.telefone && l.telefone.trim())
    .map(l => l.telefone);
  
  let existingSet = new Set();
  if (telefonesComValor.length > 0) {
    const existing = await leadRepository.findManyByTelefone(telefonesComValor);
    existingSet = new Set(existing.map((l) => l.telefone));
  }

  const toInsert = normalized.filter((l) => {
    // Se tiver telefone, verificar se já existe
    if (l.telefone && l.telefone.trim()) {
      return !existingSet.has(l.telefone);
    }
    // Se não tiver telefone (Google Maps), sempre inserir
    return true;
  });
  
  const skipped = normalized.length - toInsert.length;

  if (toInsert.length > 0) {
    await leadRepository.createMany(toInsert);
  }

  return { imported: toInsert.length, skipped, total: normalized.length };
}

async function deleteMultiple(ids) {
  return leadRepository.deleteMany(ids);
}

module.exports = { getAll, getStats: getDashboardStats, getDashboardStats, getById, create, update, delete: deleteLead, importLeads, deleteMultiple };
