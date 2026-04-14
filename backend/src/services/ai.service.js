const fetch = require('node-fetch');

/**
 * Analisa um lead usando Google Gemini API (gratuito).
 * Gera uma análise personalizada para um desenvolvedor que oferece
 * softwares, CRMs e sites personalizados.
 */
async function analyzeLeadWithGemini(lead) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada. Acesse https://aistudio.google.com/app/apikey para obter uma chave gratuita.');
  }

  const prompt = buildPrompt(lead);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Erro na API Gemini (${response.status}): ${errBody}`);
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('A API Gemini não retornou uma resposta válida.');
  }

  return text.trim();
}

function buildPrompt(lead) {
  const hasSite = lead.temSite ? 'Sim' : 'Não';
  const hasWhatsapp = lead.temWhatsapp ? 'Sim' : 'Não';
  const rating = lead.avaliacao || 'Não informado';
  const status = lead.status || 'novo';

  return `Você é um assistente de desenvolvimento de negócios para um desenvolvedor freelancer brasileiro que cria softwares personalizados, CRMs e sites profissionais para pequenas e médias empresas.

Analise o seguinte lead potencial e forneça uma análise estratégica completa em português:

**Dados do Lead:**
- Nome/Empresa: ${lead.nome}
- Ramo/Serviço: ${lead.servico || 'Não informado'}
- Cidade: ${lead.cidade || 'Não informado'}
- Telefone: ${lead.telefone || 'Não informado'}
- Tem site: ${hasSite}${lead.site ? ` (${lead.site})` : ''}
- Tem WhatsApp: ${hasWhatsapp}
- Avaliação Google: ${rating}
- Status atual no CRM: ${status}

**Por favor, forneça:**

## 1. Diagnóstico Digital (2-3 linhas)
Qual o estado digital provável desta empresa com base nos dados acima?

## 2. Oportunidades Identificadas
Liste de 2 a 4 serviços específicos que você poderia oferecer para este cliente (ex: site profissional, sistema de agendamento, CRM personalizado, automação WhatsApp, catálogo digital, etc.) com uma justificativa curta para cada um.

## 3. Pitch Personalizado
Escreva uma mensagem direta para enviar por WhatsApp (máximo 5 linhas) apresentando seus serviços de forma personalizada para este ramo de negócio. Tom: profissional mas acessível.

## 4. Pontos de Dor Prováveis
Quais dificuldades este tipo de negócio provavelmente enfrenta que você poderia resolver?

## 5. Prioridade de Contato
**Pontuação: X/10** — Justifique brevemente por que este lead tem alta/média/baixa prioridade.`;
}

module.exports = { analyzeLeadWithGemini };
