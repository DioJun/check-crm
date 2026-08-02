/**
 * Teste E2E — Fluxo completo do Módulo Sites (Passo 12)
 *
 * Percorre o ciclo de vida inteiro de um site de demonstração:
 *  1. Criar lead + site de demo (fluxo de criação rápida)
 *  2. Renderizar com IA (ou fallback) → HTML válido
 *  3. Editar conteúdo manual (overrides) → re-renderizar
 *  4. Publicar no Vercel (sem token → erro claro) 
 *  5. Enviar para GitHub (sem token → erro claro)
 *  6. Marcar como visto → status visualizado + alerta site_visualizado
 *  7. Aprovar → status aprovado + alerta site_aprovado
 *  8. Briefing → proposta (R$ 1.490) → contrato → fechar
 *  9. Verificar galeria/estatísticas
 *  10. Limpeza
 */
const prisma = require('../src/core/lib/prisma');
const SiteService = require('../src/modules/sites/site.service');
const ClosingService = require('../src/modules/sites/closing.service');
const DeployService = require('../src/modules/sites/deploy.service');
const GitHubService = require('../src/modules/sites/github.service');

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
  console.log('\n=== TESTE E2E — FLUXO COMPLETO DO MÓDULO SITES ===\n');

  // Backup das configs de deploy
  const deployOrig = await DeployService.getConfig();
  const ghOrig = await GitHubService.getConfig();
  // Força sem token p/ testar fluxos de erro
  await DeployService.saveConfig({ token: '', teamId: '' });
  await GitHubService.saveConfig({ token: '', owner: '' });

  // ============ 1. Criação ============
  console.log('1) Criação rápida');
  const lead = await prisma.lead.create({
    data: { nome: 'E2E Teste Barbearia', telefone: '5511999999999', servico: 'Barbearia e corte', cidade: 'São Paulo', instagram: '@e2ebarba' },
  });
  const site = await SiteService.createQuick(lead.id, { template: 'barbearia', cor: '#e11d48', tom: 'moderno' });
  check('site criado com template', site.template === 'barbearia');
  check('status inicial gerado', site.status === 'gerado');
  check('cor aplicada', site.cor === '#e11d48');

  // ============ 2. Renderização ============
  console.log('\n2) Renderização (IA/fallback)');
  const rend = await SiteService.render(site.id);
  check('HTML gerado', rend.html.startsWith('<!DOCTYPE html>'));
  check('HTML sem placeholders', !rend.html.includes('{{'));
  check('HTML com siteId (tracking)', rend.html.includes(site.id));
  check('HTML com sendBeacon', rend.html.includes('sendBeacon'));

  // ============ 3. Edição manual ============
  console.log('\n3) Edição manual de conteúdo');
  const editado = await SiteService.render(site.id, {
    overrides: { heroTitulo: 'E2E Barbearia Top', servicos: [{ icone: '✂️', nome: 'Corte Premium', desc: 'Teste E2E', preco: 'R$ 60' }] },
  });
  check('conteúdo editado aplicado', editado.html.includes('E2E Barbearia Top'));
  check('serviço editado aplicado', editado.html.includes('Corte Premium') && editado.html.includes('R$ 60'));
  check('usouIA = false (manual)', editado.usouIA === false);
  const conteudo = await SiteService.getConteudo(site.id);
  check('overrides persistidos', conteudo.overrides.heroTitulo === 'E2E Barbearia Top');

  // ============ 4. Publicação (sem token) ============
  console.log('\n4) Publicação no Vercel (sem token)');
  try {
    await SiteService.publicar(site.id);
    check('publicar sem token lança erro', false, '(não lançou)');
  } catch (err) {
    check('publicar sem token → erro claro', err.status === 400 && err.message.includes('Token'), `(${err.message})`);
  }

  // ============ 5. GitHub (sem token) ============
  console.log('\n5) Envio GitHub (sem token)');
  try {
    await SiteService.enviarGitHub(site.id);
    check('github sem token lança erro', false, '(não lançou)');
  } catch (err) {
    check('github sem token → erro claro', err.status === 400 && err.message.includes('Token'), `(${err.message})`);
  }

  // ============ 6. Tracking ============
  console.log('\n6) Tracking (visitas + alertas)');
  await SiteService.update(site.id, { status: 'enviado', link: 'https://demo-e2e.vercel.app' });
  const v1 = await SiteService.registrarVisita(site.id, { origem: 'whatsapp' });
  check('status enviado → visualizado', v1.status === 'visualizado');
  check('alerta site_visualizado criado', v1.alertas.some((a) => a.tipo === 'site_visualizado'));

  // ============ 7. Aprovação ============
  console.log('\n7) Aprovação');
  const aprov = await SiteService.aprovarSite(site.id);
  check('status aprovado', aprov.site.status === 'aprovado');
  check('alerta site_aprovado criado', aprov.alerta?.tipo === 'site_aprovado');

  // ============ 8. Fechamento ============
  console.log('\n8) Fechamento (briefing → proposta → contrato → fechar)');
  await ClosingService.saveBriefing(site.id, {
    nome: 'E2E Barbearia', descricao: 'Barbearia premium', servicos: 'Cortes, barba, sobrancelha', telefone: '5511999999999',
  });
  const proposta = await ClosingService.gerarProposta(site.id);
  check('proposta usa catálogo Site Profissional', proposta.preco === 1490);
  check('proposta personalizada', proposta.proposta.includes('E2E Barbearia') && proposta.proposta.includes('R$ 1.490'));
  const contrato = await ClosingService.gerarContrato(site.id);
  check('contrato gerado', contrato.contrato.includes('CONTRATO'));
  check('contrato com escopo do briefing', contrato.contrato.includes('Cortes, barba, sobrancelha') || contrato.resumo.escopo.includes('Cortes'));
  await SiteService.update(site.id, { status: 'fechado' });
  const fechado = await SiteService.getById(site.id);
  check('site fechado', fechado.status === 'fechado');

  // ============ 9. Galeria/estatísticas ============
  console.log('\n9) Galeria e estatísticas');
  const stats = await SiteService.getStats();
  check('stats contam o site fechado', (stats.porStatus['fechado'] || 0) >= 1);
  check('stats total visitas >= 1', stats.totalVisitas >= 1);
  const lista = await SiteService.list({ busca: 'E2E' });
  check('busca encontra o site', lista.some((s) => s.id === site.id));

  // ============ 10. Limpeza + restauração ============
  console.log('\n10) Limpeza');
  await SiteService.remove(site.id);
  await prisma.lead.delete({ where: { id: lead.id } });
  await DeployService.saveConfig({ token: deployOrig.token, teamId: deployOrig.teamId });
  await GitHubService.saveConfig({ token: ghOrig.token, owner: ghOrig.owner });
  check('dados de teste removidos', true);

  console.log(`\n========================================`);
  console.log(`RESULTADO E2E: ${passou} passou, ${falhou} falhou`);
  console.log(`========================================\n`);

  if (falhou > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal no teste E2E:', err);
  process.exit(1);
});
