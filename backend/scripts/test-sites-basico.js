/**
 * Teste básico do módulo Sites — fluxo de criação rápida (Passo 3)
 *
 * Verifica:
 *  1. Templates disponíveis
 *  2. Criação rápida de site para um lead
 *  3. Listagem
 *  4. Detalhe
 *  5. Atualização (cor/status)
 *  6. Remoção
 */
const prisma = require('../src/core/lib/prisma');
const SiteService = require('../src/modules/sites/site.service');

let passou = 0;
let falhou = 0;

function check(nome, cond, extra = '') {
  if (cond) {
    passou++;
    console.log(`  ✅ ${nome}`);
  } else {
    falhou++;
    console.log(`  ❌ ${nome} ${extra}`);
  }
}

async function main() {
  console.log('\n=== TESTE MÓDULO SITES (criação rápida) ===\n');

  // 1. Templates disponíveis
  console.log('1) Templates e tons');
  const templates = Object.keys(SiteService.TEMPLATES);
  check('7 templates definidos', templates.length === 7, `(${templates.length})`);
  check('tons válidos', SiteService.TONS.length === 3);

  // Preparar lead de teste
  const lead = await prisma.lead.create({
    data: {
      nome: 'João Barbearia Teste',
      telefone: '5511999999999',
      servico: 'Corte de cabelo e barba',
      cidade: 'São Paulo',
      instagram: '@joaobarba',
      observacoes: 'Quer modernizar o atendimento',
    },
  });
  console.log(`\n2) Lead de teste criado: ${lead.id}`);

  // 2. Sugestão de template
  console.log('\n3) Sugestão de template');
  const sugestao = SiteService.sugerirTemplate(lead);
  check('sugeriu barbearia', sugestao === 'barbearia', `(sugeriu: ${sugestao})`);

  // 3. Criação rápida
  console.log('\n4) Criação rápida');
  const site = await SiteService.createQuick(lead.id, { cor: '#222222', tom: 'moderno' });
  check('site criado com id', !!site.id);
  check('status inicial = gerado', site.status === 'gerado', `(${site.status})`);
  check('template sugerido automaticamente', site.template === 'barbearia', `(${site.template})`);
  check('ramo preenchido', site.ramo === 'Barbearia / Salão', `(${site.ramo})`);
  check('cor aplicada', site.cor === '#222222');
  check('nomeSite gerado', site.nomeSite === 'João', `(${site.nomeSite})`);
  check('lead incluído no retorno', site.lead && site.lead.nome === 'João Barbearia Teste');

  // 4. Listagem
  console.log('\n5) Listagem');
  const lista = await SiteService.list();
  check('site aparece na listagem', lista.some((s) => s.id === site.id));
  const porLead = await SiteService.list({ leadId: lead.id });
  check('filtro por lead funciona', porLead.length === 1);

  // 5. Detalhe
  console.log('\n6) Detalhe');
  const detalhe = await SiteService.getById(site.id);
  check('detalhe retorna visitas', Array.isArray(detalhe.visitas));

  // 6. Atualização
  console.log('\n7) Atualização');
  const atualizado = await SiteService.update(site.id, { status: 'enviado', link: 'https://demo-joao.vercel.app' });
  check('status atualizado para enviado', atualizado.status === 'enviado', `(${atualizado.status})`);
  check('link salvo', atualizado.link === 'https://demo-joao.vercel.app');

  // 7. Remoção
  console.log('\n8) Remoção');
  await SiteService.remove(site.id);
  const aposRemover = await SiteService.getById(site.id);
  check('site removido', aposRemover === null);

  // Limpar lead de teste
  await prisma.lead.delete({ where: { id: lead.id } });
  console.log('\n9) Lead de teste removido');

  console.log(`\n========================================`);
  console.log(`RESULTADO: ${passou} passou, ${falhou} falhou`);
  console.log(`========================================\n`);

  if (falhou > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal no teste:', err);
  process.exit(1);
});
