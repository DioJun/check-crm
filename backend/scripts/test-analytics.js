// Teste da Camada 4 — Analytics e Insights
const prisma = require('../src/core/lib/prisma');
const analytics = require('../src/modules/whatsapp/analytics.service');
const feedback = require('../src/modules/whatsapp/feedback.service');

const CHECK = (cond, msg) => console.log(`${cond ? '✅' : '❌'} ${msg}`);

async function main() {
  // Reset params para estado limpo
  await prisma.configuracao.deleteMany({ where: { chave: analytics.INSIGHTS_KEY } }).catch(() => {});

  // Lead de teste
  const lead = await prisma.lead.create({
    data: { nome: 'Lead Analytics', telefone: '+55 11 95555-4444', servico: 'Clínica Odonto', status: 'fechado' },
  });

  // Criar dados de feedback simulados
  const sugestoes = [
    // 3 positivas com respostas CURTAS + pergunta
    { text: 'Oi! Consigo um desconto especial pra vc fechar hoje. Topa?', result: 'positivo', action: 'editou', time: 2 },
    { text: 'Fechamos com desconto e condições especiais. Bora?', result: 'positivo', action: 'editou', time: 4 },
    { text: 'Te garanto preço promocional até sexta. Quer aproveitar?', result: 'positivo', action: 'copiou', time: 3 },
    // 1 negativa com resposta LONGA sem pergunta
    { text: 'Gostaríamos de apresentar uma proposta detalhada de nossos serviços de gestão de tráfego pago, incluindo análise de concorrência e relatórios mensais completos de performance para otimização contínua de suas campanhas.', result: 'negativo', action: 'editou', time: 120 },
  ];

  for (const s of sugestoes) {
    const log = await feedback.registerSuggestion({ leadId: lead.id, suggestionText: s.text });
    await feedback.registerAction({
      id: log.id,
      actionTaken: s.action,
      vendedorText: s.action === 'editou' ? s.text : undefined,
    });
    await feedback.updateResult({ id: log.id, result: s.result, responseTimeMin: s.time });
  }

  // 1. Feedback metrics
  const metrics = await analytics.getFeedbackMetrics({ days: 30 });
  console.log('\n📊 Feedback metrics:');
  console.log(`  total=${metrics.total} aceitas=${metrics.aceitas} editadas=${metrics.editadas}`);
  console.log(`  positivas=${metrics.positivas} negativas=${metrics.negativas} taxaPositiva=${metrics.taxaRespostaPositiva}%`);
  CHECK(metrics.total === 4, '4 sugestões registradas');
  CHECK(metrics.taxaRespostaPositiva === 75, 'Taxa positiva 75% (3 de 4)');

  // 2. Análise de palavras
  const words = await analytics.getWordAnalysis({ days: 30 });
  console.log('\n🔤 Palavras que geram resposta positiva:', words.palavrasPositivas.slice(0, 5));
  CHECK(words.palavrasPositivas.length > 0, 'Palavras positivas extraídas');

  // 3. Conversão por abordagem
  const approach = await analytics.getApproachConversion({ days: 30 });
  console.log('\n📈 Conversão por abordagem:');
  console.log(`  curta: ${approach.curta.taxaConversao}% (${approach.curta.pos}pos/${approach.curta.neg}neg)`);
  console.log(`  longa: ${approach.longa.taxaConversao}% (${approach.longa.pos}pos/${approach.longa.neg}neg)`);
  console.log(`  comPergunta: ${approach.comPergunta.taxaConversao}%`);
  console.log(`  semPergunta: ${approach.semPergunta.taxaConversao}%`);
  CHECK(approach.curta.taxaConversao === 100, 'Curta converte 100%');
  CHECK(approach.longa.taxaConversao === 0, 'Longa converte 0%');
  CHECK(approach.comPergunta.taxaConversao === 100, 'Com pergunta converte 100%');

  // 4. Insights gerados e salvos
  const insights = await analytics.generateInsights({ days: 30 });
  console.log('\n💡 Insights gerados:');
  insights.insights.forEach((i) => console.log(`  - ${i}`));
  CHECK(insights.insights.some((i) => i.includes('CURTAS')), 'Insight de resposta curta gerado');
  CHECK(insights.insights.some((i) => i.includes('PERGUNTA')), 'Insight de pergunta final gerado');

  // 5. Seção de insights para o prompt
  const section = await analytics.buildInsightsSection();
  console.log('\n📝 Seção de insights (injetada no prompt):');
  console.log(section);
  CHECK(section.includes('INSIGHTS GLOBAIS'), 'Seção de insights gerada');

  // 6. Dashboard completo
  const dash = await analytics.getDashboard({ days: 30 });
  console.log('\n📋 Dashboard:');
  console.log(`  feedback: aceite=${dash.feedback.taxaAceite}% uso=${dash.feedback.taxaUso}%`);
  console.log(`  melhorHorario segmentos: ${JSON.stringify(dash.bestHours)}`);
  console.log(`  tempoMédioFechamento: ${JSON.stringify(dash.timeToClose)}`);
  CHECK(!!dash.feedback, 'Dashboard tem feedback metrics');
  CHECK(!!dash.approach, 'Dashboard tem conversão por abordagem');

  // Limpeza
  await prisma.lead.delete({ where: { id: lead.id } }).catch(() => {});
  await prisma.configuracao.deleteMany({ where: { chave: analytics.INSIGHTS_KEY } }).catch(() => {});
  console.log('\n🧹 Dados de teste removidos');
}

main().catch((e) => { console.error('ERRO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
