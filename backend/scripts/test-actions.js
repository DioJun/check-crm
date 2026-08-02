// Teste do registro de ações do vendedor (AlertaLog)
const prisma = require('../src/core/lib/prisma');
const actionLog = require('../src/modules/whatsapp/actionlog.service');

async function main() {
  const lead = await prisma.lead.findFirst();
  if (!lead) {
    console.log('⚠️ Nenhum lead no banco — nada a testar');
    return;
  }
  console.log(`Lead: ${lead.nome} (${lead.id})`);

  // 1) Registrar visualização
  await actionLog.logVisualizacao(lead.id, { alertas: 2, ofertas: 1, score: 80 });
  console.log('✅ Visualização registrada');

  // 2) Registrar uso de oferta (via logAction)
  await actionLog.logAction({
    leadId: lead.id,
    tipo: 'oferta',
    acao: 'usou',
    detalhe: { produto: 'CRM Checkmate', status: 'usou' },
  });
  console.log('✅ Ação "usou oferta" registrada');

  // 3) Registrar silêncio de alerta
  await actionLog.logAction({
    leadId: lead.id,
    tipo: 'alerta',
    acao: 'silenciou',
    detalhe: { titulo: 'Sinal de compra detectado', tipo: 'urgencia' },
  });
  console.log('✅ Ação "silenciou alerta" registrada');

  // 4) Listar logs
  const logs = await actionLog.listLogs({ leadId: lead.id });
  console.log(`\nLogs do lead: ${logs.length}`);
  logs.slice(0, 5).forEach((l) => {
    console.log(`  [${new Date(l.createdAt).toLocaleString('pt-BR')}] ${l.acao} (${l.tipo}) — detalhe: ${JSON.stringify(l.detalhe)}`);
  });

  // 5) Estatísticas
  const stats = await actionLog.getStats();
  console.log(`\nEstatísticas: total=${stats.total} porAcao=${JSON.stringify(stats.porAcao)}`);
  console.log(`  Ofertas: sugeridas=${stats.ofertasSugeridas} usadas=${stats.ofertasUsadas} ignoradas=${stats.ofertasIgnoradas}`);
}

main()
  .catch((e) => { console.error('ERRO:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
