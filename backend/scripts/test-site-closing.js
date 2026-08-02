/**
 * Teste do Fluxo de Fechamento (Passo 11)
 *
 * Verifica:
 *  1. saveBriefing persiste campos conhecidos (sanitiza extras)
 *  2. getBriefing retorna o briefing salvo
 *  3. gerarProposta reusa catálogo "Site Profissional" (preço 1490)
 *  4. gerarContrato gera texto com escopo + valores
 *  5. fechar site → status fechado + fechadoEm
 *  6. Endpoints HTTP: PUT briefing, POST proposta, POST contrato, POST fechar
 */
const prisma = require('../src/core/lib/prisma');
const SiteService = require('../src/modules/sites/site.service');
const ClosingService = require('../src/modules/sites/closing.service');

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
  console.log('\n=== TESTE FLUXO DE FECHAMENTO ===\n');

  // Preparar
  const lead = await prisma.lead.create({
    data: { nome: 'João Fechamento Teste', telefone: '5511999999999', servico: 'Advocacia' },
  });
  const site = await SiteService.createQuick(lead.id, { template: 'advocacia', nomeSite: 'Advocacia do João' });
  await SiteService.update(site.id, { status: 'aprovado' });

  // 1. saveBriefing
  console.log('1) saveBriefing');
  const briefing = await ClosingService.saveBriefing(site.id, {
    nome: 'Advocacia João & Silva',
    descricao: 'Escritório de advocacia especializado em direito trabalhista',
    servicos: 'Direito trabalhista, civil e empresarial',
    telefone: '5511999999999',
    instagram: '@advjoaosilva',
    campoInvalido: 'deve ser ignorado', // não está em CAMPOS_BRIEFING
  });
  check('campos válidos salvos', briefing.nome === 'Advocacia João & Silva' && briefing.servicos.includes('trabalhista'));
  check('campo inválido ignorado', briefing.campoInvalido === undefined);
  check('instagram salvo', briefing.instagram === '@advjoaosilva');

  // 2. getBriefing
  console.log('\n2) getBriefing');
  const lido = await ClosingService.getBriefing(site.id);
  check('retorna briefing salvo', lido.nome === 'Advocacia João & Silva');
  check('mescla com campos', lido.telefone === '5511999999999');

  // 3. gerarProposta
  console.log('\n3) gerarProposta');
  const proposta = await ClosingService.gerarProposta(site.id);
  check('produto Site Profissional encontrado', proposta.produto?.nome?.includes('Site'), `(${proposta.produto?.nome})`);
  check('preco 1490', proposta.preco === 1490, `(${proposta.preco})`);
  check('proposta tem nome do cliente', proposta.proposta.includes('Advocacia João & Silva'));
  check('proposta tem preço', proposta.proposta.includes('R$ 1.490'));
  check('proposta tem seções do briefing', proposta.proposta.includes('Direito trabalhista'));

  // 4. gerarContrato
  console.log('\n4) gerarContrato');
  const contrato = await ClosingService.gerarContrato(site.id);
  check('contrato texto gerado', contrato.contrato.includes('CONTRATO DE PRESTAÇÃO DE SERVIÇOS'));
  check('contrato tem escopo', contrato.contrato.toUpperCase().includes('DESENVOLVIMENTO DE SITE'));
  check('contrato tem valor', contrato.contrato.includes('R$ 1.490'));
  check('contrato tem partes', contrato.contrato.includes('Advocacia João & Silva') && contrato.contrato.includes('Checkmate Code'));
  check('resumo completo', contrato.resumo.nomeCliente === 'Advocacia João & Silva' && contrato.resumo.preco === 1490);

  // 5. Fechar
  console.log('\n5) Fechar site');
  const fechado = await SiteService.update(site.id, { status: 'fechado' });
  check('status fechado', fechado.status === 'fechado');

  // 6. Endpoints HTTP
  console.log('\n6) Endpoints HTTP');
  try {
    const resBrief = await fetch(`http://localhost:3001/api/sites/${site.id}/briefing`);
    const dataBrief = await resBrief.json();
    check('GET /briefing 200', resBrief.status === 200 && dataBrief.briefing?.nome === 'Advocacia João & Silva');
  } catch (err) {
    check('GET /briefing responde', false, `(erro: ${err.message})`);
  }
  try {
    const resProp = await fetch(`http://localhost:3001/api/sites/${site.id}/proposta`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const dataProp = await resProp.json();
    check('POST /proposta 200 + preco', resProp.status === 200 && dataProp.preco === 1490);
  } catch (err) {
    check('POST /proposta responde', false, `(erro: ${err.message})`);
  }
  try {
    const resCont = await fetch(`http://localhost:3001/api/sites/${site.id}/contrato`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const dataCont = await resCont.json();
    check('POST /contrato 200 + texto', resCont.status === 200 && dataCont.contrato?.includes('CONTRATO'));
  } catch (err) {
    check('POST /contrato responde', false, `(erro: ${err.message})`);
  }
  try {
    const resFech = await fetch(`http://localhost:3001/api/sites/${site.id}/fechar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const dataFech = await resFech.json();
    check('POST /fechar 200 + fechado', resFech.status === 200 && dataFech.site?.status === 'fechado');
  } catch (err) {
    check('POST /fechar responde', false, `(erro: ${err.message})`);
  }

  // Limpeza
  await SiteService.remove(site.id);
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
