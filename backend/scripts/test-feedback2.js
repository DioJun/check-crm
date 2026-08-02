// Verificação rápida dos checks do feedback (com reset de params)
const prisma = require('../src/core/lib/prisma');
const feedback = require('../src/modules/whatsapp/feedback.service');

async function main() {
  // Reset params para teste determinístico
  await feedback.saveParams({ ...feedback.DEFAULT_PARAMS });

  const lead = await prisma.lead.create({
    data: { nome: 'Lead Feedback 2', telefone: '+55 11 96666-5555', servico: 'Padaria', status: 'interessado' },
  });

  // Sugestão 1: editada (encurtou) → positivo
  const s1 = await feedback.registerSuggestion({ leadId: lead.id, suggestionText: 'Olá! Tenho uma solução completa para sua padaria com site, delivery e divulgação. Posso te mostrar?' });
  await feedback.registerAction({ id: s1.id, actionTaken: 'editou', vendedorText: 'Tenho solução p/ sua padaria. Te mostro?' });
  await feedback.updateResult({ id: s1.id, result: 'positivo', responseTimeMin: 3 });

  // Sugestão 2: copiada sem edição → positivo
  const s2 = await feedback.registerSuggestion({ leadId: lead.id, suggestionText: 'Boa noite! Quer que eu te ligue amanhã?' });
  await feedback.registerAction({ id: s2.id, actionTaken: 'copiou' });
  await feedback.updateResult({ id: s2.id, result: 'positivo', responseTimeMin: 4 });

  // Sugestão 3: editada (encurtou) → negativo
  const s3 = await feedback.registerSuggestion({ leadId: lead.id, suggestionText: 'Olá! Percebi seu interesse em melhorar a divulgação. Tenho uma solução que inclui redes sociais e tráfego pago. Quer saber mais?' });
  await feedback.registerAction({ id: s3.id, actionTaken: 'editou', vendedorText: 'Tenho solução de divulgação. Bora?' });
  await feedback.updateResult({ id: s3.id, result: 'negativo', responseTimeMin: 90 });

  const ajuste = await feedback.analyzeAndAdjust({ days: 30 });

  const checks = [
    ['Taxa aceite = 33.3% (1 de 3 usadas)', ajuste.accuracyRate === 33.3],
    ['Taxa edição = 66.7% (2 de 3 editadas)', ajuste.editRate === 66.7],
    ['Taxa positiva = 66.7% (2 de 3)', ajuste.positiveRate === 66.7],
    ['Padrão ENCURTAR detectado', ajuste.patterns.some((p) => p.includes('ENCURTAR'))],
    ['respostaCurta ativado', ajuste.params.respostaCurta === true],
    ['maxFrases = 3 (reduzido de 4)', ajuste.params.maxFrases === 3],
  ];

  console.log(`RESULTADO: ${checks.filter((c) => c[1]).length}/${checks.length} passaram`);
  console.log(`accuracy=${ajuste.accuracyRate} edit=${ajuste.editRate} positive=${ajuste.positiveRate}`);
  console.log(`patterns=${JSON.stringify(ajuste.patterns)}`);
  console.log(`params=${JSON.stringify(ajuste.params)}`);
  checks.forEach(([msg, ok]) => console.log(`  ${ok ? 'OK' : 'FALHOU'}: ${msg}`));

  await prisma.lead.delete({ where: { id: lead.id } }).catch(() => {});
}

main().catch((e) => { console.error('ERRO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
