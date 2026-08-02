/**
 * Teste da Integração GitHub (Passo 8)
 *
 * Verifica:
 *  1. saveConfig/getConfig persistem token/owner
 *  2. publicarNoGitHub sem token → erro 400 claro
 *  3. publicarNoGitHub com token inválido → erro da API
 *  4. Endpoint HTTP GET /github/config
 *  5. Limpeza
 */
const prisma = require('../src/core/lib/prisma');
const SiteService = require('../src/modules/sites/site.service');
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
  console.log('\n=== TESTE INTEGRAÇÃO GITHUB ===\n');

  // 1. saveConfig/getConfig
  console.log('1) saveConfig/getConfig');
  const original = await GitHubService.getConfig();
  await GitHubService.saveConfig({ token: 'ghp_teste123', owner: 'meuuser' });
  const salvo = await GitHubService.getConfig();
  check('token salvo', salvo.token === 'ghp_teste123');
  check('owner salvo', salvo.owner === 'meuuser');

  // 2. publicarNoGitHub sem token
  console.log('\n2) publicarNoGitHub sem token');
  const lead = await prisma.lead.create({
    data: { nome: 'João Loja Teste', telefone: '5511999999999', servico: 'Loja' },
  });
  const site = await SiteService.createQuick(lead.id, { template: 'loja', cor: '#7c3aed' });

  await GitHubService.saveConfig({ token: '', owner: '' });
  try {
    await GitHubService.publicarNoGitHub(site, '<html>teste</html>');
    check('sem token lança erro', false, '(não lançou)');
  } catch (err) {
    check('sem token lança erro 400', err.status === 400 && err.message.includes('Token'), `(${err.message})`);
  }

  // 3. publicarNoGitHub com token inválido
  console.log('\n3) publicarNoGitHub com token inválido');
  await GitHubService.saveConfig({ token: 'token-invalido-teste', owner: '' });
  try {
    await GitHubService.publicarNoGitHub(site, '<html>teste</html>');
    check('token inválido lança erro', false, '(não lançou)');
  } catch (err) {
    check('token inválido lança erro da API', err.status >= 400 && err.status < 500, `(${err.status}: ${err.message})`);
  }

  // 4. Endpoint HTTP GET /github/config
  console.log('\n4) Endpoint HTTP /github/config');
  try {
    const res = await fetch('http://localhost:3001/api/sites/github/config');
    const data = await res.json();
    check('HTTP 200 + success', res.status === 200 && data.success === true);
    check('token não exposto', data.token === undefined);
  } catch (err) {
    check('endpoint /github/config responde', false, `(erro: ${err.message})`);
  }

  // Limpeza
  await SiteService.remove(site.id);
  await prisma.lead.delete({ where: { id: lead.id } });
  await GitHubService.saveConfig({ token: original.token, owner: original.owner });
  console.log('\n5) Dados de teste removidos');

  console.log(`\n========================================`);
  console.log(`RESULTADO: ${passou} passou, ${falhou} falhou`);
  console.log(`========================================\n`);

  if (falhou > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal no teste:', err);
  process.exit(1);
});
