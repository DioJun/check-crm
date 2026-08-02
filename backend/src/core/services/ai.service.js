// ==================== CONFIGURAÇÃO DO PROVIDER DE IA ====================
// Por padrão usa DeepSeek. Defina AI_PROVIDER=gemini no .env para usar Gemini.
// DeepSeek usa API compatível com OpenAI.

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPrompt(lead) {
  const interacoesTexto = lead.interacoes && lead.interacoes.length > 0
    ? lead.interacoes.map((i) => `- ${new Date(i.data).toLocaleString('pt-BR')}: ${i.conteudo}`).join('\n')
    : 'Nenhuma interação registrada';

  return `Você é um consultor de vendas especializado em vender sites, sistemas web, CRMs e softwares para pequenas e médias empresas brasileiras.

SEUS SERVIÇOS:
- Criação de sites profissionais
- Marketing digital
- Gestão de tráfego
- Desenvolvimento de softwares
- Criação de CRM

SUA ABORDAGEM CONSULTIVA (use como referência de tom e estilo):
1. Comece identificando o problema real do lead baseado no ramo dele
2. Ofereça um exemplo concreto de como você resolveria (ex: "muita gente procura por X no Google")
3. Destaque os benefícios práticos (mais clientes, mais confiança, facilitar contato)
4. Ofereça valor ANTES de qualquer proposta (modelo, demonstração, consulta)
5. Seja natural, amigável e profissional - pareça alguém que entende do ramo dele
6. Evite linguagem corporativa - use tom de conversa genuína
7. Sempre termine com próximos passos claros e sem pressão

Analise o lead abaixo e gere um relatório completo de estratégia de venda. Responda SOMENTE com um JSON válido, sem markdown, sem texto fora do JSON.

IMPORTANTE: Se não houver histórico de interações, sua estratégia deve focar em uma abordagem CONSULTIVA e NATURAL. Não force vendas - sugira como iniciar uma conversa genuína de descoberta. Baseie as recomendações de serviço na lista acima.

DADOS DO LEAD:
- Nome/Empresa: ${lead.nome || 'Não informado'}
- Telefone: ${lead.telefone || 'Não informado'}
- Cidade: ${lead.cidade || 'Não informada'}
- Ramo/Serviço: ${lead.servico || 'Não informado'}
- Status: ${lead.status || 'novo'}
- Origem: ${lead.origem || 'Não informada'}
- Tem WhatsApp: ${lead.temWhatsapp ? 'Sim' : 'Não'}
- Tem Site: ${lead.temSite ? 'Sim' : 'Não'}
- Site atual: ${lead.site || 'Não tem'}
- Instagram: ${lead.instagram || 'Não informado'}
- Qualidade do Instagram: ${lead.instagramQuality || 'Não informada'}
- Reputação no Google Maps: ${lead.googleMapsRating || 'Não informada'}
- Avaliação Google: ${lead.avaliacao || 'Não informada'}
- Número de reviews: ${lead.reviews || 'Não informado'}
- Porte do negócio: ${lead.porte || 'Não informado'}
- Tempo de mercado: ${lead.tempoMercado || 'Não informado'}
- Já tem produto digital: ${lead.hasProduct ? 'Sim' : 'Não'}
- Anotações: ${lead.observacoes || 'Nenhuma anotação'}

HISTÓRICO DE INTERAÇÕES E ANOTAÇÕES:
${interacoesTexto}

Retorne este JSON exatamente (preencha todos os campos):
{
  "diagnostico": "Análise rápida do negócio, pontos fracos digitais e oportunidades identificadas (2-3 frases). Baseie-se nos dados disponíveis e no ramo dele.",
  "servicoRecomendado": "Qual(is) dos seus serviços seria mais relevante para este negócio (criação de site, marketing digital, gestão de tráfego, desenvolvimento de software ou CRM) - explique POR QUE seria útil para o ramo específico dele",
  "proposta": "Como abordar consultivamente: qual é o problema potencial que você poderia ajudar a resolver? (ex: falta de presença online, não aparece no Google, dificuldade em converter leads). Baseie-se no ramo e dados do lead.",
  "abordagem": "Passo a passo consultivo: como iniciar o contato de forma natural reconhecendo o ramo dele, qual pergunta fazer primeiro, que exemplo concreto usar para demonstrar valor, qual tom usar (amigável e profissional)",
  "comoSerConvincente": "Como demonstrar valor concretamente: quais resultados práticos você pode mostrar (mais clientes, mais visibilidade, melhor conversão), histórias de sucesso similares, insights específicos do ramo dele",
  "pitchWhatsApp": "Mensagem de primeiro contato para WhatsApp (3-5 frases, tom natural e consultivo, pareça alguém que conhece o ramo, identifique um problema real, ofereça um valor concreto sem pedir nada em troca no início, personalize completamente com nome e ramo)",
  "pitchLigacao": "Script de abertura para ligação (primeiros 30 segundos, como se apresentar de forma natural reconhecendo o negócio dele, foco em entender a situação atual dele antes de oferecer qualquer coisa, deixe claro que você só quer ajudar com informações úteis)",
  "prioridade": "alta | media | baixa",
  "justificativaPrioridade": "Por que essa prioridade (1-2 frases explicando potencial do negócio para seus serviços)"
}`;
}

