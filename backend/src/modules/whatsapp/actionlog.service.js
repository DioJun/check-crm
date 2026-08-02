/**
 * Registro de Ações do Vendedor — AlertaLog
 *
 * Persiste cada ação do vendedor sobre alertas, ofertas e scores
 * para alimentar o aprendizado futuro da IA:
 *   - "Vendedor ignorou alerta X"
 *   - "Vendedor usou sugestão Y"
 *   - "Vendedor silenciou alerta Z"
 *   - "Vendedor copiou proposta W"
 *
 * ⚠️ Apenas registra — nunca toma decisão pelo vendedor.
 */

const prisma = require('../../core/lib/prisma');

const ACOES_VALIDAS = ['visualizou', 'silenciou', 'resolveu', 'ignorou', 'usou', 'copiou'];

/**
 * Registra uma ação do vendedor.
 * @param {Object} params - { leadId, tipo, acao, alertaId?, detalhe? }
 */
async function logAction({ leadId, tipo = 'alerta', acao, alertaId = null, detalhe = null }) {
  if (!leadId) throw new Error('leadId é obrigatório');
  if (!ACOES_VALIDAS.includes(acao)) throw new Error(`Ação inválida: ${acao}`);

  return prisma.alertaLog.create({
    data: {
      leadId,
      tipo,
      acao,
      alertaId,
      detalhe: detalhe ? JSON.stringify(detalhe) : null,
    },
  });
}

/**
 * Registra visualização (chamado quando o painel analisa a conversa do lead).
 */
async function logVisualizacao(leadId, detalhe = null) {
  return logAction({ leadId, tipo: 'alerta', acao: 'visualizou', detalhe });
}

/**
 * Lista os logs de ações (com filtro por lead).
 */
async function listLogs({ leadId, limit = 50 } = {}) {
  const where = {};
  if (leadId) where.leadId = leadId;

  const logs = await prisma.alertaLog.findMany({
    where,
    include: { lead: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Desserializa o detalhe para facilitar o consumo no frontend
  return logs.map((log) => {
    let detalhe = null;
    try { detalhe = log.detalhe ? JSON.parse(log.detalhe) : null; } catch { detalhe = log.detalhe; }
    return { ...log, detalhe };
  });
}

/**
 * Estatísticas agregadas (para o painel de aprendizado).
 * Retorna contagem por tipo de ação e taxa de uso de ofertas.
 */
async function getStats() {
  const logs = await prisma.alertaLog.findMany();
  const porAcao = {};
  logs.forEach((l) => { porAcao[l.acao] = (porAcao[l.acao] || 0) + 1; });

  return {
    total: logs.length,
    porAcao,
    // taxa de aproveitamento de ofertas (copiou/usou vs total de ofertas sugeridas)
    ofertasSugeridas: await prisma.leadProduto.count({ where: { status: 'sugerido' } }),
    ofertasUsadas: await prisma.leadProduto.count({ where: { status: 'usou' } }),
    ofertasIgnoradas: await prisma.leadProduto.count({ where: { status: 'ignorou' } }),
  };
}

module.exports = { logAction, logVisualizacao, listLogs, getStats, ACOES_VALIDAS };
