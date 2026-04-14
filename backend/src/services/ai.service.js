const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function analyzeLeadWithGemini(lead) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const prompt = `Você é um consultor de vendas especializado em vender sites, sistemas web, CRMs e softwares para pequenas e médias empresas brasileiras.

Analise o lead abaixo e gere um relatório completo de estratégia de venda. Responda SOMENTE com um JSON válido, sem markdown, sem texto fora do JSON.

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

Retorne este JSON exatamente (preencha todos os campos):
{
  "diagnostico": "Análise rápida do negócio, pontos fracos digitais e oportunidades identificadas (2-3 frases)",
  "servicoRecomendado": "Qual serviço oferecer primeiro e por quê (ex: site profissional, sistema de agendamento, CRM, landing page, etc.)",
  "proposta": "Proposta comercial concreta: o que entregar, benefícios diretos para o negócio dele, valor gerado (não mencione preço)",
  "abordagem": "Estratégia de abordagem passo a passo: como iniciar o contato, o que dizer primeiro, como criar rapport, qual tom usar",
  "comoSerConvincente": "Argumentos mais poderosos para essa empresa específica: dores que você resolve, resultados que pode mostrar, objeções comuns e como rebater",
  "pitchWhatsApp": "Mensagem pronta para enviar no WhatsApp (máx 3 parágrafos, tom amigável e profissional, sem parecer spam, personalize com o nome e ramo)",
  "pitchLigacao": "Script de abertura para ligação (primeiros 30 segundos, como se apresentar, como despertar interesse rápido)",
  "prioridade": "alta | media | baixa",
  "justificativaPrioridade": "Por que essa prioridade (1-2 frases)"
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