function parseJsonResponse(raw) {
  let cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    const fixJsonString = (str) => {
      return str.replace(/"([^"\\]|\\.)*"/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/"/g, (m, i) => i === 0 || i === match.length - 1 ? m : '\\"');
      });
    };
    try {
      cleaned = fixJsonString(cleaned);
      return JSON.parse(cleaned);
    } catch (secondErr) {
      console.error(`[AI Analysis] JSON parsing failed: ${parseErr.message}`);
      return {
        diagnostico: 'Erro ao processar análise da IA. Tente novamente.',
        servicoRecomendado: 'Recomendação não disponível',
        proposta: 'Não foi possível gerar proposta',
        abordagem: 'Não foi possível gerar abordagem',
        comoSerConvincente: 'Não foi possível gerar argumentos',
        pitchWhatsApp: 'Não foi possível gerar pitch',
        pitchLigacao: 'Não foi possível gerar script',
        prioridade: 'media',
        justificativaPrioridade: 'Análise indisponível no momento'
      };
    }
  }
}

// ==================== DEEPSEEK (PADRÃO) ====================
async function analyzeLeadWithDeepSeek(lead, retryCount = 0, maxRetries = 5) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY não configurada');

  const prompt = buildPrompt(lead);

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'Você é um assistente especializado em análise de leads e vendas consultivas. Sempre responda APENAS com JSON válido, sem markdown.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2048,
  };

  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errorMessage = '';
    try {
      const errData = await res.json();
      errorMessage = errData?.error?.message || `DeepSeek API error ${res.status}`;
    } catch {
      errorMessage = `DeepSeek API error ${res.status}`;
    }
    console.log(`[DeepSeek API] Erro: ${errorMessage}`);

    if ((res.status === 429 || res.status === 502 || res.status === 503) && retryCount < maxRetries) {
      const delayMs = Math.pow(2, retryCount + 1) * 1000;
      console.log(`[DeepSeek] Tentativa ${retryCount + 1}/${maxRetries}. Aguardando ${delayMs / 1000}s...`);
      await sleep(delayMs);
      return analyzeLeadWithDeepSeek(lead, retryCount + 1, maxRetries);
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  return parseJsonResponse(raw);
}

// ==================== GEMINI (ALTERNATIVA) ====================
async function analyzeLeadWithGemini(lead, retryCount = 0, maxRetries = 10) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const prompt = buildPrompt(lead);

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
    let errorMessage = '';
    try {
      const errData = await res.json();
      errorMessage = errData?.error?.message || `Gemini API error ${res.status}`;
    } catch {
      errorMessage = `Gemini API error ${res.status}`;
    }
    console.log(`[Gemini API] Erro: ${errorMessage}`);

    const isHighDemandError = res.status === 429 ||
      errorMessage.toLowerCase().includes('high demand') ||
      errorMessage.toLowerCase().includes('resource exhausted') ||
      errorMessage.toLowerCase().includes('quota') ||
      res.status === 503 || res.status === 502;

    if (isHighDemandError && retryCount < maxRetries) {
      const delayMs = Math.pow(2, retryCount + 1) * 1000;
      console.log(`[Gemini] Tentativa ${retryCount + 1}/${maxRetries}. Aguardando ${delayMs / 1000}s...`);
      await sleep(delayMs);
      return analyzeLeadWithGemini(lead, retryCount + 1, maxRetries);
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseJsonResponse(raw);
}

