const prisma = require('../lib/prisma');

async function findByLeadId(leadId) {
  return prisma.interacao.findMany({
    where: { leadId },
    orderBy: { data: 'desc' },
  });
}

async function create(data) {
  return prisma.interacao.create({ data });
}

module.exports = {
  findByLeadId,
  create,
};
