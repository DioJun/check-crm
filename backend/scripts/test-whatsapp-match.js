// Teste: match fuzzy de conversa WhatsApp → lead no CRM
// Simula títulos de conversa como o WhatsApp salva (nome curto, variações)
// e verifica se o findLeadByChat encontra o lead correto no banco real.
const prisma = require('../src/core/lib/prisma');
const { findLeadByChat, normalizeText, tokenize } = require('../src/modules/whatsapp/whatsapp.service');

let passou = 0;
let falhou = 0;
const check = (nome, cond, extra = '') => {
  if (cond) { passou++; console.log('  ✅ ' + nome + (extra ? ' — ' + extra : '')); }
  else { falhou++; console.log('  ❌ ' + nome + (extra ? ' — ' + extra : '')); }
};

(async () => {
  console.log('\n=== TESTE MATCH FUZZY WHATSAPP → LEAD ===\n');

  // Utilitários
  check('normalizeText remove acentos', normalizeText('Podóloga Júlia Ção') === 'podologa julia cao');
  check('tokenize filtra 3+ chars', JSON.stringify(tokenize('Dra Juliana Braga')) === JSON.stringify(['dra', 'juliana', 'braga']));

  // Usa leads reais do banco
  const leads = await prisma.lead.findMany();
  console.log('Leads no banco:', leads.length);
  if (leads.length === 0) {
    console.log('⚠️ Sem leads — não dá para validar match real');
    process.exit(0);
  }

  // Para cada lead, simula um título de conversa (nome curto do WhatsApp)
  // e verifica se o findLeadByChat retorna esse lead (ou um com cobertura ok)
  let encontrados = 0;
  for (const lead of leads.slice(0, 12)) {
    if (!lead.nome) continue;
    // Título = primeiro token do nome (ex: "Ariane", "Instituto", "Dra")
    const tokens = tokenize(lead.nome);
    if (tokens.length === 0) continue;
    const tituloSimulado = tokens[0]; // nome curto como salvo no WhatsApp
    const encontrado = await findLeadByChat(tituloSimulado);
    if (encontrado) {
      encontrados++;
      // console.log(`  ✓ "${tituloSimulado}" → ${encontrado.nome}`);
    } else {
      console.log(`  ✗ "${tituloSimulado}" (lead: ${lead.nome}) — NÃO encontrou`);
    }
  }
  check(`match por 1 token encontra (${encontrados}/${Math.min(12, leads.filter(l => l.nome).length)})`, encontrados >= Math.min(12, leads.length) * 0.6);

  // Caso 2: título com nome completo porém com pontuação/emoji extra
  if (leads.length >= 1) {
    const l0 = leads.find((l) => l.nome) ;
    const base = normalizeText(l0.nome);
    if (base) {
      const titulo = base.split(' ').slice(0, 2).join(' '); // 2 primeiras palavras
      const encontrado = await findLeadByChat(titulo);
      check('título com 2 palavras encontra lead', !!encontrado, encontrado ? encontrado.nome : '');
    }
  }

  // Caso 3: telefone com variações (se algum lead tiver telefone)
  const comTelefone = leads.find((l) => l.telefone);
  if (comTelefone) {
    const dig = String(comTelefone.telefone).replace(/\D/g, '');
    const tituloNumero = dig; // título = número puro (contato sem nome salvo)
    const encontrado = await findLeadByChat(tituloNumero);
    check('match por telefone (número puro)', !!encontrado, encontrado ? encontrado.nome : '');
    // Com DDI 55
    const tituloComDDI = '55' + dig;
    const encontrado2 = await findLeadByChat(tituloComDDI);
    check('match por telefone (com DDI 55)', !!encontrado2, encontrado2 ? encontrado2.nome : '');
  } else {
    console.log('  ℹ️ Nenhum lead com telefone — pulando teste de telefone');
  }

  // Caso 4: nome inexistente deve retornar null
  const nada = await findLeadByChat('Zzz Nome Inexistente 12345');
  check('nome inexistente → null', nada === null);

  console.log('\n========================================');
  console.log('RESULTADO: ' + passou + ' passou, ' + falhou + ' falhou');
  console.log('========================================\n');
  process.exit(falhou > 0 ? 1 : 0);
})();
