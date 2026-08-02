// Teste do motor de sugestão de ofertas com cenários simulados
const offerService = require('../src/modules/whatsapp/offer.service');

async function main() {
  console.log('--- Garantindo catálogo padrão ---');
  const catalog = await offerService.getCatalog();
  console.log(`Catálogo: ${catalog.length} produtos`);
  catalog.forEach((p) => console.log(`  - ${p.nome} (R$ ${p.preco}) tags=${p.tags}`));

  // CENÁRIO 1: lead quer organizar a equipe (deve bater com CRM)
  const conv1 = [
    { from: 'vendedor', text: 'Olá! Como posso ajudar?', time: '10:00' },
    { from: 'lead', text: 'Preciso organizar minha equipe de vendas, hoje uso planilha e perco muitos clientes', time: '10:05' },
  ];
  console.log('\n--- CENÁRIO 1 (organizar equipe/planilha → CRM) ---');
  const r1 = await offerService.suggestOffers(conv1, null);
  console.log('Interesses:', r1.interests.map((i) => i.label).join(', ') || 'nenhum');
  r1.ofertas.forEach((o) => console.log(`  Oferta: ${o.produto.nome} — ${o.motivo}`));

  // CENÁRIO 2: lead quer site e trafego
  const conv2 = [
    { from: 'lead', text: 'Quero criar um site pra minha loja e depois anunciar no instagram pra atrair clientes' },
  ];
  console.log('\n--- CENÁRIO 2 (site + instagram/anunciar → site + marketing) ---');
  const r2 = await offerService.suggestOffers(conv2, null);
  console.log('Interesses:', r2.interests.map((i) => i.label).join(', ') || 'nenhum');
  r2.ofertas.forEach((o) => console.log(`  Oferta: ${o.produto.nome} — ${o.motivo}`));

  // CENÁRIO 3: sem interesse claro (deve retornar vazio)
  const conv3 = [
    { from: 'lead', text: 'Obrigado, qualquer coisa eu te aviso' },
  ];
  console.log('\n--- CENÁRIO 3 (sem interesse) ---');
  const r3 = await offerService.suggestOffers(conv3, null);
  console.log('Interesses:', r3.interests.length, '| Ofertas:', r3.ofertas.length);

  // CENÁRIO 4: proposta formatada
  console.log('\n--- CENÁRIO 4 (exemplo de proposta gerada) ---');
  if (catalog.length) {
    const proposta = offerService.buildProposal(catalog[1], [{ label: 'CRM' }]);
    console.log(proposta);
  }
}

main().catch((e) => { console.error('ERRO:', e); process.exit(1); });
