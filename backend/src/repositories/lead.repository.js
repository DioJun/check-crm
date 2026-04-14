const prisma = require('../lib/prisma');

async function findAll(filters = {}) {
  const where = {};

  if (filters.status) where.status = filters.status;
  if (filters.cidade) where.cidade = { contains: filters.cidade };
  if (filters.servico) where.servico = { contains: filters.servico };

  return prisma.lead.findMany({ where, orderBy: { dataEntrada: 'desc' } });
}

async function findById(id) {
  return prisma.lead.findUnique({ where: { id } });
}

async function findByTelefone(telefone) {
  return prisma.lead.findUnique({ where: { telefone } });
}

async function create(data) {
  return prisma.lead.create({ data });
}

async function update(id, data) {
  return prisma.lead.update({ where: { id }, data });
}

async function deleteLead(id) {
  return prisma.lead.delete({ where: { id } });
}

async function countByStatus() {
  const results = await prisma.lead.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const counts = { novo: 0, contatado: 0, interessado: 0, fechado: 0 };
  for (const row of results) {
    counts[row.status] = row._count.status;
  }
  return counts;
}

async function countToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.lead.count({
    where: { dataEntrada: { gte: startOfDay } },
  });
}

async function findManyByTelefone(telefones) {
  // Retornar vazio se não houver telefones para buscar
  if (!telefones || telefones.length === 0) {
    return [];
  }
  
  return prisma.lead.findMany({
    where: { telefone: { in: telefones } },
    select: { telefone: true },
  });
}

async function createMany(leads) {
  return prisma.lead.createMany({ data: leads, skipDuplicates: true });
}

async function deleteMany(ids) {
  return prisma.lead.deleteMany({
    where: { id: { in: ids } }
  });
}

module.exports = {
  findAll,
  findById,
  findByTelefone,
  create,
  createMany,
  update,
  delete: deleteLead,
  countByStatus,
  countToday,
  findManyByTelefone,
  deleteMany,
};
