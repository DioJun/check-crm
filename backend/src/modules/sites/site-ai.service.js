/**
 * Site AI Service — Motor de geração por IA (Passo 5)
 *
 * Gera conteúdo personalizado para o site de demonstração usando a IA
 * (DeepSeek/Gemini via callAI), aplicando os overrides no template.
 *
 * FLUXO:
 *  1. Monta contexto com dados do lead + perfil IA (LeadIntelligence) + interesses
 *  2. Chama callAI pedindo JSON com os campos de conteúdo
 *  3. Faz parse + sanitiza (remove HTML perigoso)
 *  4. Aplica overrides no template via renderTemplate
 *  5. FALLBACK OFFLINE: se a IA falhar ou não houver chave, usa o template padrão
 *     (sempre gera algo — site de demo nunca fica em branco)
 */
const { callAI } = require('../../core/services/ai.service');
const TemplatesService = require('./templates.service');

// Campos que a IA deve preencher (validados no JSON)
const CAMPOS_CONTEUDO = [
  'heroTitulo', 'heroSub', 'heroCta',
  'servicosTitulo', 'servicosSub',
  'sobreTitulo', 'sobreTexto',
  'ctaTitulo', 'ctaTexto', 'ctaBotao',
  'waMensagem',
];

/**
 * Monta o contexto textual do lead para o prompt da IA.
 * `instrucoes` (campo de chat do vendedor) tem PRIORIDADE MÁXIMA.
 */
function buildLeadContext(site, lead, intelligence) {
  const partes = [];
  // Instruções diretas do vendedor — devem ser seguidas acima de tudo
  if (site.instrucoes && String(site.instrucoes).trim()) {
    partes.push('INSTRUÇÕES DO VENDEDOR (siga estritamente, é a prioridade máxima):\n' + String(site.instrucoes).trim());
  }
  partes.push(`Nome/Empresa: ${lead.nome || 'Não informado'}`);
  partes.push(`Ramo/Serviço: ${lead.servico || site.ramo || 'não informado'}`);
  partes.push(`Cidade: ${lead.cidade || 'não informada'}`);
  partes.push(`Instagram: ${lead.instagram || 'não informado'}`);
  partes.push(`Porte: ${lead.porte || 'não informado'}`);
  partes.push(`Tempo de mercado: ${lead.tempoMercado || 'não informado'}`);
  partes.push(`Anotações: ${lead.observacoes || 'nenhuma'}`);
  if (intelligence) {
    partes.push(`Perfil comportamental: tom preferido ${intelligence.preferredTone || 'formal'}, interessado em ${(intelligence.interestedProducts || '').replace(/[\[\]"]/g, '') || 'nada específico'}`);
  }
  if (site.briefing) {
    partes.push(`Briefing extra: ${site.briefing}`);
  }
  return partes.filter(Boolean).join('\n');
}

/**
 * Monta o prompt pedindo conteúdo personalizado em JSON.
 */
function buildPrompt(templateId, templateLabel, contextoLead, nomeSite) {
  return `Você é um copywriter especialista em sites de demonstração para pequenas empresas brasileiras.
Sua missão: gerar o CONTEÚDO de uma landing page de demonstração para o negócio abaixo.
O site será usado para impressionar o dono do negócio e convencê-lo a comprar um site profissional.

## REGRAS:
- Escreva em português brasileiro, tom profissional e acolhedor
- Use o ramo e os dados reais do negócio — NUNCA invente dados falsos (cidade, telefone, serviços irreais)
- Se não souber algo, use um placeholder genérico e coerente com o ramo
- Os textos devem ser curtos e impactantes (landing page, não catálogo)
- Para "servicos", gere de 3 a 4 serviços realistas para o ramo (nome, descrição curta, preço opcional em R$)
- Para "depoimentos", invente 2 depoimentos fictícios PLÁUSIVEIS de clientes (sem sobrenomes reais)
- A mensagem WhatsApp (waMensagem) deve ser natural, de quem visitou o site
- Responda APENAS com JSON válido, sem markdown, sem texto extra

## ⚠️ PRIORIDADE MÁXIMA:
Se houver "INSTRUÇÕES DO VENDEDOR" nos dados do negócio, SIGA-AS ESTRIITAMENTE — elas têm prioridade sobre qualquer outro dado. Elas indicam o que o vendedor quer exatamente no site (seções, serviços, textos, tom). Personalize todos os campos do JSON de acordo com elas.

## DADOS DO NEGÓCIO:
${contextoLead}

## NOME DO SITE: ${nomeSite}

## TEMPLATE: ${templateLabel} (${templateId})

Retorne EXATAMENTE este JSON:
{
  "heroTitulo": "Título do hero com a marca do negócio (pode incluir <em> no nome) — 5-9 palavras",
  "heroSub": "Subtítulo curto com o serviço e a cidade — 1 frase",
  "heroCta": "Texto do botão principal do hero",
  "servicosTitulo": "Título da seção de serviços",
  "servicosSub": "Subtítulo da seção de serviços",
  "servicos": [
    { "icone": "emoji", "nome": "Serviço 1", "desc": "descrição curta", "preco": "R$ XX ou vazio" },
    { "icone": "emoji", "nome": "Serviço 2", "desc": "descrição curta", "preco": "R$ XX ou vazio" },
    { "icone": "emoji", "nome": "Serviço 3", "desc": "descrição curta", "preco": "R$ XX ou vazio" }
  ],
  "sobreTitulo": "Título da seção sobre",
  "sobreTexto": "2-3 frases sobre o negócio com a cidade",
  "selos": ["selo 1", "selo 2", "selo 3"],
  "depoimentos": [
    { "texto": "depoimento fictício", "autor": "Nome (inicial)" },
    { "texto": "depoimento fictício", "autor": "Nome (inicial)" }
  ],
  "ctaTitulo": "Título do CTA final",
  "ctaTexto": "Frase de CTA final",
  "ctaBotao": "Texto do botão CTA final",
  "waMensagem": "Mensagem que o visitante enviará pelo WhatsApp"
}`;
}

