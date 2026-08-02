/**
 * Teste do Editor Visual de Ajustes (Passo 6)
 *
 * Verifica:
 *  1. getConteudo retorna overrides + base
 *  2. render com overrides manuais aplica edições
 *  3. Sanitização XSS nos overrides (script removido)
 *  4. Persistência dos overrides em arquivosJson
 *  5. Preview reflete as edições
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
  console.log('\n=== TESTE EDITOR VISUAL DE AJUSTES ===\n');

  // Preparar lead + site
  const lead = await prisma.lead.create({
    data: {
      nome: 'João Restaurante Teste',
      telefone: '5511999999999',
      servico: 'Delivery de comida',
      cidade: 'São Paulo',
    },
  });
  const site = await SiteService.createQuick(lead.id, { template: 'restaurante', cor: '#7c3aed' });

  // 1. getConteudo inicial (sem overrides)
  console.log('1) getConteudo inicial');
  const inicial = await SiteService.getConteudo(site.id);
  check('base retorna templateId', inicial.base.templateId === 'restaurante');
  check('overrides vazio inicialmente', Object.keys(inicial.overrides).length === 0);

  // 2. render com overrides manuais
  console.log('\n2) render com overrides manuais');
  const overrides = {
    heroTitulo: 'Comida da Casa <script>alert(1)</script>',
    heroSub: 'Entrega rápida em SP',
    heroCta: 'Pedir agora',
    servicosTitulo: 'Nosso cardápio',
    servicos: [
      { icone: '🍕', nome: 'Pizza Especial', desc: 'Massa artesanal', preco: 'R$ 55' },
      { icone: '🍔', nome: 'Burger', desc: 'Artesanal', preco: 'R$ 35' },
      { icone: '', nome: '', desc: '', preco: '' }, // inválido — deve ser removido
    ],
    selos: ['Delivery 24h', 'Retirada', '', 'Garantia'],
    depoimentos: [
      { texto: 'Melhor entrega da cidade!', autor: 'Maria S.' },
      { texto: '', autor: '' }, // inválido
    ],
    ctaTitulo: 'Peça já',
    ctaBotao: 'Fazer pedido',
    waMensagem: 'Olá! Quero fazer um pedido',
  };
  const resultado = await SiteService.render(site.id, { overrides });
  check('usouIA = false (manual)', resultado.usouIA === false);
  check('aviso de edição manual', resultado.aviso === 'Conteúdo editado manualmente.');
  check('hero aplicado sem script', resultado.html.includes('Comida da Casa') && !resultado.html.includes('alert(1)'));
  check('heroSub aplicado', resultado.html.includes('Entrega rápida em SP'));
  check('servico 1 aplicado', resultado.html.includes('Pizza Especial') && resultado.html.includes('R$ 55'));
  check('servico 2 aplicado', resultado.html.includes('Burger'));
  check('servicos inválidos removidos (só 2 válidos)', resultado.overrides.servicos.length === 2, `(${resultado.overrides.servicos.length})`);
  check('selo vazio removido', resultado.overrides.selos.length === 3);
  check('depoimento inválido removido', resultado.overrides.depoimentos.length === 1);
  check('CTA aplicado', resultado.html.includes('Peça já') && resultado.html.includes('Fazer pedido'));
  check('waMensagem aplicado', resultado.html.includes('Quero fazer um pedido'));

  // 3. Persistência
  console.log('\n3) Persistência dos overrides');
  const salvo = await SiteService.getById(site.id);
  const arquivos = JSON.parse(salvo.arquivosJson || '{}');
  check('overrides.json salvo', !!arquivos['overrides.json']);
  check('index.html salvo', !!arquivos['index.html']);

  // 4. getConteudo após edição
  console.log('\n4) getConteudo após edição');
  const aposEdicao = await SiteService.getConteudo(site.id);
  check('overrides persistidos retornam', aposEdicao.overrides.heroTitulo === 'Comida da Casa');
  check('servicos persistidos', aposEdicao.overrides.servicos.length === 2);

  // 5. Preview reflete edição
  console.log('\n5) Preview reflete edição');
  const html = await SiteService.getHtml(site.id);
  check('preview tem hero editado', html.includes('Comida da Casa'));
  check('preview tem waMensagem', html.includes('Quero fazer um pedido'));

  // Limpeza
  await SiteService.remove(site.id);
  await prisma.lead.delete({ where: { id: lead.id } });
  console.log('\n6) Dados de teste removidos');

  console.log(`\n========================================`);
  console.log(`RESULTADO: ${passou} passou, ${falhou} falhou`);
  console.log(`========================================\n`);

  if (falhou > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal no teste:', err);
  process.exit(1);
});
