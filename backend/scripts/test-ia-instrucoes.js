// Teste real: IA segue as instruções do campo de chat na geração do site
// Cria site com instrucoes -> render com IA -> verifica se o HTML reflete as instruções
const prisma = require('../src/core/lib/prisma');

let passou = 0;
let falhou = 0;
const check = (nome, cond) => {
  if (cond) { passou++; console.log('  ✅ ' + nome); }
  else { falhou++; console.log('  ❌ ' + nome); }
};

(async () => {
  console.log('\n=== TESTE IA SEGUE INSTRUÇÕES (GERAÇÃO REAL) ===\n');
  let siteId = null;
  try {
    const lead = await prisma.lead.findFirst();
    if (!lead) throw new Error('Nenhum lead no banco');

    // Cria site com instruções claras e distintas do ramo
    const site = await prisma.siteDemo.create({
      data: {
        leadId: lead.id,
        nomeSite: 'Instituto Teste IA',
        ramo: lead.servico || 'serviços',
        template: 'servico',
        status: 'gerado',
        cor: '#7c3aed',
        tom: 'acolhedor',
        instrucoes: 'QUERO o site com seção de AGENDAMENTO em destaque, com botão verde de WhatsApp, e um depoimento focado em ATENDIMENTO humanizado.',
      },
    });
    siteId = site.id;

    // Gera com IA
    const { generateSite } = require('../src/modules/sites/site-ai.service');
    console.log('Gerando com IA (DeepSeek)...');
    const gerado = await generateSite(site, lead, {});
    check('IA retornou html', !!gerado && !!gerado.html && gerado.html.length > 200);
    if (gerado && gerado.html) {
      const html = gerado.html.toLowerCase();
      check('menciona agendamento', html.includes('agendament') || html.includes('agendar'));
      check('menciona atendimento humanizado', html.includes('humanizad'));
      check('tem botão de whatsapp', html.includes('whatsapp') || html.includes('wa.me') || html.includes('api.whatsapp'));
    } else {
      console.log('  ⚠️ resposta da IA:', JSON.stringify(gerado).slice(0, 300));
    }
  } catch (e) {
    falhou++;
    console.log('  ❌ ERRO: ' + e.message);
  } finally {
    if (siteId) {
      try { await prisma.siteDemo.delete({ where: { id: siteId } }); } catch (e) {}
    }
  }

  console.log('\n========================================');
  console.log('RESULTADO: ' + passou + ' passou, ' + falhou + ' falhou');
  console.log('========================================\n');
  process.exit(falhou > 0 ? 1 : 0);
})();
