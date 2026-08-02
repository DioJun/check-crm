// Smoke test: verifica modelos novos do Prisma
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const has = (name) => typeof prisma[name] === 'object' && prisma[name] !== null;
  const modelos = ['alerta', 'produto', 'leadProduto', 'scoreHistorico', 'configuracao'];
  const resultado = {};
  modelos.forEach((m) => { resultado[m] = has(m); });

  // Testa criação/leitura de um alerta de exemplo (e limpa depois)
  const lead = await prisma.lead.findFirst();
  if (lead) {
    const alerta = await prisma.alerta.create({
      data: {
        leadId: lead.id,
        tipo: 'urgencia',
        prioridade: 'alta',
        titulo: 'Teste motor padrões',
        mensagem: 'Alerta de teste do motor de detecção',
        detalhe: '{"palavra":"orcamento"}',
      },
    });
    await prisma.alerta.delete({ where: { id: alerta.id } });
    console.log('✅ Criação/leitura de Alerta OK');
  } else {
    console.log('⚠️ Nenhum lead no banco — pulou teste de escrita');
  }

  console.log('Modelos reconhecidos:', JSON.stringify(resultado));
}

main()
  .catch((e) => { console.error('ERRO:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
