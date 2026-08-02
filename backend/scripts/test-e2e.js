/**
 * TESTE INTEGRADO (Passo 9) — Fluxo completo do módulo WhatsApp
 *
 * Simula exatamente o que o POST /api/whatsapp/analyze executa:
 *   1. Motor de padrões (alertas)
 *   2. Sugestão de ofertas (catálogo + matching)
 *   3. Lead Score dinâmico (cálculo + persistência)
 *   4. Log de ações do vendedor (visualização)
 *   5. Configuração de thresholds
 *
 * Usa um lead de teste criado no banco e limpa tudo ao final (cascade).
 * ⚠️ Não chama a IA externa (sugestão de resposta) — foco nos motores novos.
 */

const prisma = require('../src/core/lib/prisma');
const patternsService = require('../src/modules/whatsapp/patterns.service');
const offerService = require('../src/modules/whatsapp/offer.service');
const scoreService = require('../src/modules/whatsapp/score.service');
const actionLogService = require('../src/modules/whatsapp/actionlog.service');
const configService = require('../src/modules/whatsapp/config.service');

// ============ CENÁRIO SIMULADO ============
// Lead interessado em site + CRM, com sinal de compra e 9 dias de inatividade
// no histórico (ultimaInteracao antiga) mas conversa ativa agora.
const CENARIO = {
  nome: 'Lead Teste Integrado',
  telefone: '+55 11 99999-8888',
  servico: 'Oficina Mecânica',
  status: 'interessado',
  ultimaInteracao: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000), // 9 dias atrás
  aniversario: new Date(), // hoje (para disparar alerta de aniversário)
};

const CONVERSA = [
  { from: 'vendedor', text: 'Olá! Vi que sua oficina é bem avaliada no Google.', time: '09:00' },
  { from: 'lead', text: 'Obrigado! Estou precisando organizar minha equipe de atendimento', time: '09:02' },
  { from: 'vendedor', text: 'Tenho uma solução de CRM que ajuda nisso', time: '09:05' },
  { from: 'lead', text: 'Quanto custa? Preciso para o mês que vem, tenho pressa', time: '09:06' },
  { from: 'vendedor', text: 'Vou te mandar a proposta ainda hoje', time: '09:08' },
  { from: 'lead', text: 'Perfeito! Também quero um site profissional pra oficina', time: '09:09' },
];

// ============ RESULTADOS ESPERADOS ============
const CHECK = (condicao, msg) => {
  const status = condicao ? '✅' : '❌';
  console.log(`${status} ${msg}`);
  return !!condicao;
};

async function main() {
  const resultados = [];
  let lead = null;

  try {
    // ---------- 1. CRIAR LEAD DE TESTE ----------
    lead = await prisma.lead.create({ data: CENARIO });
    console.log(`📌 Lead de teste criado: ${lead.nome} (${lead.id})`);

    // ---------- 2. CONFIGURAÇÃO ----------
    const config = await configService.getConfig();
    resultados.push(CHECK(config.inatividadeDias.interessado === 7, 'Config carregada (defaults ok)'));

    // ---------- 3. MOTOR DE PADRÕES (ALERTAS) ----------
    const alertas = await patternsService.detectAndSaveAlerts(lead, CONVERSA, config);
    console.log(`\n🔔 Alertas gerados (${alertas.length}):`);
    alertas.forEach((a) => console.log(`   [${a.prioridade.toUpperCase()}] ${a.titulo}`));

    const tiposAlertas = alertas.map((a) => a.tipo);
    resultados.push(CHECK(tiposAlertas.includes('urgencia'), 'Alerta de URGÊNCIA gerado (sinal de compra: "quanto custa/pressa")'));
    resultados.push(CHECK(tiposAlertas.includes('oportunidade'), 'Alerta de OPORTUNIDADE gerado (aniversário hoje)'));
    resultados.push(CHECK(tiposAlertas.includes('inatividade'), 'Alerta de INATIVIDADE gerado (9 dias > threshold 7)'));

    // ---------- 4. SUGESTÃO DE OFERTAS ----------
    const { interests, ofertas } = await offerService.suggestOffers(CONVERSA, lead);
    console.log(`\n🎁 Ofertas sugeridas (${ofertas.length}):`);
    ofertas.forEach((o) => console.log(`   - ${o.produto.nome} (R$ ${o.produto.preco}) → ${o.motivo}`));

    const nomesOfertas = ofertas.map((o) => o.produto.nome);
    resultados.push(CHECK(interests.some((i) => i.tag === 'crm'), 'Interesse em CRM detectado ("organizar equipe")'));
    resultados.push(CHECK(interests.some((i) => i.tag === 'site'), 'Interesse em Site detectado ("site profissional")'));
    resultados.push(CHECK(nomesOfertas.includes('CRM Checkmate'), 'Oferta CRM Checkmate sugerida'));
    resultados.push(CHECK(nomesOfertas.includes('Site Profissional'), 'Oferta Site Profissional sugerida'));

    // ---------- 5. LEAD SCORE ----------
    const interacoesCount = await prisma.interacao.count({ where: { leadId: lead.id } });
    const calculado = scoreService.calculateScore({ lead, messages: CONVERSA, interacoesCount });
    const salvo = await scoreService.saveScore(lead.id, calculado);
    console.log(`\n📊 Lead Score: ${salvo.score}/100 (${salvo.label})`);
    resultados.push(CHECK(salvo.score >= 60, `Score alto esperado (quente) — obteve ${salvo.score}`));
    resultados.push(CHECK(salvo.score <= 100, 'Score dentro do limite 0-100'));

    const historico = await scoreService.getScoreHistory(lead.id);
    resultados.push(CHECK(historico.length >= 1, `Score persistido no histórico (${historico.length} entrada(s))`));

    // ---------- 6. LOG DE AÇÕES ----------
    await actionLogService.logVisualizacao(lead.id, { alertas: alertas.length, ofertas: ofertas.length, score: salvo.score });
    await actionLogService.logAction({ leadId: lead.id, tipo: 'alerta', acao: 'silenciou', detalhe: { titulo: 'Teste' } });
    const logs = await actionLogService.listLogs({ leadId: lead.id });
    console.log(`\n📝 Logs registrados (${logs.length}):`);
    logs.forEach((l) => console.log(`   [${l.acao}] ${l.tipo}`));
    resultados.push(CHECK(logs.length === 2, '2 ações registradas (visualizou + silenciou)'));

    // ---------- 7. PERSISTÊNCIA NO LEAD ----------
    const leadAtualizado = await prisma.lead.findUnique({ where: { id: lead.id } });
    resultados.push(CHECK(leadAtualizado.leadScore === salvo.score, 'Lead.leadScore persistido no CRM'));

    // ---------- RESUMO ----------
    console.log('\n' + '='.repeat(50));
    const passou = resultados.filter(Boolean).length;
    console.log(`RESULTADO: ${passou}/${resultados.length} verificações passaram`);
    if (passou === resultados.length) console.log('🎉 TODOS OS CENÁRIOS PASSARAM!');
    else console.log('⚠️ Algumas verificações falharam — revisar.');
    console.log('='.repeat(50));

    return passou === resultados.length ? 0 : 1;
  } finally {
    // Limpa o lead de teste (cascade remove alertas, logs, histórico, ofertas)
    if (lead) {
      await prisma.lead.delete({ where: { id: lead.id } }).catch(() => {});
      console.log('\n🧹 Lead de teste removido (cascade aplicado)');
    }
    await prisma.$disconnect();
  }
}

main().then((code) => process.exit(code)).catch((e) => { console.error('ERRO:', e); process.exit(1); });