// ==================== FUNÇÃO PRINCIPAL ====================
async function callAI(prompt, systemMessage) {
  const provider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
  console.log(`[AI] Usando provider: ${provider}`);

  if (provider === 'gemini') {
    // Para Gemini, usamos a função existente com o prompt diretamente
    // (adaptação: cria um mini-wrapper)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    };
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // DeepSeek (padrão)
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY não configurada');
  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemMessage || 'Você é um assistente especializado em vendas.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4096,
  };
  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = '';
    try { const e = await res.json(); msg = e?.error?.message || `DeepSeek API error ${res.status}`; }
    catch { msg = `DeepSeek API error ${res.status}`; }
    throw new Error(msg);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function analyzeLead(lead) {
  const provider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
  console.log(`[AI] Usando provider: ${provider}`);

  if (provider === 'gemini') {
    return analyzeLeadWithGemini(lead);
  }
  return analyzeLeadWithDeepSeek(lead);
}

// ==================== ASSISTENTE DE VENDAS ====================
// Analisa todo o histórico de interações e ajuda na tomada de decisões
async function assistLead(lead) {
  const interacoesTexto = lead.interacoes && lead.interacoes.length > 0
    ? lead.interacoes.map((i, idx) =>
        `[${idx + 1}] ${new Date(i.data).toLocaleString('pt-BR')} (${i.tipo}): ${i.conteudo}`
      ).join('\n')
    : 'Nenhuma interação registrada ainda.';

  const prompt = `Você é o melhor assistente de vendas do mundo, especialista em CRM e gestão de leads. 
Sua função é ANALISAR TODO O HISTÓRICO do lead e dar conselhos práticos e acionáveis para o vendedor.

## REGRAS DE OURO:
1. Seja EXTREMAMENTE prático e direto — o vendedor precisa de ação, não de teoria
2. Analise CADA interação individualmente e identifique padrões
3. Baseie suas recomendações SOMENTE nos dados reais do lead e histórico
4. Se não houver interações, foque em como iniciar o contato da melhor forma
5. Identifique objeções, interesses, hesitações no histórico
6. Sugira o PRÓXIMO PASSO ideal (momento, canal, mensagem)
7. Avalie o momento do lead na jornada de compra
8. Destaque oportunidades que o vendedor pode estar perdendo

## FORMATAÇÃO DA RESPOSTA:
Responda EXATAMENTE neste formato, sem markdown, sem texto extra:

🎯 **PRÓXIMO PASSO RECOMENDADO**
[Qual deve ser a PRÓXIMA ação do vendedor - seja específico: "Ligue amanhã às 10h", "Envie WhatsApp sobre X", "Aguardar resposta", etc]

📊 **ANÁLISE DO MOMENTO**
[Como está o envolvimento do lead? Está quente, morno ou frio? O que o histórico indica?]

💡 **OPORTUNIDADES IDENTIFICADAS**
[O que o vendedor pode estar perdendo? Algum interesse não explorado? Alguma objeção que precisa ser endereçada?]

📝 **SUGESTÃO DE ABORDAGEM**
[Texto/script SUGERIDO para o próximo contato - personalizado com base no histórico, tom natural e consultivo]

⏰ **TIMING RECOMENDADO**
[Quando fazer o próximo contato? Imediatamente, em X dias, aguardar lead tomar ação?]

⚡ **DICA RÁPIDA**
[Uma dica de ouro específica para este lead]

DADOS DO LEAD:
- Nome: ${lead.nome || 'Não informado'}
- Telefone: ${lead.telefone || 'Não informado'}
- Cidade: ${lead.cidade || 'Não informada'}
- Serviço/Ramo: ${lead.servico || 'Não informado'}
- Status: ${lead.status || 'novo'}
- Origem: ${lead.origem || 'Não informada'}
- Tem WhatsApp: ${lead.temWhatsapp ? 'Sim' : 'Não'}
- Tem Site: ${lead.temSite ? 'Sim' : 'Não'}
- Site: ${lead.site || 'Não tem'}
- Instagram: ${lead.instagram || 'Não informado'}
- Instagram Qualidade: ${lead.instagramQuality || 'Não informada'}
- Google Maps: ${lead.googleMapsRating || 'Não informada'}
- Porte: ${lead.porte || 'Não informado'}
- Tempo Mercado: ${lead.tempoMercado || 'Não informado'}
- Produto Digital: ${lead.hasProduct ? 'Sim' : 'Não'}
- Anotações: ${lead.observacoes || 'Nenhuma'}

HISTÓRICO COMPLETO DE INTERAÇÕES:
${interacoesTexto}`;

  const systemMessage = `Você é o melhor assistente de vendas do mundo. 
Suas características:
- Analisa profundamente o histórico de interações com o lead
- Dá conselhos práticos, específicos e acionáveis
- Nunca é genérico — sempre baseado nos dados reais
- Foco em ajudar o vendedor a tomar a MELHOR decisão
- Identifica oportunidades, riscos e o timing ideal
- Sugere scripts e abordagens personalizadas
- É direto, honesto e extremamente útil
- Pensa como um vendedor top 1% que já fechou milhares de negócios`;

  const raw = await callAI(prompt, systemMessage);
  return raw;
}

// ==================== ASSISTENTE DE WHATSAPP ====================
// Analisa a conversa do WhatsApp em tempo real, classifica o lead,
// sugere uma resposta e recomenda atualizações do perfil no CRM.
// ⚠️ NUNCA envia mensagens — apenas analisa e sugere.
async function suggestResponse(chatName, messages, options = {}) {
  const conversaTexto = messages && messages.length > 0
    ? messages.map((m) => `[${m.from === 'lead' ? 'LEAD' : 'VENDEDOR'}]${m.time ? ` (${m.time})` : ''}: ${m.text}`).join('\n')
    : 'Conversa ainda vazia ou sem mensagens legíveis.';

  // CAMADA 1 — Injetar perfil comportamental do lead (se disponível)
  const perfilSection = options.profileSection || '';
  // CAMADA 2 — Injetar preferências aprendidas do vendedor (se disponível)
  const paramsSection = options.paramsSection || '';
  // CAMADA 3 — Injetar contexto da base de conhecimento (RAG)
  const ragSection = options.ragSection || '';
  // CAMADA 4 — Injetar insights globais (se disponíveis)
  const insightsSection = options.insightsSection || '';

  const prompt = `Você é o melhor assistente de vendas do WhatsApp do mundo, especialista em conversas de vendas consultivas.

## SEU TRABALHO (apenas analisar e sugerir — VOCÊ NÃO ENVIA MENSAGENS):
Você ajuda um VENDEDOR que está fazendo PROSPECÇÃO ATIVA: ele vai ATÉ o lead (dono de pequeno negócio) para oferecer OS SERVIÇOS DELE. Os serviços do vendedor incluem: criação de site profissional, marketing digital, gestão de tráfego, desenvolvimento de software e CRM. O vendedor pode estar conversando com um lead que ainda não conhece os serviços — cabe a ele apresentar valor de forma consultiva e natural.

Analise a conversa abaixo com o lead "${chatName}" e gere:
1. CLASSIFICAÇÃO do lead no momento (interessado, frio, objeção, pronto para fechar ou neutro)
2. UMA SUGESTÃO de resposta (que o VENDEDOR vai copiar e colar/enviar manualmente)
3. RECOMENDAÇÃO de atualização do perfil no CRM (a ser aplicada automaticamente)
4. RESUMO curto da conversa para o histórico do CRM

${perfilSection ? `## MEMÓRIA DO LEAD (use para personalizar)\n${perfilSection}\n` : ''}
${paramsSection ? `${paramsSection}\n` : ''}
${ragSection ? `${ragSection}\n` : ''}
${insightsSection ? `${insightsSection}\n` : ''}
## REGRAS:
- A sugestão deve ser natural, consultiva, amigável e profissional (tom de conversa real)
- LEMBRE-SE: o vendedor PROCUROU este lead para oferecer os serviços dele. A sugestão deve avançar a conversa nesse sentido — apresentando valor, criando conexão com o negócio do lead e conduzindo para uma oferta relevante (site, marketing, tráfego, software ou CRM) de forma natural, sem pressão
- Se o lead fez uma pergunta, responda de forma clara e útil
- Identifique objeções e enderece-as com empatia
- NUNCA pressione para vender — foco em entender, ajudar e SEMEAR o interesse pelos serviços
- Responda SOMENTE com JSON válido, sem markdown, sem texto extra

CONVERSA ATUAL:
${conversaTexto}

Retorne EXATAMENTE este JSON:
{
  "classificacao": "interessado | frio | objecao | pronto_fechar | neutro",
  "sentimento": "positivo | neutro | negativo",
  "sugestao": "A sugestão de resposta que o vendedor deve enviar (3-6 frases, personalizada para esta conversa, pronta para copiar)",
  "resumoConversa": "Resumo curto (1-2 frases) da conversa para o histórico do CRM",
  "atualizacaoLead": {
    "status": "status sugerido (novo | contatado | interessado | fechado | sem_contato) — escolha o que fizer mais sentido, ou null para não mudar",
    "observacoes": "Nova observação/anotação a acrescentar (baseada no que o lead disse), ou null",
    "interesse": "nota curta sobre o nível de interesse detectado, ou null"
  }
}`;

  const systemMessage = `Você é o assistente de vendas do WhatsApp de uma plataforma de CRM.
- Analisa conversas reais do WhatsApp e gera sugestões de resposta
- Classifica leads com precisão (interessado, frio, objeção, pronto para fechar, neutro)
- NUNCA envia mensagens automaticamente — apenas sugere para o vendedor
- Gera JSON estruturado para atualizar o CRM automaticamente
- Escreve em português brasileiro natural e consultivo`;

  const raw = await callAI(prompt, systemMessage);

  // Tentar parse do JSON
  try {
    const parsed = JSON.parse(
      raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    );
    return parsed;
  } catch (err) {
    // Se a IA retornou texto livre em vez de JSON, retornar fallback
    return {
      classificacao: 'neutro',
      sentimento: 'neutro',
      sugestao: raw,
      resumoConversa: `Conversa com ${chatName} analisada pelo assistente.`,
      atualizacaoLead: { status: null, observacoes: null, interesse: null },
    };
  }
}

module.exports = { analyzeLead, analyzeLeadWithGemini, analyzeLeadWithDeepSeek, assistLead, suggestResponse, callAI };
