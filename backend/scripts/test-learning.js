// Teste da Camada 5 — Aprendizado entre vendedores
const prisma = require('../src/core/lib/prisma');
const learning = require('../src/modules/whatsapp/learning.service');
const feedback = require('../src/modules/whatsapp/feedback.service');

const CHECK = (cond, msg) => console.log(`${cond ? '✅' : '❌'} ${msg}`);

async function main() {
  // Reset
  await prisma.configuracao.deleteMany({ where: { chave: learning.TOP_PATTERN_KEY } }).catch(() => {});
  await feedback.saveParams({ ...feedback.DEFAULT_PARAMS });

  // 2 leads
  const lead1 = await prisma.lead.create({ data: { nome: 'Lead V1', telefone: '+55 11 94444-3333', servico: 'Loja', status: 'interessado' } });
  const lead2 = await prisma.lead.create({ data: { nome: 'Lead V2', telefone: '+55 11 93333-2222', servico: 'Loja', status: 'interessado' } });

  // VENDEDOR A (top): respostas curtas + pergunta, alta conversão
  const textsA = [
    'Oi! Consigo desconto pra fechar hoje. Topa?',
    'Preço especial só essa semana. Quer garantir?',
    'Fechamos com condições boas. Bora fechar?',
  ];
  for (const t of textsA) {
    const log = await prisma.aiSuggestionLog.create({
      data: {
        leadId: lead1.id,
        vendedorId: 'vendedor-a',
        suggestionText: t,
        vendedorText: t,
        actionTaken: 'editou',
        result: 'positivo',
        diff: JSON.stringify({ mudou: false }),
      },
    });
  }

  // VENDEDOR B: respostas longas sem pergunta, baixa conversão
  const textsB = [
    'Gostaríamos de apresentar nossa proposta detalhada de serviços de gestão de tráfego pago incluindo análise completa de concorrência e relatórios mensais extensos de performance para otimização contínua de suas campanhas publicitárias online.',
    'Prezado cliente, informamos que nossa empresa oferece um pacote abrangente de soluções de marketing digital com diversas funcionalidades e relatórios detalhados de desempenho.',
  ];
  for (const t of textsB) {
    await prisma.aiSuggestionLog.create({
      data: {
        leadId: lead2.id,
        vendedorId: 'vendedor-b',
        suggestionText: t,
        vendedorText: t,
        actionTaken: 'editou',
        result: 'negativo',
        diff: JSON.stringify({ mudou: false }),
      },
    });
  }

  console.log('--- 1. Performance por vendedor ---');
  const perf = await learning.getPerformanceByVendedor({ days: 30 });
  perf.forEach((v) => {
    console.log(`  ${v.vendedorId}: total=${v.total} conversao=${v.taxaConversao}% aceite=${v.taxaAceite}% palavras=${v.palavrasChave.slice(0,3)}`);
  });
  CHECK(perf.length === 2, '2 vendedores identificados');
  CHECK(perf[0].vendedorId === 'vendedor-a', 'Top performer = vendedor-a (100% conversão)');
  CHECK(perf[0].taxaConversao === 100, 'Vendedor A converte 100%');
  CHECK(perf[1].taxaConversao === 0, 'Vendedor B converte 0%');

  console.log('\n--- 2. Análise top performer ---');
  const analise = await learning.analyzeTopPerformer({ days: 30 });
  console.log(`  temEquipe: ${analise.temEquipe}`);
  console.log(`  mensagem: ${analise.mensagem}`);
  console.log(`  padraoTop: ${JSON.stringify(analise.padraoTop)}`);
  CHECK(analise.temEquipe === true, 'Detectou equipe (2 vendedores)');
  CHECK(analise.padraoTop.estilo === 'curto', `Top performer usa estilo curto → ${analise.padraoTop.estilo}`);
  CHECK(analise.padraoTop.taxaPerguntaFinal >= 60, `Top performer termina com pergunta (${analise.padraoTop.taxaPerguntaFinal}%)`);

  console.log('\n--- 3. Aplicar padrão do top performer ---');
  const aplicado = await learning.applyTopPerformerPattern({ days: 30 });
  console.log(`  aplicado: ${aplicado.aplicado}`);
  console.log(`  params: ${JSON.stringify(aplicado.parametrosAplicados)}`);
  CHECK(aplicado.aplicado === true, 'Padrão aplicado');
  CHECK(aplicado.parametrosAplicados.respostaCurta === true, 'respostaCurta ativado (padrão do top)');
  CHECK(aplicado.parametrosAplicados.gerarPerguntaFinal === true, 'gerarPerguntaFinal ativado');

  console.log('\n--- 4. Padrão salvo ---');
  const salvo = await learning.getTopPerformerPattern();
  console.log(`  topPerformerId: ${salvo.topPerformerId}`);
  CHECK(salvo.topPerformerId === 'vendedor-a', 'Padrão salvo referencia vendedor-a');
  CHECK(salvo.estilo === 'curto', 'Padrão salvo com estilo curto');

  // Limpeza
  await prisma.lead.delete({ where: { id: lead1.id } }).catch(() => {});
  await prisma.lead.delete({ where: { id: lead2.id } }).catch(() => {});
  await prisma.configuracao.deleteMany({ where: { chave: learning.TOP_PATTERN_KEY } }).catch(() => {});
  console.log('\n🧹 Dados de teste removidos');
}

main().catch((e) => { console.error('ERRO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
