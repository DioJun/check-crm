/**
 * Teste da Integração CRM — Tracking + Alertas (Passo 10)
 *
 * Verifica:
 *  1. registrarVisita muda status enviado → visualizado e dispara alerta site_visualizado
 *  2. Dedup: segunda visita não cria novo alerta de visualização
 *  3. 3+ visitas em 24h → alerta site_3_acessos
 *  4. aprovarSite → status aprovado + alerta site_aprovado
 *  5. Beacon de tracking injetado no HTML (siteId + trackerUrl)
 *  6. Endpoints HTTP: POST /visita, POST /aprovar
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
  console.log('\n=== TESTE INTEGRAÇÃO CRM (TRACKING + ALERTAS) ===\n');

  // Preparar
  const lead = await prisma.lead.create({
    data: { nome: 'João Alerta Teste', telefone: '5511999999999', servico: 'Barbearia' },
  });
  const site = await SiteService.createQuick(lead.id, { template: 'barbearia', nomeSite: 'Barbearia do João' });
  await SiteService.update(site.id, { status: 'enviado', link: 'https://demo-joao.vercel.app' });

  // 1. Primeira visita → site_visualizado
  console.log('1) Primeira visita → alerta visualizado');
  const v1 = await SiteService.registrarVisita(site.id, { origem: 'whatsapp' });
  check('status enviado → visualizado', v1.status === 'visualizado', `(${v1.status})`);
  check('visualizacoes = 1', v1.visualizacoes === 1, `(${v1.visualizacoes})`);
  check('disparou alerta site_visualizado', v1.alertas.some((a) => a.tipo === 'site_visualizado'));

  const alertasLead = await prisma.alerta.findMany({ where: { leadId: lead.id } });
  check('alerta criado no banco', alertasLead.some((a) => a.tipo === 'site_visualizado' && a.status === 'ativo'));
  check('alerta com detalhe do site', alertasLead.find((a) => a.tipo === 'site_visualizado')?.detalhe?.includes('siteId'));

  // 2. Dedup: segunda visita não cria novo alerta de visualização
  console.log('\n2) Dedup de alerta');
  const v2 = await SiteService.registrarVisita(site.id, { origem: 'direto' });
  check('segunda visita NÃO cria novo visualizado', !v2.alertas.some((a) => a.tipo === 'site_visualizado'));
  check('visualizacoes = 2', v2.visualizacoes === 2);

  // 3. 3+ visitas em 24h → site_3_acessos
  console.log('\n3) 3+ visitas → alerta 3 acessos');
  const v3 = await SiteService.registrarVisita(site.id, { origem: 'utm' });
  check('terceira visita dispara site_3_acessos', v3.alertas.some((a) => a.tipo === 'site_3_acessos'));
  check('visualizacoes = 3', v3.visualizacoes === 3);

  // 4. aprovarSite
  console.log('\n4) Aprovação');
  const aprovado = await SiteService.aprovarSite(site.id);
  check('status = aprovado', aprovado.site.status === 'aprovado', `(${aprovado.site.status})`);
  check('aprovadoEm setado', !!aprovado.site.aprovadoEm);
  check('alerta site_aprovado criado', aprovado.alerta?.tipo === 'site_aprovado');

  // 5. Beacon no HTML
  console.log('\n5) Beacon de tracking no HTML');
  const html = await SiteService.getHtml(site.id);
  check('HTML contém siteId', html.includes(site.id));
  check('HTML contém sendBeacon', html.includes('sendBeacon'));

  // 6. Endpoints HTTP
  console.log('\n6) Endpoints HTTP');
  const site2 = await SiteService.createQuick(lead.id, { template: 'restaurante', nomeSite: 'Restaurante Teste' });
  await SiteService.update(site2.id, { status: 'enviado' });
  try {
    const res = await fetch(`http://localhost:3001/api/sites/${site2.id}/visita`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origem: 'preview' }),
    });
    const data = await res.json();
    check('POST /visita 200 + status visualizado', res.status === 200 && data.status === 'visualizado', `(${res.status})`);
    check('POST /visita retorna alertas', Array.isArray(data.alertas) && data.alertas.length > 0);
  } catch (err) {
    check('POST /visita responde', false, `(erro: ${err.message})`);
  }
  try {
    const res = await fetch(`http://localhost:3001/api/sites/${site2.id}/aprovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await res.json();
    check('POST /aprovar 200 + aprovado', res.status === 200 && data.site?.status === 'aprovado', `(${res.status})`);
  } catch (err) {
    check('POST /aprovar responde', false, `(erro: ${err.message})`);
  }

  // Limpeza (cascade remove alertas do lead)
  await SiteService.remove(site.id);
  await SiteService.remove(site2.id);
  await prisma.lead.delete({ where: { id: lead.id } });
  console.log('\n7) Dados de teste removidos');

  console.log(`\n========================================`);
  console.log(`RESULTADO: ${passou} passou, ${falhou} falhou`);
  console.log(`========================================\n`);

  if (falhou > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal no teste:', err);
  process.exit(1);
});
