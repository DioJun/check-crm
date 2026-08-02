// Verifica modelo LeadIntelligence e teste rápido
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('leadIntelligence disponível:', typeof prisma.leadIntelligence === 'object');
  const lead = await prisma.lead.findFirst();
  if (lead) {
    const li = await prisma.leadIntelligence.create({
      data: {
        leadId: lead.id,
        preferredTone: 'informal',
        activeHours: '14-16h',
        avgResponseTimeMin: 8,
        objections: '["preco alto"]',
        interestedProducts: '["crm"]',
        engagementScore: 72,
      },
    });
    console.log('Criação OK:', li.id);
    await prisma.leadIntelligence.delete({ where: { id: li.id } });
    console.log('Limpeza OK');
  }
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
