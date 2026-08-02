/**
 * Configuração dos Thresholds de Alertas (Passo 8)
 *
 * Armazena os thresholds personalizáveis na tabela Configuracao (chave-valor).
 * Os valores salvos têm precedência sobre os defaults; o sistema sempre
 * carrega a config salva e mescla com os defaults (fallback seguro).
 *
 * ⚠️ Apenas configuração — nenhuma ação automática é gerada aqui.
 */

const prisma = require('../../core/lib/prisma');
const { DEFAULT_CONFIG } = require('./patterns.service');

const CHAVE_CONFIG = 'whatsapp:thresholds';

/**
 * Carrega a configuração salva (se existir) e mescla com os defaults.
 * Garante que campos novos dos defaults estejam sempre presentes.
 */
async function getConfig() {
  let salvo = {};
  try {
    const row = await prisma.configuracao.findUnique({ where: { chave: CHAVE_CONFIG } });
    if (row && row.valor) {
      salvo = JSON.parse(row.valor);
    }
  } catch (err) {
    console.error('[Config] Erro ao ler configuração salva:', err.message);
  }

  // Mescla profunda: defaults + salvos (defaults não sobrescrevem salvos)
  return {
    ...DEFAULT_CONFIG,
    ...salvo,
    inatividadeDias: {
      ...DEFAULT_CONFIG.inatividadeDias,
      ...(salvo.inatividadeDias || {}),
    },
  };
}

/**
 * Salva (ou atualiza) os thresholds personalizados.
 * @param {Object} changes - apenas os campos a alterar
 */
async function updateConfig(changes = {}) {
  const atual = await getConfig();

  // Mescla as mudanças sobre a config atual
  const nova = {
    ...atual,
    ...changes,
  };
  if (changes.inatividadeDias) {
    nova.inatividadeDias = {
      ...atual.inatividadeDias,
      ...changes.inatividadeDias,
    };
  }

  // Sanitiza: números para inteiros não-negativos
  const sanitized = sanitizeConfig(nova);

  await prisma.configuracao.upsert({
    where: { chave: CHAVE_CONFIG },
    update: { valor: JSON.stringify(sanitized) },
    create: { chave: CHAVE_CONFIG, valor: JSON.stringify(sanitized) },
  });

  return sanitized;
}

/** Garante que todos os valores sejam números inteiros não-negativos */
function sanitizeConfig(config) {
  const out = {};
  const numFields = ['propostaPendenteDias', 'respostaRapidaMin', 'mensagemCurtaLen', 'silencioDias', 'dedupHoras'];
  numFields.forEach((f) => {
    const v = parseInt(config[f], 10);
    out[f] = !isNaN(v) && v >= 0 ? v : DEFAULT_CONFIG[f];
  });

  out.inatividadeDias = {};
  Object.keys(DEFAULT_CONFIG.inatividadeDias).forEach((status) => {
    const v = parseInt(config.inatividadeDias?.[status], 10);
    out.inatividadeDias[status] = !isNaN(v) && v >= 0 ? v : DEFAULT_CONFIG.inatividadeDias[status];
  });

  return out;
}

/** Reseta para os defaults (remove o registro salvo) */
async function resetConfig() {
  await prisma.configuracao.deleteMany({ where: { chave: CHAVE_CONFIG } });
  return { ...DEFAULT_CONFIG, inatividadeDias: { ...DEFAULT_CONFIG.inatividadeDias } };
}

module.exports = { getConfig, updateConfig, resetConfig, CHAVE_CONFIG, sanitizeConfig };
