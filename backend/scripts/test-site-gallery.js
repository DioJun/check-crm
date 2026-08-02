/**
 * Teste da Galeria/Histórico de Sites (Passo 9)
 *
 * Verifica:
 *  1. list com busca por nome do site
 *  2. list com filtro por template
 *  3. registrarVisita incrementa contador + atualiza status para visualizado
 *  4. list retorna ultimaVisita e visitasRecentes
 *  5. getStats retorna contagem por status + visitas recentes
 *  6. Endpoint HTTP GET /stats e POST /visita
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
  console.log('\n=== TESTE GALERIA/HISTÓRICO ===\n');

  // Preparar dados
  const lead = await prisma.lead.create({
    data: { nome: 'João Galeria Teste', telefone: '5511999999999', servico: 'Barbearia' },
  });
  const site1 = await SiteService.createQuick(lead.id, { template: 'barbearia', nomeSite: 'Barbearia do João' });
  const site2 = await SiteService.createQuick(lead.id, { template: 'restaurante', nomeSite: 'Restaurante da Maria' });
  await SiteService.update(site1.id, { status: 'enviado' });

  // 1. list com busca
  console.log('1) list com busca');
  const busca = await SiteService.list({ busca: 'João' });
  check('busca por nomeSite encontra', busca.some((s) => s.nomeSite === 'Barbearia do João'));
  const buscaLead = await SiteService.list({ busca: 'João Galeria' });
  check('busca por nome do lead encontra', buscaLead.some((s) => s.id === site2.id));

  // 2. list com template
  console.log('\n2) list com template');
  const porTemplate = await SiteService.list({ template: 'restaurante' });
  check('filtro por template', porTemplate.some((s) => s.id === site2.id) && !porTemplate.some((s) => s.id === site1.id));

  // 3. registrarVisita
  console.log('\n3) registrarVisita');
  const visita1 = await SiteService.registrarVisita(site1.id, { origem: 'whatsapp' });
  check('visita incrementa visualizacoes', visita1.visualizacoes === 1, `(${visita1.visualizacoes})`);
  check('status muda enviado → visualizado', visita1.status === 'visualizado', `(${visita1.status})`);
  check('ultimaVisita setada', !!visita1.ultimaVisita);
  await SiteService.registrarVisita(site1.id, { origem: 'direto' });
  await SiteService.registrarVisita(site1.id, { origem: 'utm' });

  // 4. list retorna ultimaVisita e visitasRecentes
  console.log('\n4) list com histórico');
  const listado = await SiteService.list();
  const s1 = listado.find((s) => s.id === site1.id);
  check('ultimaVisita no list', !!s1.ultimaVisita);
  check('visitasRecentes array', Array.isArray(s1.visitasRecentes) && s1.visitasRecentes.length === 3);
  check('visitasRecentes ordenadas desc', s1.visitasRecentes[0].visitadoEm >= s1.visitasRecentes[2].visitadoEm);

  // 5. getStats
  console.log('\n5) getStats');
  const stats = await SiteService.getStats();
  check('total de sites >= 2', stats.total >= 2);
  check('porStatus tem visualizado', (stats.porStatus['visualizado'] || 0) >= 1);
  check('totalVisitas >= 3', stats.totalVisitas >= 3);
  check('visitasRecentes não vazio', Array.isArray(stats.visitasRecentes) && stats.visitasRecentes.length >= 3);
  check('visitasRecentes tem siteDemo', stats.visitasRecentes[0].siteDemo?.id === site1.id);
  check('ultimosSites array', Array.isArray(stats.ultimosSites) && stats.ultimosSites.length >= 2);

  // 6. Endpoints HTTP
  console.log('\n6) Endpoints HTTP');
  try {
    const resStats = await fetch('http://localhost:3001/api/sites/stats');
    const dataStats = await resStats.json();
    check('GET /stats 200 + total', resStats.status === 200 && dataStats.total >= 2);
  } catch (err) {
    check('GET /stats responde', false, `(erro: ${err.message})`);
  }
  try {
    const resVisita = await fetch(`http://localhost:3001/api/sites/${site2.id}/visita`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origem: 'preview' }),
    });
    const dataVisita = await resVisita.json();
    check('POST /visita 200 + incrementa', resVisita.status === 200 && dataVisita.visualizacoes >= 1);
  } catch (err) {
    check('POST /visita responde', false, `(erro: ${err.message})`);
  }

  // Limpeza
  await SiteService.remove(site1.id);
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
