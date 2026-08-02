/**
 * Teste do Motor de Geração por IA (Passo 5)
 *
 * Verifica:
 *  1. parseJson (JSON válido, com markdown, com texto extra, inválido → null)
 *  2. sanitizeOverrides (remove HTML perigoso, valida tipos, limita arrays)
 *  3. buildPrompt monta contexto com dados do lead
 *  4. Fallback offline (sem chave) gera site com template padrão
 *  5. Fluxo real: render() com IA indisponível → html + usouIA=false
 *  6. Mock de IA: render() com chave fake → IA tenta e falha → fallback (usouIA=false)
 */
const prisma = require('../src/core/lib/prisma');
const SiteAIService = require('../src/modules/sites/site-ai.service');
const SiteService = require('../src/modules/sites/site.service');
const TemplatesService = require('../src/modules/sites/templates.service');

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
  console.log('\n=== TESTE MOTOR DE GERAÇÃO POR IA ===\n');

  // 1. parseJson
  console.log('1) parseJson');
  check('JSON puro', JSON.stringify(SiteAIService.parseJson('{"a":1}')) === '{"a":1}');
  check('JSON com markdown', JSON.stringify(SiteAIService.parseJson('```json\n{"a":1}\n```')) === '{"a":1}');
  check('JSON com texto extra', SiteAIService.parseJson('Aqui está: {"a":1} fim')?.a === 1);
  check('JSON inválido → null', SiteAIService.parseJson('não é json') === null);
  check('vazio → null', SiteAIService.parseJson('') === null);

  // 2. sanitizeOverrides
  console.log('\n2) sanitizeOverrides');
  const raw = {
    heroTitulo: 'Corte <b>top</b> <script>alert(1)</script>',
    heroSub: 123,
    servicos: [
      { icone: '✂️', nome: 'Corte', desc: 'Descrição <b>segura</b>', preco: 'R$ 45' },
      { icone: '🪒', nome: '', desc: '', preco: '' },
      'texto inválido',
      { icone: 'javascript:alert(1)', nome: 'Perigoso', desc: 'x', preco: 'y' },
    ],
    selos: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    depoimentos: [
      { texto: 'Ótimo!', autor: 'João S.' },
      { texto: '' },
      'inválido',
    ],
    waMensagem: 'Olá! <img onerror=alert(1)>',
  };
  const dados = TemplatesService.buildContext(
    { cor: '#000000', tom: 'moderno', nomeSite: 'Barbearia X' },
    { nome: 'Barbearia X', cidade: 'SP', telefone: '5511999999999' }
  );
  const safe = TemplatesService.sanitizeOverrides(raw, 'barbearia', dados);
  check('remove <script> do heroTitulo', !safe.heroTitulo.includes('<script') && safe.heroTitulo.includes('Corte'));
  check('heroSub numérico → fallback (omitido)', safe.heroSub === undefined);
  check('servicos: só 3 válidos', Array.isArray(safe.servicos) && safe.servicos.length === 3);
  check('servicos: nome vazio removido', safe.servicos.every((s) => s.nome));
  check('servicos: javascript: removido do icone', safe.servicos.every((s) => !s.icone.includes('javascript')));
  check('selos: limitado a 6', safe.selos.length === 6);
  check('depoimentos: só 1 válido', safe.depoimentos.length === 1);
  check('waMensagem: HTML removido', safe.waMensagem === 'Olá!');
  check('raw não-objeto → {}', JSON.stringify(TemplatesService.sanitizeOverrides(null)) === '{}');

  // 3. buildPrompt
  console.log('\n3) buildPrompt');
  const prompt = SiteAIService.buildPrompt('barbearia', 'Barbearia / Salão', 'Ramo: barbearia\nCidade: SP', 'Barbearia do João');
  check('prompt contém dados do lead', prompt.includes('Barbearia do João') && prompt.includes('barbearia'));
  check('prompt pede JSON com campos', prompt.includes('heroTitulo') && prompt.includes('waMensagem'));

  // 4. Fallback offline (sem chave de IA)
  console.log('\n4) Fallback offline');
  const chaveAntiga = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  process.env.AI_PROVIDER = 'deepseek';

  const lead = await prisma.lead.create({
    data: {
      nome: 'João Barbearia Teste',
      telefone: '5511999999999',
      servico: 'Corte de cabelo',
      cidade: 'São Paulo',
      instagram: '@joaobarba',
    },
  });
  const site = await SiteService.createQuick(lead.id, { template: 'barbearia', cor: '#e11d48' });

  const result = await SiteService.render(site.id);
  check('render retorna html', result.html.startsWith('<!DOCTYPE html>'));
  check('usouIA = false (fallback offline)', result.usouIA === false);
  check('aviso de fallback presente', typeof result.aviso === 'string' && result.aviso.length > 0);
  check('overrides vazio', JSON.stringify(result.overrides) === '{}');
  check('html sem placeholders', !result.html.includes('{{'));

  // 5. Mock de IA: chave fake → callAI tenta e falha → fallback
  console.log('\n5) IA com chave inválida');
  process.env.DEEPSEEK_API_KEY = 'sk-invalida-para-teste';
  const result2 = await SiteService.render(site.id);
  check('render com chave fake ainda retorna html', result2.html.startsWith('<!DOCTYPE html>'));
  check('usouIA = false (falha de API)', result2.usouIA === false);
  check('aviso presente', typeof result2.aviso === 'string');

  // 6. Testar generateOverrides direto (sem IA → null)
  console.log('\n6) generateOverrides sem IA');
  const semIa = await SiteAIService.generateOverrides(site, lead, null);
  check('generateOverrides retorna null sem IA', semIa === null);

  // 7. Testar gerar com IA real se houver chave válida
  console.log('\n7) generateSite (fallback)');
  const gerado = await SiteAIService.generateSite(site, lead, null);
  check('generateSite retorna html', gerado.html.startsWith('<!DOCTYPE html>'));
  check('generateSite usouIA boolean', typeof gerado.usouIA === 'boolean');

  // Limpeza
  process.env.DEEPSEEK_API_KEY = chaveAntiga;
  await SiteService.remove(site.id);
  await prisma.lead.delete({ where: { id: lead.id } });
  console.log('\n8) Dados de teste removidos');

  console.log(`\n========================================`);
  console.log(`RESULTADO: ${passou} passou, ${falhou} falhou`);
  console.log(`========================================\n`);

  if (falhou > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal no teste:', err);
  process.exit(1);
});
