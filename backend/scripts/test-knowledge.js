// Teste da Camada 3 — Base de Conhecimento (RAG)
const prisma = require('../src/core/lib/prisma');
const knowledge = require('../src/modules/whatsapp/knowledge.service');

const CHECK = (cond, msg) => console.log(`${cond ? '✅' : '❌'} ${msg}`);

// Base simulada do negócio
const BASE = [
  {
    nome: 'Catálogo Sites',
    categoria: 'produto',
    conteudo: `Nossos sites profissionais custam R$ 1.490,00 e podem ser parcelados em até 3x sem juros.
    Incluem: design sob medida, otimização para Google, WhatsApp integrado e painel de edição.
    Prazo de entrega: 10 a 15 dias úteis. Garantia de 90 dias de ajustes.`,
  },
  {
    nome: 'Política de Desconto',
    categoria: 'preco',
    conteudo: `Desconto de 10% para fechamento na primeira conversa. Desconto de 5% para pagamento à vista.
    Pacotes anuais de manutenção recebem 1 mês grátis. Parcelamento em até 6x para valores acima de R$ 3.000.`,
  },
  {
    nome: 'FAQ — Site',
    categoria: 'faq',
    conteudo: `P: Quanto tempo leva para criar um site? R: Em média 10 a 15 dias úteis.
    P: Preciso ter domínio? R: Nós registramos o domínio para você (custo incluso).
    P: Consigo atualizar sozinho? R: Sim, o painel é intuitivo e oferecemos treinamento.`,
  },
  {
    nome: 'Case — Padaria Estrela',
    categoria: 'case',
    conteudo: `A Padaria Estrela contratou nosso site + gestão de tráfego e aumentou os pedidos de delivery em 40% em 3 meses.
    Investimento: R$ 1.490 no site + R$ 990/mês de tráfego. Retorno: mais de 80 novos clientes no primeiro trimestre.`,
  },
  {
    nome: 'Diferenciais vs Concorrência',
    categoria: 'concorrencia',
    conteudo: `Diferente de agências grandes, nosso atendimento é direto com quem desenvolve.
    Não cobramos taxa de setup escondida. Garantimos posicionamento no Google da sua cidade.
    Suporte por WhatsApp em até 1 hora em horário comercial.`,
  },
];

async function main() {
  console.log('--- 1. Adicionando base de conhecimento ---');
  const docs = [];
  for (const item of BASE) {
    const doc = await knowledge.addDocument(item);
    docs.push(doc);
    console.log(`  📄 ${doc.nome} (${doc.categoria}) — ${doc.chunkCount} chunks`);
  }
  CHECK(docs.length === BASE.length, 'Todos os documentos processados');

  const totalChunks = await prisma.knowledgeChunk.count();
  CHECK(totalChunks > 0, `Chunks criados no banco (${totalChunks})`);

  console.log('\n--- 2. Busca vetorial ---');
  // Busca 1: lead pergunta sobre preço de site
  const r1 = await knowledge.search('quanto custa para criar um site profissional');
  console.log(`  Q: "quanto custa para criar um site profissional"`);
  r1.forEach((r) => console.log(`    [${r.similarity}] ${r.fonte}: "${r.texto.substring(0, 60)}..."`));
  CHECK(r1.length > 0, 'Retornou resultados');
  CHECK(r1.some((r) => r.categoria === 'produto' || r.categoria === 'preco' || r.categoria === 'faq'), 'Resultados relevantes (produto/preço/faq)');

  // Busca 2: lead pergunta sobre desconto
  const r2 = await knowledge.search('tem desconto se eu fechar hoje parcelado');
  console.log(`  Q: "tem desconto se eu fechar hoje parcelado"`);
  r2.forEach((r) => console.log(`    [${r.similarity}] ${r.fonte}: "${r.texto.substring(0, 60)}..."`));
  CHECK(r2.length > 0, 'Retornou resultados');
  CHECK(r2[0].categoria === 'preco', 'Top resultado é a política de preço/desconto');

  // Busca 3: pergunta sobre prazo (deve achar FAQ)
  const r3 = await knowledge.search('em quanto tempo meu site fica pronto');
  console.log(`  Q: "em quanto tempo meu site fica pronto"`);
  r3.forEach((r) => console.log(`    [${r.similarity}] ${r.fonte}: "${r.texto.substring(0, 60)}..."`));
  CHECK(r3[0].categoria === 'faq', 'Top resultado é o FAQ (prazo de entrega)');

  console.log('\n--- 3. Seção RAG para o prompt ---');
  const { ragSection } = await knowledge.searchRagForPrompt('quanto custa um site e tem desconto?', { topK: 2 });
  console.log(ragSection.substring(0, 400) + '...');
  CHECK(ragSection.includes('BASE DE CONHECIMENTO'), 'Seção RAG gerada para o prompt');
  CHECK(ragSection.includes('Desconto'), 'Conteúdo de desconto presente na seção');

  console.log('\n--- 4. Reindex (reprocessar) ---');
  const re = await knowledge.reindexAll();
  CHECK(re.processados === docs.length, `Reindex processou ${re.processados} docs`);

  console.log('\n--- 5. Listagem com usos ---');
  const lista = await knowledge.listDocuments();
  const maisUsado = lista.sort((a, b) => b.usos - a.usos)[0];
  console.log(`  Doc mais consultado: ${maisUsado.nome} (${maisUsado.usos} usos)`);
  CHECK(maisUsado.usos > 0, 'Contador de usos incrementado');

  // Limpeza
  for (const doc of docs) {
    await knowledge.deleteDocument(doc.id).catch(() => {});
  }
  console.log('\n🧹 Base de teste removida');
}

main().catch((e) => { console.error('ERRO:', e); process.exit(1); }).finally(() => prisma.$disconnect());
