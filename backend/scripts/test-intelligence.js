// Teste da Camada 1 — Memória individual por lead (perfil comportamental)
const prisma = require('../src/core/lib/prisma');
const intelligence = require('../src/modules/whatsapp/lead-intelligence.service');

const CHECK = (cond, msg) => console.log(`${cond ? '✅' : '❌'} ${msg}`);

async function main() {
  // Cria lead de teste
  const lead = await prisma.lead.create({
    data: {
      nome: 'Lead Perfil Teste',
      telefone: '+55 11 98888-7777',
      servico: 'Barbearia',
      status: 'interessado',
    },
  });
  console.log(`📌 Lead criado: ${lead.nome} (${lead.id})`);

  // Conversa simulada: tom informal + horário 15h + interesse em site + objeção preço
  const conversa = [
    { from: 'vendedor', text: 'Olá! Tudo bem?', time: '15:00' },
    { from: 'lead', text: 'Valeu! Blz sim. Quero um site massa pra minha barbearia', time: '15:02' },
    { from: 'vendedor', text: 'Posso te mandar uma proposta', time: '15:03' },
    { from: 'lead', text: 'Pode mandar, mas tô achando que vai ser caro', time: '15:05' },
    { from: 'vendedor', text: 'Temos opções para todos os bolsos', time: '15:06' },
    { from: 'lead', text: 'Boa, me manda aí então!', time: '15:07' },
  ];

  // 1) Atualizar perfil
  const perfil = await intelligence.updateIntelligence(lead, conversa, {
    resumoConversa: 'Lead quer site para barbearia, receoso com preço',
    resultado: 'pendente',
  });
  console.log('\n📊 Perfil gerado:');
  console.log('  Tom:', perfil.preferredTone);
  console.log('  Horário:', perfil.activeHours);
  console.log('  Tempo médio:', perfil.avgResponseTimeMin, 'min');
  console.log('  Objeções:', JSON.parse(perfil.objections));
  console.log('  Interesses:', JSON.parse(perfil.interestedProducts));

  CHECK(perfil.preferredTone === 'informal', `Tom informal detectado ("valeu/blz") → ${perfil.preferredTone}`);
  CHECK(perfil.activeHours.includes('15'), `Horário de atividade 15h → ${perfil.activeHours}`);
  CHECK(perfil.avgResponseTimeMin <= 5, `Tempo médio de resposta ~2-5 min → ${perfil.avgResponseTimeMin}`);
  CHECK(JSON.parse(perfil.objections).includes('preco'), 'Objeção de preço detectada');
  CHECK(JSON.parse(perfil.interestedProducts).includes('Site Profissional'), 'Interesse em Site detectado');

  // 2) Seção de perfil para injeção no prompt
  const section = intelligence.buildProfileSection(perfil);
  console.log('\n📝 Seção injetada no prompt da IA:');
  console.log(section);
  CHECK(section.includes('PERFIL COMPORTAMENTAL'), 'Seção de perfil gerada para o prompt');
  CHECK(section.includes('informal'), 'Tom presente na seção');

  // 3) Buscar perfil
  const buscado = await intelligence.getIntelligence(lead.id);
  CHECK(!!buscado, 'Perfil recuperado do banco');

  // 4) Refresh + build combinados
  const { intelligence: perfil2, profileSection } = await intelligence.refreshAndBuildProfile(
    lead, conversa, { resumoConversa: 'Nova conversa', resultado: 'positivo' }
  );
  CHECK(!!profileSection, 'refreshAndBuildProfile retorna seção pronta');
  const resumos = JSON.parse(perfil2.recentSummaries);
  CHECK(resumos.length >= 1, `Histórico de conversas mantido (${resumos.length})`);

  // Limpeza
  await prisma.lead.delete({ where: { id: lead.id } }).catch(() => {});
  console.log('\n🧹 Lead de teste removido (cascade apagou perfil)');
}

main().catch((e) => { console.error('ERRO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
