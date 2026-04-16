const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function analyzeLeadWithGemini(lead) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  // Formatar interações para o prompt
  const interacoesTexto = lead.interacoes && lead.interacoes.length > 0
    ? lead.interacoes.map((i) => `- ${new Date(i.data).toLocaleString('pt-BR')}: ${i.conteudo}`).join('\n')
    : 'Nenhuma interação registrada';

  const prompt = `Você é um consultor de vendas especializado em vender sites, sistemas web, CRMs e softwares para pequenas e médias empresas brasileiras.

Analise o lead abaixo e gere um relatório completo de estratégia de venda. Responda SOMENTE com um JSON válido, sem markdown, sem texto fora do JSON.

IMPORTANTE: Se não houver histórico de interações, sua estratégia deve focar em uma abordagem CONSULTIVA e NATURAL, baseada apenas nos dados do negócio. Não force vendas - sugira como iniciar uma conversa genuína de descoberta.

DADOS DO LEAD:
- Nome/Empresa: ${lead.nome || 'Não informado'}
- Telefone: ${lead.telefone || 'Não informado'}
- Cidade: ${lead.cidade || 'Não informada'}
- Ramo/Serviço: ${lead.servico || 'Não informado'}
- Tem WhatsApp: ${lead.temWhatsapp ? 'Sim' : 'Não'}
- Tem Site: ${lead.temSite ? 'Sim' : 'Não'}
- Site atual: ${lead.site || 'Não tem'}
- Avaliação Google: ${lead.avaliacao || 'Não informada'}
- Número de avaliações: ${lead.reviews || 'Não informado'}
- Origem: ${lead.origem || 'Não informada'}
- Status: ${lead.status || 'novo'}

HISTÓRICO DE INTERAÇÕES E ANOTAÇÕES:
${interacoesTexto}

Retorne este JSON exatamente (preencha todos os campos):
{
  "diagnostico": "Análise rápida do negócio, pontos fracos digitais e oportunidades identificadas (2-3 frases). Baseie-se nos dados disponíveis.",
  "servicoRecomendado": "Qual serviço poderia ser mais relevante para este tipo de negócio (ex: site profissional, sistema de agendamento, CRM, landing page, etc.) - enfoque em necessidade real, não em venda forçada",
  "proposta": "Como abordar este lead de forma consultiva: qual problema potencial você poderia ajudar a resolver, baseado no ramo e presença digital atual",
  "abordagem": "Estratégia de abordagem consultiva: como iniciar o contato de forma natural, o que perguntar primeiro para entender as necessidades reais dele, qual tom usar (profissional mas acessível)",
  "comoSerConvincente": "Não sobre argumentos de venda, mas sobre como demonstrar valor: quais insights você pode compartilhar sobre seu mercado/ramo, problemas comuns em empresas como a dele, histórias de sucesso relevantes",
  "pitchWhatsApp": "Mensagem CONSULTIVA para WhatsApp (máx 3 parágrafos, tom natural e amigável, pareça alguém do ramo conversando, personalize com nome/ramo, foque em CURIOSIDADE E VALOR, não em venda)",
  "pitchLigacao": "Script de abertura para ligação (primeiros 30 segundos, como se apresentar de forma natural, foco em entender o negócio dele antes de oferecer qualquer coisa)",
  "prioridade": "alta | media | baixa",
  "justificativaPrioridade": "Por que essa prioridade baseado no perfil e potencial do negócio (1-2 frases)"
}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip any markdown code fences if the model added them
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  return JSON.parse(cleaned);
}

module.exports = { analyzeLeadWithGemini };