/**
 * Faz parse robusto do JSON retornado pela IA.
 */
function parseJson(raw) {
  if (!raw) return null;
  let cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Tentar extrair o primeiro bloco { ... } balanceado
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
    } catch { /* ignora */ }
    console.error('[Site AI] JSON parsing failed:', err.message);
    return null;
  }
}

/**
 * Gera o conteúdo do site com IA. Se falhar, retorna null (fallback offline).
 * @returns {Promise<object|null>} overrides sanitizados ou null
 */
async function generateOverrides(site, lead, intelligence) {
  const templateId = site.template || 'servico';
  const templateLabel = (TemplatesService.TEMPLATE_LABELS[templateId] || {}).label || 'Serviço geral';
  const nomeSite = site.nomeSite || (lead.nome ? lead.nome.split(' ')[0] : 'Seu Negócio');

  const contextoLead = buildLeadContext(site, lead, intelligence);
  const prompt = buildPrompt(templateId, templateLabel, contextoLead, nomeSite);

  const systemMessage = `Você é um copywriter especialista em landing pages de demonstração para pequenas empresas brasileiras.
Gera conteúdo em português brasileiro, profissional e acolhedor, baseado nos dados reais do negócio.
Sempre responde APENAS com JSON válido, sem markdown.`;

  try {
    const raw = await callAI(prompt, systemMessage);
    const parsed = parseJson(raw);
    if (!parsed) return null;

    // Sanitiza (remove HTML perigoso, valida tipos) e aplica fallbacks dos defaults
    const dados = TemplatesService.buildContext(site, lead);
    const overrides = TemplatesService.sanitizeOverrides(parsed, templateId, dados);

    // Garante campos-chave (se a IA não trouxe, mantém os defaults do template)
    const base = TemplatesService.renderTemplate(templateId, site, lead);
    // Merge: overrides só sobrescrevem o que a IA trouxe de fato
    return {
      overrides,
      conteudoBruto: parsed,
      usouIA: Object.keys(overrides).length > 0,
      baseHtml: base.html,
    };
  } catch (err) {
    console.log('[Site AI] IA indisponível, usando template padrão:', err.message);
    return null;
  }
}

/**
 * Gera o site completo (IA + template) ou fallback offline.
 * @returns {{ html, overrides, usouIA, contexto }}
 */
async function generateSite(site, lead, intelligence) {
  const templateId = site.template || 'servico';

  // Tenta gerar com IA
  const result = await generateOverrides(site, lead, intelligence);

  if (result && result.overrides) {
    // Aplica overrides da IA no template
    const dados = TemplatesService.buildContext(site, lead);
    const html = TemplatesService.renderTemplate(templateId, site, lead, result.overrides).html;
    return {
      html,
      overrides: result.overrides,
      usouIA: true,
      contexto: dados,
      aviso: null,
    };
  }

  // Fallback offline: template padrão preenchido com dados do lead
  const dados = TemplatesService.buildContext(site, lead);
  const { html } = TemplatesService.renderTemplate(templateId, site, lead);
  return {
    html,
    overrides: {},
    usouIA: false,
    contexto: dados,
    aviso: 'IA indisponível — site gerado com o template padrão e dados do lead.',
  };
}

module.exports = {
  generateSite,
  generateOverrides,
  buildLeadContext,
  buildPrompt,
  parseJson,
};
