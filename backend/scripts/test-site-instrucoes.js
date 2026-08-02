// Teste: campo de chat de instruções para a IA (Fase 4 - feature instrucoes)
// Fluxo: criar site com instrucoes -> salvar -> buildLeadContext prioriza -> update permite alterar
const prisma = require('../src/core/lib/prisma');
const siteService = require('../src/modules/sites/site.service');
const { buildLeadContext, buildPrompt } = require('../src/modules/sites/site-ai.service');

const INSTRUCOES_TESTE = 'Sou uma clínica de podologia, quero seções de avaliação, tratamento de unhas e depoimentos. Tom acolhedor, destaque o agendamento pelo WhatsApp.';

let passou = 0;
let falhou = 0;
const check = (nome, cond) => {
  if (cond) { passou++; console.log('  ✅ ' + nome); }
  else { falhou++; console.log('  ❌ ' + nome); }
};

(async () => {
  console.log('\n=== TESTE CAMPO DE CHAT (INSTRUÇÕES P/ IA) ===\n');

  let siteId = null;
  try {
    // 1) Criar site com instrucoes
    console.log('1) Criação com instrucoes');
    const lead = await prisma.lead.findFirst();
    if (!lead) throw new Error('Nenhum lead no banco para testar');
    const criado = await siteService.createQuick(lead.id, {
      template: 'clinica',
      nomeSite: 'Clínica Teste Instruções',
      instrucoes: INSTRUCOES_TESTE,
    });
    siteId = criado.id;
    check('site criado com id', !!siteId);
    const doBanco = await prisma.siteDemo.findUnique({ where: { id: siteId } });
    check('instrucoes salvas no banco', doBanco.instrucoes === INSTRUCOES_TESTE);
    check('slice 4000 respeitado', doBanco.instrucoes.length <= 4000);

    // 2) getById retorna instrucoes
    console.log('2) getById');
    const viaService = await siteService.getById(siteId);
    check('getById retorna instrucoes', viaService.instrucoes === INSTRUCOES_TESTE);

    // 3) buildLeadContext coloca instrucoes no topo (prioridade máxima)
    console.log('3) buildLeadContext prioriza instrucoes');
    const contexto = buildLeadContext(criado, lead, {});
    const idxInstrucoes = contexto.indexOf('INSTRUÇÕES DO VENDEDOR');
    check('marca INSTRUÇÕES DO VENDEDOR presente', idxInstrucoes >= 0);
    check('texto das instruções incluído', contexto.includes('clínica de podologia'));
    check('instrucoes no topo (antes dos dados do lead)', idxInstrucoes < contexto.indexOf('Nome/Empresa'));

    // 4) buildPrompt inclui seção PRIORIDADE MÁXIMA
    console.log('4) buildPrompt reforça prioridade');
    const prompt = buildPrompt('clinica', 'Clínica', contexto, 'Clínica Teste');
    check('seção PRIORIDADE MÁXIMA presente', prompt.includes('PRIORIDADE MÁXIMA'));
    check('prompt orienta seguir instruções', prompt.toLowerCase().includes('prioridade sobre qualquer outro'));

    // 5) update permite alterar instrucoes
    console.log('5) update de instrucoes');
    const novasInstrucoes = 'Agora quero tema escuro e foco em cursos online.';
    const atualizado = await siteService.update(siteId, { instrucoes: novasInstrucoes });
    check('update aceita instrucoes', atualizado.instrucoes === novasInstrucoes);
    const doBanco2 = await prisma.siteDemo.findUnique({ where: { id: siteId } });
    check('alteração persistida', doBanco2.instrucoes === novasInstrucoes);

    // 6) instalar sem instrucoes -> campo null
    console.log('6) criação sem instrucoes');
    const semInstrucoes = await siteService.createQuick(lead.id, { template: 'barbearia', nomeSite: 'Sem Instruções' });
    const doBanco3 = await prisma.siteDemo.findUnique({ where: { id: semInstrucoes.id } });
    check('instrucoes fica null', doBanco3.instrucoes === null);
    const contexto2 = buildLeadContext(semInstrucoes, lead, {});
    check('sem instrucoes não força seção', !contexto2.includes('INSTRUÇÕES DO VENDEDOR'));
    await siteService.remove(semInstrucoes.id);
  } catch (e) {
    falhou++;
    console.log('  ❌ ERRO: ' + e.message);
  } finally {
    // Limpeza
    if (siteId) {
      try { await siteService.remove(siteId); } catch (e) { console.log('  (limpeza: ' + e.message + ')'); }
    }
  }

  console.log('\n========================================');
  console.log('RESULTADO: ' + passou + ' passou, ' + falhou + ' falhou');
  console.log('========================================\n');
  process.exit(falhou > 0 ? 1 : 0);
})();
