// Teste da Camada 2 — Feedback loop com o vendedor
const prisma = require('../src/core/lib/prisma');
const feedback = require('../src/modules/whatsapp/feedback.service');

const CHECK = (cond, msg) => console.log(`${cond ? '✅' : '❌'} ${msg}`);

async function main() {
  // Lead de teste
  const lead = await prisma.lead.create({
    data: { nome: 'Lead Feedback Teste', telefone: '+55 11 97777-6666', servico: 'Restaurante', status: 'interessado' },
  });
  console.log(`📌 Lead: ${lead.nome} (${lead.id})`);

  // ============ 1. REGISTRAR SUGESTÃO ============
  const sug1 = await feedback.registerSuggestion({
    leadId: lead.id,
    contexto: 'whatsapp',
    suggestionText: 'Olá! Preparado uma proposta especial para o seu restaurante com preço promocional esta semana. Posso te enviar os detalhes?',
  });
  CHECK(!!sug1.id, 'Sugestão original registrada');

  // ============ 2. VENDEDOR EDITA (encurta + informal) ============
  const acao1 = await feedback.registerAction({
    id: sug1.id,
    actionTaken: 'editou',
    vendedorText: 'Valeu! Tenho uma proposta com desconto pra vc. Te mando os detalhes?',
  });
  const diff1 = JSON.parse(acao1.diff);
  CHECK(diff1.mudou === true, 'Diff calculado (houve mudança)');
  CHECK(diff1.encurtou === true, 'Diff detecta encurtamento');
  console.log(`  → Diff: encurtou=${diff1.encurtou}, adicionou=[${diff1.adicionou.slice(0,3)}], removeu=[${diff1.removeu.slice(0,3)}]`);

  // ============ 3. RESULTADO POSITIVO + TEMPO ============
  const res1 = await feedback.updateResult({ id: sug1.id, result: 'positivo', responseTimeMin: 3 });
  CHECK(res1.result === 'positivo', 'Resultado positivo registrado');

  // ============ 4. MAIS SUGESTÕES PARA GERAR PADRÃO ============
  // Sugestão 2: copiada sem edição → positivo
  const sug2 = await feedback.registerSuggestion({ leadId: lead.id, suggestionText: 'Boa noite! Quer que eu te ligue amanhã para conversarmos sobre a divulgação?' });
  await feedback.registerAction({ id: sug2.id, actionTaken: 'copiou' });
  await feedback.updateResult({ id: sug2.id, result: 'positivo', responseTimeMin: 5 });

  // Sugestão 3: editada encurtando → negativo
  const sug3 = await feedback.registerSuggestion({ leadId: lead.id, suggestionText: 'Olá! Percebi que você tem interesse em melhorar a presença online do seu restaurante. Tenho uma solução completa que inclui site, Instagram e Google. Posso te mostrar como funciona e quais resultados você pode esperar?' });
  await feedback.registerAction({ id: sug3.id, actionTaken: 'editou', vendedorText: 'Tenho solução p/ seu restaurante. Te mostro?' });
  await feedback.updateResult({ id: sug3.id, result: 'negativo', responseTimeMin: 60 });

  // Sugestão 4: editada encurtando → positivo
  const sug4 = await feedback.registerSuggestion({ leadId: lead.id, suggestionText: 'Oi! Sobre o que conversamos, consigo garantir um preço especial fechando até sexta. Quer aproveitar?' });
  await feedback.registerAction({ id: sug4.id, actionTaken: 'editou', vendedorText: 'Fecha até sexta com desconto. Bora?' });
  await feedback.updateResult({ id: sug4.id, result: 'positivo', responseTimeMin: 2 });

  console.log('\n📊 Padrão esperado: vendedor ENCURTA sugestões (3 de 3 editadas encurtaram)');

  // ============ 5. AUTO-AJUSTE ============
  const ajuste = await feedback.analyzeAndAdjust({ days: 30 });
  console.log('\n📈 Auto-ajuste executado:');
  console.log(`  Total: ${ajuste.total}`);
  console.log(`  Taxa aceite: ${ajuste.accuracyRate}% | Edição: ${ajuste.editRate}% | Positiva: ${ajuste.positiveRate}%`);
  console.log(`  Padrões: ${ajuste.patterns.join(' | ') || 'nenhum'}`);
  console.log(`  Parâmetros: ${JSON.stringify(ajuste.params)}`);

  // Cálculo correto: 4 usadas (editou/copiou), 1 copiada sem edição, 3 editadas
  CHECK(ajuste.accuracyRate === 25, `Taxa de aceite 25% (1 de 4 usadas sem edição) → ${ajuste.accuracyRate}`);
  CHECK(ajuste.editRate === 75, `Taxa de edição 75% (3 de 4 editadas) → ${ajuste.editRate}`);
  CHECK(ajuste.positiveRate === 75, `Taxa positiva 75% (3 de 4) → ${ajuste.positiveRate}`);
  CHECK(ajuste.patterns.some((p) => p.includes('ENCURTAR')), 'Padrão "ENCURTA" detectado');
  CHECK(ajuste.params.respostaCurta === true, 'Parâmetro respostaCurta ativado');
  CHECK(ajuste.params.maxFrases === 3, 'maxFrases reduzido de 4 para 3');

  // ============ 6. SEÇÃO DE PARÂMETROS PARA O PROMPT ============
  const section = feedback.buildParamsSection(ajuste.params);
  console.log('\n📝 Seção de preferências aprendidas (injetada no prompt):');
  console.log(section);
  CHECK(section.includes('PREFERÊNCIAS APRENDIDAS'), 'Seção gerada para o prompt');
  CHECK(section.includes('CURTAS'), 'Instrução de resposta curta presente');

  // ============ 7. RELATÓRIO ============
  const report = await feedback.getReport({ days: 30 });
  console.log('\n📋 Relatório:');
  console.log(`  "A IA acertou ${report.taxaAceite}%. Nos erros, o padrão foi: ${report.descricaoPadroes}"`);

  // ============ 8. PERSISTÊNCIA DAS MÉTRICAS ============
  const period = new Date().toISOString().slice(0, 10);
  const metrics = await prisma.aiPerformanceMetrics.findUnique({ where: { period } });
  CHECK(!!metrics, 'AiPerformanceMetrics persistido para o período');
  CHECK(metrics.accuracyRate === ajuste.accuracyRate, 'Métricas batem com o cálculo');

  // Limpeza
  await prisma.lead.delete({ where: { id: lead.id } }).catch(() => {});
  console.log('\n🧹 Lead de teste removido (cascade apagou logs de sugestão)');
}

main().catch((e) => { console.error('ERRO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
