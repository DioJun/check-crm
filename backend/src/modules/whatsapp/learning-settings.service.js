/**
 * Configuração das Camadas de Aprendizado (Passo 8)
 *
 * Controla quais camadas de aprendizado contínuo estão ativas.
 * O /analyze consulta estes toggles e só executa a camada se estiver habilitada.
 *
 * Camadas:
 *   - memoriaLead    (Camada 1) — perfil comportamental por lead
 *   - feedbackLoop   (Camada 2) — registrar sugestões/edições e auto-ajustar
 *   - rag            (Camada 3) — base de conhecimento (RAG)
 *   - analytics      (Camada 4) — insights globais
 *   - entreVendedores (Camada 5) — aprendizado entre vendedores
 */

const prisma = require('../../core/lib/prisma');

const SETTINGS_KEY = 'ai:learning-settings';

const DEFAULT_SETTINGS = {
  memoriaLead: true,
  feedbackLoop: true,
  rag: true,
  analytics: true,
  entreVendedores: true,
  anonimizarAnalytics: true, // dados anonimizados para analytics globais
  registrarConversas: true,  // global: registrar conversas p/ aprendizado (opt-out por conversa)
};

/** Lê as configurações das camadas (mescladas com defaults) */
async function getSettings() {
  try {
    const row = await prisma.configuracao.findUnique({ where: { chave: SETTINGS_KEY } });
    if (row && row.valor) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.valor) };
    }
  } catch (err) {
    console.error('[LearningSettings] Erro ao ler:', err.message);
  }
  return { ...DEFAULT_SETTINGS };
}

/** Salva as configurações das camadas */
async function updateSettings(changes = {}) {
  const atual = await getSettings();
  const nova = {
    ...atual,
    ...Object.fromEntries(
      Object.entries(changes).filter(([k]) => k in DEFAULT_SETTINGS)
    ),
  };

  await prisma.configuracao.upsert({
    where: { chave: SETTINGS_KEY },
    update: { valor: JSON.stringify(nova) },
    create: { chave: SETTINGS_KEY, valor: JSON.stringify(nova) },
  });

  return nova;
}

/** Reseta para os defaults */
async function resetSettings() {
  await prisma.configuracao.deleteMany({ where: { chave: SETTINGS_KEY } });
  return { ...DEFAULT_SETTINGS };
}

module.exports = { getSettings, updateSettings, resetSettings, DEFAULT_SETTINGS, SETTINGS_KEY };
