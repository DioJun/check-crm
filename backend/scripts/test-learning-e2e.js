/**
 * TESTE INTEGRADO DE PONTA A PONTA (Passo 9) — Aprendizado Contínuo da IA
 *
 * Valida a orquestração das 5 camadas juntas:
 *   Camada 1 (perfil) → Camada 2 (feedback) → Camada 3 (RAG) → Camada 4 (analytics) → Camada 5 (vendedores)
 * + Configurações (Passo 8).
 *
 * Usa dados simulados e limpa tudo ao final.
 */

const prisma = require('../src/core/lib/prisma');
const intelligenceService = require('../src/modules/whatsapp/lead-intelligence.service');
const feedbackService = require('../src/modules/whatsapp/feedback.service');
const knowledgeService = require('../src/modules/whatsapp/knowledge.service');
const analyticsService = require('../src/modules/whatsapp/analytics.service');
const learningService = require('../src/modules/whatsapp/learning.service');
const learningSettingsService = require('../src/modules/whatsapp/learning-settings.service');

const CHECK = (cond, msg) => {
  const ok = !!cond;
  console.log(`${ok ? '✅' : '❌'} ${msg}`);
  return ok;
};

const idsParaLimpar = [];

async function main() {
  const resultados = [];

  // ============ 0. RESET ESTADO ============
  await prisma.configuracao.deleteMany({
    where: { chave: { in: ['ai:params', 'ai:insights', 'ai:top-pattern', 'ai:learning-settings'] } },
  }).catch(() => {});
  await learningSettingsService.updateSettings({}); // defaults

  console.log('══════════════════════════════════════════');
  console.log('🧠 TESTE E2E — APRENDIZADO CONTÍNUO DA IA');
  console.log('══════════════════════════════════════════\n');

  // ============ 1. PASS 8 — CONFIGURAÇÕES ============
  console.log('📌 [Passo 8] Configurações das camadas');
  const settings = await learningSettingsService.getSettings();
  resultados.push(CHECK(settings.memoriaLead === true, 'memoriaLead ativa (default)'));
  resultados.push(CHECK(settings.feedbackLoop === true, 'feedbackLoop ativo (default)'));
  resultados.push(CHECK(settings.rag === true, 'rag ativa (default)'));
  resultados.push(CHECK(settings.analytics === true, 'analytics ativa (default)'));
  resultados.push(CHECK(settings.entreVendedores === true, 'entreVendedores ativo (default)'));
  // Desativa temporariamente e reativa
  const off = await learningSettingsService.updateSettings({ rag: false });
  CHECK(off.rag === false, 'toggle desativa RAG');
  const on = await learningSettingsService.updateSettings({ rag: true });
  CHECK(on.rag === true, 'toggle reativa RAG');
  console.log('');

  // ============ 2. CAMADA 3 — BASE DE CONHECIMENTO ============
  console.log('📚 [Camada 3] Base de Conhecimento (RAG)');
  const docPreco = await knowledgeService.addDocument({
    nome: 'Política de Preços',
    categoria: 'preco',
    conteudo: 'Site profissional custa R$ 1.490. Desconto de 10% fechando na primeira conversa. Parcelamento em até 6x.',
  });
  idsParaLimpar.push(docPreco.id);
  const docFaq = await knowledgeService.addDocument({
    nome: 'FAQ',
    categoria: 'faq',
    conteudo: 'Prazo de entrega de site: 10 a 15 dias úteis. Domínio incluso. Painel de edição intuitivo.',
  });
  idsParaLimpar.push(docFaq.id);

  const rag = await knowledgeService.searchRagForPrompt('quanto custa um site com desconto', { topK: 2 });
  const ragTemPreco = rag.ragSection.includes('1.490') || rag.ragSection.includes('Desconto');
  resultados.push(CHECK(rag.chunks.length > 0, `RAG retornou ${rag.chunks.length} trechos`));
  resultados.push(CHECK(ragTemPreco, 'RAG encontrou preço/desconto na base'));
  console.log('');

  // ============ 3. CAMADA 1 — PERFIL DO LEAD ============
  console.log('🧑‍💼 [Camada 1] Memória individual por lead');
  const lead = await prisma.lead.create({
    data: { nome: 'E2E Barbearia', telefone: '+55 11 92222-1111', servico: 'Barbearia', status: 'interessado' },
  });
  idsParaLimpar.push(lead.id);

  const conversa = [
    { from: 'vendedor', text: 'Olá! Tudo bem?', time: '15:00' },
    { from: 'lead', text: 'Boa! Quero um site massa pra minha barbearia', time: '15:02' },
    { from: 'vendedor', text: 'Perfeito, posso te ajudar', time: '15:03' },
    { from: 'lead', text: 'Quanto custa? Tem desconto se fechar hoje?', time: '15:05' },
  ];

  const perfil = await intelligenceService.updateIntelligence(lead, conversa, {
    resumoConversa: 'Lead quer site, perguntou preço e desconto',
    resultado: 'pendente',
  });
  const perfilObj = await intelligenceService.getIntelligence(lead.id);
  resultados.push(CHECK(perfil.preferredTone === 'informal', `Perfil detectou tom informal → ${perfil.preferredTone}`));
  resultados.push(CHECK(JSON.parse(perfil.interestedProducts).includes('Site Profissional'), 'Perfil detectou interesse em Site'));
  resultados.push(CHECK(!!perfilObj, 'Perfil persistido no banco'));

  // Simula a sugestão da IA com o perfil + RAG + insights
  const profileSection = intelligenceService.buildProfileSection(perfil);
  const ragSection2 = rag.ragSection;
  const params = await feedbackService.getParams();
  const paramsSection = feedbackService.buildParamsSection(params);
  const insightsBefore = await analyticsService.generateInsights({ days: 30 });
  const insightsSection = await analyticsService.buildInsightsSection();

  const promptComContexto = [
    profileSection ? 'TEM_PERFIL' : null,
    paramsSection ? 'TEM_PARAMS' : null,
    ragSection2 ? 'TEM_RAG' : null,
    insightsSection ? 'TEM_INSIGHTS' : null,
  ].filter(Boolean);

  resultados.push(CHECK(promptComContexto.includes('TEM_PERFIL'), 'Prompt recebe perfil do lead'));
  resultados.push(CHECK(promptComContexto.includes('TEM_RAG'), 'Prompt recebe base de conhecimento'));
  resultados.push(CHECK(promptComContexto.includes('TEM_INSIGHTS'), 'Prompt recebe insights'));
  console.log('');

  // ============ 4. CAMADA 2 — FEEDBACK LOOP ============
  console.log('🔄 [Camada 2] Feedback loop');
  // Sugestão simulada da IA
  const sugestao = await feedbackService.registerSuggestion({
    leadId: lead.id,
    contexto: 'whatsapp',
    suggestionText: 'Olá! Consigo um desconto especial no site para a sua barbearia se fecharmos essa semana. Posso te enviar os detalhes?',
  });
  // Vendedor edita (encurta + informal)
  await feedbackService.registerAction({
    id: sugestao.id,
    actionTaken: 'editou',
    vendedorText: 'Boa! Consigo desconto no site. Te mando detalhes?',
  });
  // Lead responde positivo
  await feedbackService.updateResult({ id: sugestao.id, result: 'positivo', responseTimeMin: 3 });

  // Mais 2 sugestões para dar base ao auto-ajuste
  for (const [orig, fin, result] of [
    ['Boa noite! Tenho uma solução completa para sua barbearia com agendamento online. Quer que eu te mostre?', 'Tenho solução c/ agendamento. Te mostro?', 'positivo'],
    ['Olá! Percebi que você tem interesse em melhorar sua presença digital. Nossa solução inclui site, Instagram e tráfego pago com relatórios mensais completos para você acompanhar todos os resultados em detalhes.', 'Tenho solução completa p/ sua presença digital. Quer ver?', 'negativo'],
  ]) {
    const s = await feedbackService.registerSuggestion({ leadId: lead.id, suggestionText: orig });
    await feedbackService.registerAction({ id: s.id, actionTaken: 'editou', vendedorText: fin });
    await feedbackService.updateResult({ id: s.id, result, responseTimeMin: result === 'positivo' ? 4 : 90 });
  }

  const ajuste = await feedbackService.analyzeAndAdjust({ days: 30 });
  resultados.push(CHECK(ajuste.patterns.some((p) => p.includes('ENCURTAR')), 'Auto-ajuste detectou padrão de encurtamento'));
  resultados.push(CHECK(ajuste.params.respostaCurta === true, 'Parâmetro respostaCurta ajustado'));
  resultados.push(CHECK(ajuste.accuracyRate >= 0 && ajuste.accuracyRate <= 100, `Taxa de aceite válida (${ajuste.accuracyRate}%)`));
  console.log('');

  // ============ 5. CAMADA 4 — ANALYTICS ============
  console.log('📊 [Camada 4] Analytics e insights');
  const dash = await analyticsService.getDashboard({ days: 30 });
  resultados.push(CHECK(dash.feedback.total >= 3, `Analytics contabiliza ${dash.feedback.total} sugestões`));
  resultados.push(CHECK(dash.approach.curta.taxaConversao >= 60, `Curta converte bem (2 de 3 curtas positivas) → ${dash.approach.curta.taxaConversao}%`));
  resultados.push(CHECK(dash.approach.comPergunta.taxaConversao >= 60, `Com pergunta converte bem → ${dash.approach.comPergunta.taxaConversao}%`));
  resultados.push(CHECK(dash.insights.insights.length >= 2, `Insights gerados (${dash.insights.insights.length})`));
  console.log('');

  // ============ 6. CAMADA 5 — VENDEDORES ============
  console.log('👥 [Camada 5] Aprendizado entre vendedores');
  // Adiciona logs de um 2º vendedor (pior) para comparação
  const lead2 = await prisma.lead.create({
    data: { nome: 'E2E Loja', telefone: '+55 11 93333-0000', servico: 'Loja', status: 'interessado' },
  });
  idsParaLimpar.push(lead2.id);
  // createMany não é suportado no SQLite/Prisma 5 — usar create em loop
  for (const t of [
    'Prezado cliente, temos uma ampla solução de marketing digital com muitas funcionalidades e relatórios detalhados para otimização de suas campanhas.',
    'Gostaríamos de apresentar nossa proposta abrangente de serviços para sua empresa com diversos benefícios exclusivos.',
  ]) {
    await prisma.aiSuggestionLog.create({
      data: { leadId: lead2.id, vendedorId: 'vendedor-b', suggestionText: t, vendedorText: t, actionTaken: 'editou', result: 'negativo', diff: JSON.stringify({ mudou: false }) },
    });
  }

  // Marca os logs do vendedor-a (principal) com vendedorId para comparação
  await prisma.aiSuggestionLog.updateMany({
    where: { leadId: lead.id },
    data: { vendedorId: 'vendedor-a' },
  });

  const perfVendedores = await learningService.getPerformanceByVendedor({ days: 30 });
  const vendedorA = perfVendedores.find((v) => v.vendedorId === 'vendedor-a');
  const vendedorB = perfVendedores.find((v) => v.vendedorId === 'vendedor-b');
  resultados.push(CHECK(!!vendedorA && !!vendedorB, '2 vendedores comparados'));
  resultados.push(CHECK(vendedorA.taxaConversao > vendedorB.taxaConversao, `Vendedor A (${vendedorA.taxaConversao}%) > B (${vendedorB.taxaConversao}%)`));

  const aplicado = await learningService.applyTopPerformerPattern({ days: 30 });
  resultados.push(CHECK(aplicado.aplicado === true, 'Padrão do top performer aplicado'));
  resultados.push(CHECK(aplicado.topPerformer.vendedorId === 'vendedor-a', `Top performer = vendedor-a → ${aplicado.topPerformer.vendedorId}`));
  console.log('');

  // ============ RESUMO ============
  console.log('══════════════════════════════════════════');
  const passou = resultados.filter(Boolean).length;
  console.log(`RESULTADO: ${passou}/${resultados.length} verificações passaram`);
  if (passou === resultados.length) console.log('🎉 TODAS AS 5 CAMADAS FUNCIONANDO EM CONJUNTO!');
  else console.log('⚠️ Algumas verificações falharam.');
  console.log('══════════════════════════════════════════');

  return passou === resultados.length ? 0 : 1;
}

// Limpeza (mesmo em erro)
async function cleanup() {
  for (const id of idsParaLimpar) {
    await prisma.lead.delete({ where: { id } }).catch(() => {});
  }
  await prisma.knowledgeDoc.deleteMany({}).catch(() => {});
  await prisma.configuracao.deleteMany({
    where: { chave: { in: ['ai:params', 'ai:insights', 'ai:top-pattern', 'ai:learning-settings'] } },
  }).catch(() => {});
  console.log('\n🧹 Dados de teste limpos');
  await prisma.$disconnect();
}

main()
  .then(async (code) => { await cleanup(); process.exit(code); })
  .catch(async (e) => { console.error('ERRO:', e); await cleanup(); process.exit(1); });
