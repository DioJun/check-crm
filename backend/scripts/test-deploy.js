/**
 * Teste da Integração Vercel (Passo 7)
 *
 * Verifica:
 *  1. buildFiles monta payload correto (index.html + vercel.json + nome slug)
 *  2. saveConfig/getConfig persistem token/teamId (sem expor token no GET)
 *  3. deploy sem token → erro claro (400)
 *  4. deploy com token fake → erro da API (502)
 *  5. Endpoints HTTP: GET /deploy/config
 *  6. Limpeza
 */
const prisma = require('../src/core/lib/prisma');
const SiteService = require('../src/modules/sites/site.service');
const DeployService = require('../src/modules/sites/deploy.service');

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
  console.log('\n=== TESTE INTEGRAÇÃO VERCEL ===\n');

  // 1. buildFiles
  console.log('1) buildFiles (payload do deploy)');
  const html = '<!DOCTYPE html><html><body>Teste</body></html>';
  const payload = DeployService.buildFiles(html, 'Barbearia do João');
  check('arquivos tem index.html', payload.files.some((f) => f.file === 'index.html' && f.data.includes('Teste')));
  check('arquivos tem vercel.json', payload.files.some((f) => f.file === 'vercel.json'));
  check('nome do projeto com slug', payload.name === 'demo-barbearia-do-joao', `(${payload.name})`);
  check('target production', payload.target === 'production');
  check('projectSettings presente (novos projetos exigem)', payload.projectSettings && typeof payload.projectSettings === 'object');
  check('projectSettings com framework null (estático)', payload.projectSettings.framework === null);

  // 2. saveConfig/getConfig
  console.log('\n2) saveConfig/getConfig');
  const original = await DeployService.getConfig();
  await DeployService.saveConfig({ token: 'teste-token-vercel', teamId: 'team_abc' });
  const salvo = await DeployService.getConfig();
  check('token salvo', salvo.token === 'teste-token-vercel');
  check('teamId salvo', salvo.teamId === 'team_abc');

  // 3. deploy sem token
  console.log('\n3) deploy sem token');
  const lead = await prisma.lead.create({
    data: { nome: 'João Barbearia Teste', telefone: '5511999999999', servico: 'Corte' },
  });
  const site = await SiteService.createQuick(lead.id, { template: 'barbearia', cor: '#000000' });

  // Limpar token p/ testar erro
  await DeployService.saveConfig({ token: '', teamId: '' });
  try {
    await DeployService.deploy(site, '<html>teste</html>');
    check('deploy sem token lança erro', false, '(não lançou)');
  } catch (err) {
    check('deploy sem token lança erro', err.status === 400 && err.message.includes('Token'), `(${err.message})`);
  }

  // 4. deploy com token fake → erro da API
  console.log('\n4) deploy com token inválido');
  await DeployService.saveConfig({ token: 'token-invalido-teste', teamId: '' });
  try {
    await DeployService.deploy(site, '<html>teste</html>');
    check('deploy com token fake lança erro', false, '(não lançou)');
  } catch (err) {
    check('deploy com token fake lança erro (502)', err.status === 502, `(${err.status}: ${err.message})`);
  }

  // 5. publicar no site.service (sem token → erro claro)
  console.log('\n5) publicar (site.service) sem token');
  await DeployService.saveConfig({ token: '', teamId: '' });
  try {
    await SiteService.publicar(site.id);
    check('publicar sem token lança erro', false, '(não lançou)');
  } catch (err) {
    check('publicar sem token lança erro', err.status === 400 && err.message.includes('Token'), `(${err.message})`);
  }

  // 6. Endpoint HTTP GET /deploy/config
  console.log('\n6) Endpoint HTTP /deploy/config');
  try {
    const res = await fetch('http://localhost:3001/api/sites/deploy/config');
    const data = await res.json();
    check('HTTP 200 + response ok', res.status === 200 && data.success === true);
    check('configurado = false (sem token)', data.configurado === false);
    check('token não exposto', data.token === undefined);
  } catch (err) {
    check('endpoint /deploy/config responde', false, `(erro: ${err.message})`);
  }

  // Limpeza
  await SiteService.remove(site.id);
  await prisma.lead.delete({ where: { id: lead.id } });
  await DeployService.saveConfig({ token: original.token, teamId: original.teamId });
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
