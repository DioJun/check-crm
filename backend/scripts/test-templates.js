/**
 * Teste do motor de Templates (Passo 4)
 *
 * Verifica:
 *  1. 7 templates definidos com metadados
 *  2. Renderização de cada template gera HTML válido
 *  3. Placeholders são preenchidos (nome, cor, telefone, cidade)
 *  4. Botão WhatsApp com telefone normalizado
 *  5. Cores: corClara/corEscura/sombra calculadas
 *  6. HTML salvo no SiteDemo (arquivosJson)
 *  7. Preview GET retorna o HTML
 */
const prisma = require('../src/core/lib/prisma');
const SiteService = require('../src/modules/sites/site.service');
const TemplatesService = require('../src/modules/sites/templates.service');
const { normalizeTelefone, slugify } = require('../src/modules/sites/site.util');

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
  console.log('\n=== TESTE TEMPLATES POR RAMO ===\n');

  // 1. Metadados
  console.log('1) Metadados dos templates');
  const meta = TemplatesService.getTemplatesMeta();
  check('7 templates com metadados', meta.length === 7, `(${meta.length})`);
  check('todos com label e icone', meta.every((m) => m.label && m.icone));
  const ids = meta.map((m) => m.id);
  ['barbearia', 'restaurante', 'advocacia', 'clinica', 'personal', 'loja', 'servico']
    .forEach((id) => check(`template '${id}' presente`, ids.includes(id)));

  // 2. Renderização de cada template
  console.log('\n2) Renderização de cada template');
  const leadMock = {
    nome: 'João Barbearia',
    telefone: '+55 (11) 99999-9999',
    cidade: 'São Paulo',
    instagram: '@joaobarba',
    servico: 'Corte de cabelo e barba',
  };

  for (const id of ids) {
    const site = { cor: '#2563eb', tom: 'moderno', nomeSite: 'Barbearia do João', ramo: 'Barbearia' };
    const { html, contexto } = TemplatesService.renderTemplate(id, site, leadMock);
    check(`${id}: HTML gerado (${(html.length / 1024).toFixed(1)}KB)`, html.startsWith('<!DOCTYPE html>') && html.length > 5000);
    check(`${id}: sem placeholders restantes`, !html.includes('{{'));
    check(`${id}: nome preenchido`, html.includes('Barbearia do João'));
    check(`${id}: cidade preenchida`, html.includes('São Paulo'));
    check(`${id}: cor aplicada`, html.includes('#2563eb'));
    check(`${id}: telefone wa.me normalizado`, html.includes('wa.me/5511999999999'));
  }

  // 3. Utilitários
  console.log('\n3) Utilitários');
  check('normalizeTelefone com DDI', normalizeTelefone('+55 11 99999-9999') === '5511999999999');
  check('normalizeTelefone sem DDI', normalizeTelefone('(11) 99999-9999') === '5511999999999');
  check('normalizeTelefone vazio', normalizeTelefone('') === '');
  check('slugify remove acentos', slugify('Barbearia do João') === 'barbearia-do-joao');

  // 4. Fluxo real: criar site + render + salvar + preview
  console.log('\n4) Fluxo real com banco');
  const lead = await prisma.lead.create({
    data: {
      nome: 'João Barbearia Teste',
      telefone: '5511999999999',
      servico: 'Corte de cabelo e barba',
      cidade: 'São Paulo',
      instagram: '@joaobarba',
    },
  });

  const site = await SiteService.createQuick(lead.id, { template: 'barbearia', cor: '#e11d48' });
  check('site criado', !!site.id && site.template === 'barbearia');

  const result = await SiteService.render(site.id);
  check('render retorna HTML', result.html.startsWith('<!DOCTYPE html>'));
  check('render retorna contexto', result.contexto && result.contexto.nomeSite === 'João');

  const salvo = await SiteService.getById(site.id);
  const arquivos = JSON.parse(salvo.arquivosJson || '{}');
  check('HTML salvo no arquivosJson', !!arquivos['index.html']);

  const htmlSalvo = await SiteService.getHtml(site.id);
  check('getHtml retorna HTML salvo', htmlSalvo === arquivos['index.html']);
  check('HTML salvo contém cor #e11d48', htmlSalvo.includes('#e11d48'));
  check('HTML salvo contém whatsapp do lead', htmlSalvo.includes('wa.me/5511999999999'));

  // 5. Preview via endpoint HTTP (requisição real)
  console.log('\n5) Preview via HTTP');
  try {
    const res = await fetch(`http://localhost:3001/api/sites/${site.id}/preview`);
    const text = await res.text();
    check(`preview HTTP 200 + HTML (${(text.length / 1024).toFixed(1)}KB)`, res.status === 200 && text.includes('<!DOCTYPE html>'));
  } catch (err) {
    check('preview HTTP', false, `(erro: ${err.message})`);
  }

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
