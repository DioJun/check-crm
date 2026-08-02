/**
 * Closing Service — Fluxo de fechamento de venda do site (Passo 11)
 *
 * Quando o lead aprova a demonstração, o vendedor inicia o fechamento:
 *   1. BRIEFING — coleta os dados do site final (nome, seções, contatos, cor)
 *   2. PROPOSTA — usa o catálogo "Site Profissional" (reusa offer.service)
 *   3. CONTRATO — gera um contrato simples com escopo + valores
 *
 * Regra de ouro: a demo vende o produto final. O briefing captura o que
 * o lead quer no site DE VERDADE (que ele comprará).
 *
 * Os dados ficam no campo `briefing` do SiteDemo (JSON).
 */
const prisma = require('../../core/lib/prisma');
const OfferService = require('../whatsapp/offer.service');

// Campos do briefing do site final
const CAMPOS_BRIEFING = [
  'nome', 'descricao', 'servicos', 'telefone', 'instagram',
  'email', 'endereco', 'horario', 'observacoes',
];

/**
 * Retorna o briefing atual de um site (ou vazio).
 */
async function getBriefing(siteId) {
  const site = await prisma.siteDemo.findUnique({ where: { id: siteId } });
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }
  let briefing = {};
  if (site.briefing) {
    try { briefing = JSON.parse(site.briefing); } catch { briefing = {}; }
  }
  return briefing;
}

/**
 * Salva o briefing do site final (mesclando com o existente).
 */
async function saveBriefing(siteId, dados = {}) {
  const site = await prisma.siteDemo.findUnique({ where: { id: siteId } });
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }

  const atual = await getBriefing(siteId);
  // Sanitiza: só campos conhecidos
  const novo = {};
  for (const campo of CAMPOS_BRIEFING) {
    if (dados[campo] !== undefined && typeof dados[campo] === 'string') {
      novo[campo] = dados[campo].slice(0, 2000);
    }
  }

  const briefing = { ...atual, ...novo };
  await prisma.siteDemo.update({ where: { id: siteId }, data: { briefing: JSON.stringify(briefing) } });
  return briefing;
}

/**
 * Gera a proposta comercial reutilizando o catálogo.
 * Usa o produto "Site Profissional" do catálogo padrão (ou o primeiro produto de site).
 */
async function gerarProposta(siteId) {
  const site = await prisma.siteDemo.findUnique({
    where: { id: siteId },
    include: { lead: { select: { id: true, nome: true, telefone: true } } },
  });
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }
  const briefing = await getBriefing(siteId);

  // Buscar produto do catálogo (preferir "Site Profissional")
  const catalog = await OfferService.getCatalog();
  const produto = catalog.find((p) => p.nome.includes('Site'))
    || catalog.find((p) => (p.tags || '').includes('site'))
    || catalog[0];

  const preco = produto ? produto.preco : 1490;
  const condicoes = produto ? produto.condicoes : 'Em até 3x sem juros';

  const nomeCliente = briefing.nome || site.lead?.nome || 'Cliente';
  const nomeSiteFinal = briefing.nome || site.nomeSite || 'Site profissional';

  // Monta a proposta (texto pronto para WhatsApp/PDF)
  const proposta = `🏆 *PROPOSTA — ${nomeSiteFinal}*\n\n` +
    `Olá, ${nomeCliente.split(' ')[0]}! Com base na demonstração que você aprovou, montei a proposta do seu site:\n\n` +
    `✅ *O que inclui:*\n` +
    `• Site profissional moderno (como a demo que você viu)\n` +
    `• Otimizado para o Google (SEO)\n` +
    `• WhatsApp integrado\n` +
    `• Design responsivo (celular + computador)\n` +
    (briefing.servicos ? `• Seções: ${briefing.servicos}\n` : '') +
    `\n💲 *Investimento:* R$ ${preco.toLocaleString('pt-BR')}\n` +
    `⏳ *Condições:* ${condicoes}\n\n` +
    `📌 *Prazo de entrega:* 5 a 10 dias úteis\n\n` +
    `Posso confirmar para você? 😉`;

  return {
    produto: produto || null,
    preco,
    condicoes,
    nomeCliente,
    nomeSiteFinal,
    proposta,
    briefing,
  };
}

/**
 * Gera um contrato simples de prestação de serviço.
 * Retorna texto + JSON (para impressão ou envio).
 */
async function gerarContrato(siteId) {
  const site = await prisma.siteDemo.findUnique({
    where: { id: siteId },
    include: { lead: { select: { id: true, nome: true, telefone: true } } },
  });
  if (!site) {
    const err = new Error('Site não encontrado');
    err.status = 404;
    throw err;
  }
  const briefing = await getBriefing(siteId);
  const { preco, condicoes, nomeSiteFinal, nomeCliente } = await gerarProposta(siteId);

  const data = new Date().toLocaleDateString('pt-BR');
  const escopo = [
    'Criação de site profissional responsivo (celular e computador)',
    'Design personalizado com a identidade do negócio',
    briefing.servicos ? `Seções/páginas: ${briefing.servicos}` : 'Estrutura padrão: home, serviços, sobre e contato',
    'Integração com WhatsApp',
    'Otimização básica para mecanismos de busca (SEO)',
    'Publicação e configuração do domínio (se fornecido)',
  ].join('\n   • ');

  const contrato = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — DESENVOLVIMENTO DE SITE
====================================================

CONTRATANTE: ${nomeCliente}
CONTRATADA: Checkmate Code
DATA: ${data}

1. DO OBJETO
A CONTRATADA desenvolverá um site profissional para o CONTRATANTE, conforme briefing aprovado.

2. DO ESCOPO DO SERVIÇO
   • ${escopo}

3. DO VALOR E CONDIÇÕES
O valor total do serviço é de R$ ${preco.toLocaleString('pt-BR')} (${condicoes}).

4. DO PRAZO
O prazo de entrega é de 5 a 10 dias úteis após a confirmação e pagamento inicial.

5. DAS OBRIGAÇÕES
O CONTRATANTE deverá fornecer textos, fotos e informações necessárias para o desenvolvimento.
A CONTRATADA se compromete a entregar o site conforme o briefing aprovado.

6. DO REAJUSTE DE ESCOPO
Alterações de escopo após o início podem gerar valores adicionais, mediante acordo prévio.

7. FORO
Fica eleito o foro da comarca do CONTRATANTE para dirimir quaisquer controvérsias.

${nomeCliente}                          Checkmate Code
________________________________        ________________________________
Assinatura do CONTRATANTE              Assinatura da CONTRATADA
`;

  return { contrato, resumo: { nomeCliente, nomeSiteFinal, preco, condicoes, data, escopo } };
}

module.exports = {
  CAMPOS_BRIEFING,
  getBriefing,
  saveBriefing,
  gerarProposta,
  gerarContrato,
};
