const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Função para aguardar com delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeLeadWithGemini(lead, retryCount = 0, maxRetries = 5) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  // Formatar interações para o prompt
  const interacoesTexto = lead.interacoes && lead.interacoes.length > 0
    ? lead.interacoes.map((i) => `- ${new Date(i.data).toLocaleString('pt-BR')}: ${i.conteudo}`).join('\n')
    : 'Nenhuma interação registrada';

  const prompt = `Você é um consultor de vendas especializado em vender sites, sistemas web, CRMs e softwares para pequenas e médias empresas brasileiras.

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
    const errorMessage = err?.error?.message || `Gemini API error ${res.status}`;
    
    // Se for erro de alta demanda (429 ou mensagem específica), fazer retry
    if ((res.status === 429 || errorMessage.includes('high demand')) && retryCount < maxRetries) {
      // Backoff exponencial: 1s, 2s, 4s, 8s, 16s
      const delayMs = Math.pow(2, retryCount) * 1000;
      console.log(`[Gemini API] Alta demanda. Tentativa ${retryCount + 1}/${maxRetries}. Aguardando ${delayMs}ms...`);
      
      await sleep(delayMs);
      
      // Tentar novamente recursivamente
      return analyzeLeadWithGemini(lead, retryCount + 1, maxRetries);
    }
    
    throw new Error(errorMessage);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip any markdown code fences if the model added them
  let cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  // Tentar fazer parse do JSON limpo
  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    // Se falhar, tentar fix adicional: remover quebras de linha dentro de strings JSON
    // Esta é uma abordagem mais agressiva que trata caracteres problemáticos
    
    // Função auxiliar para escapar strings JSON
    const fixJsonString = (str) => {
      // Encontrar todas as strings entre aspas e escapar caracteres problemáticos
      return str.replace(/"([^"\\]|\\.)*"/g, (match) => {
        // Dentro das aspas, escapar quebras de linha e caracteres especiais
        return match
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/"/g, (m, i) => i === 0 || i === match.length - 1 ? m : '\\"');
      });
    };

    try {
      cleaned = fixJsonString(cleaned);
      return JSON.parse(cleaned);
    } catch (secondErr) {
      // Se ainda falhar, logar o erro e tentar usar regex para extrair os campos
      console.error(`[AI Analysis] JSON parsing failed: ${parseErr.message}`);
      console.error(`[AI Analysis] Raw response:`, raw.substring(0, 200) + '...');
      
      // Fallback: retornar um objeto padrão com mensagem de erro
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

  // Log sucesso se teve retries
  if (retryCount > 0) {
    console.log(`[Gemini API] Sucesso após ${retryCount} retry(ies)!`);
  }
}

module.exports = { analyzeLeadWithGemini };
