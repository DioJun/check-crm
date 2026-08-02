// Teste de persistência do Lead Score no banco real
const prisma = require('../src/core/lib/prisma');
const scoreService = require('../src/modules/whatsapp/score.service');

async function main() {
  const lead = await prisma.lead.findFirst();
  if (!lead) {
    console.log('⚠️ Nenhum lead no banco — nada a testar');
    return;
  }

  console.log(`Lead encontrado: ${lead.nome} (id: ${lead.id})`);
  console.log(`Score atual antes: ${lead.leadScore ?? 'null'}`);

  const calculado = scoreService.calculateScore({
    lead,
    messages: [
      { from: 'vendedor', text: 'Olá!', time: '10:00' },
      { from: 'lead', text: 'Quanto custa um site? Preciso com urgência', time: '10:03' },
    ],
    interacoesCount: 3,
  });

  console.log(`Calculado: ${calculado.score}/100 (${calculado.label})`);
  const salvo = await scoreService.saveScore(lead.id, calculado);
  console.log(`Salvo: score=${salvo.score} (anterior=${salvo.anterior})`);

  const historico = await scoreService.getScoreHistory(lead.id);
  console.log(`Histórico registrado: ${historico.length} entrada(s)`);
  if (historico.length) {
    const ultima = historico[0];
    console.log(`  Última: score=${ultima.score} em ${ultima.createdAt.toLocaleString('pt-BR')}`);
  }
}

main()
  .catch((e) => { console.error('ERRO:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
