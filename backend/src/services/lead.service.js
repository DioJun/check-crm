const leadRepository = require('../repositories/lead.repository');

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
  return leadRepository.create(data);
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

function normalizeTelefone(telefone) {
  const digits = telefone.replace(/\D/g, '');
  if (!digits.startsWith('55')) {
    return `+55${digits}`;
  }
  return `+${digits}`;
}

async function importLeads(leads) {
  const now = new Date();

  // Normalize and deduplicate within the batch
  const seen = new Set();
  const normalized = [];
  for (const lead of leads) {
    const tel = (lead.telefone && lead.telefone.trim()) ? normalizeTelefone(lead.telefone) : '';
    const key = tel || lead.nome; // Use nome como chave se não tiver telefone
    
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push({ 
        ...lead, 
        telefone: tel,
        status: 'novo', 
        dataEntrada: now 
      });
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
    await Promise.all(toInsert.map((lead) => leadRepository.create(lead)));
  }

  return { imported: toInsert.length, skipped, total: normalized.length };
}

async function deleteMultiple(ids) {
  return leadRepository.deleteMany(ids);
}

module.exports = { getAll, getById, create, update, delete: deleteLead, getDashboardStats, importLeads, deleteMultiple };
