/**
 * Site Alerts Service — Alertas de CRM para sites de demonstração (Passo 10)
 *
 * Reutiliza o motor de alertas do WhatsApp (modelo Alerta) para criar alertas
 * específicos do ciclo de venda de sites:
 *   - site_visualizado     → lead abriu o site de demo (melhor hora de follow-up)
 *   - site_3_acessos       → 3+ visitas em 24h (forte interesse)
 *   - site_48h_sem_acesso  → link enviado mas não abriu em 48h (abordar de outro jeito)
 *   - site_aprovado        → lead aprovou a demo (iniciar briefing/fechamento)
 *
 * Os alertas aparecem no mesmo painel dos alertas de relacionamento (AlertsSection),
 * pois usam o mesmo modelo Alerta + a mesma tabela.
 */
const prisma = require('../../core/lib/prisma');

// Tipos de alerta deste módulo
const TIPOS = {
  VISUALIZADO: 'site_visualizado',
  TRES_ACESSOS: 'site_3_acessos',
  SEM_ACESSO: 'site_48h_sem_acesso',
  APROVADO: 'site_aprovado',
};

// Janela para contar "3 acessos em 24h"
const JANELA_ACESSOS_HORAS = 24;
const LIMITE_ACESSOS = 3;
const SEM_ACESSO_HORAS = 48;

/**
 * Verifica se há alerta recente do mesmo tipo PARA O MESMO SITE (dedup).
 * O dedup é por site (não apenas por lead) — cada site de demonstração
 * tem seu próprio ciclo de alertas.
 */
async function hasRecent(tipo, leadId, siteId, horas = 24) {
  const since = new Date(Date.now() - horas * 60 * 60 * 1000);
  const existing = await prisma.alerta.findFirst({
    where: {
      leadId,
      tipo,
      status: 'ativo',
      createdAt: { gte: since },
      detalhe: { contains: siteId },
    },
  });
  return !!existing;
}

/**
 * Acionado ao registrar uma visita.
 * - Primeira visita de um site "enviado" → site_visualizado
 * - 3+ visitas em 24h → site_3_acessos
 */
async function processarVisita(site, origem = 'direto') {
  const alertasCriados = [];

  // 1. Primeira visualização real (status era enviado → agora visualizado)
  if (site.status === 'visualizado' && site.visualizacoes === 1) {
    const jaAlertou = await hasRecent(TIPOS.VISUALIZADO, site.leadId, site.id);
    if (!jaAlertou) {
      const alerta = await prisma.alerta.create({
        data: {
          leadId: site.leadId,
          tipo: TIPOS.VISUALIZADO,
          prioridade: 'alta',
          titulo: '👁️ Lead visualizou o site de demonstração',
          mensagem: `${site.lead?.nome || 'O lead'} abriu o site "${site.nomeSite}". Melhor hora para seguir no WhatsApp!`,
          detalhe: JSON.stringify({ siteId: site.id, nomeSite: site.nomeSite, link: site.link, origem }),
        },
      });
      alertasCriados.push(alerta);
    }
  }

  // 2. 3+ acessos em 24h (sinal de forte interesse)
  if (site.visualizacoes >= LIMITE_ACESSOS) {
    const acessos24h = await prisma.siteVisita.count({
      where: {
        siteDemoId: site.id,
        visitadoEm: { gte: new Date(Date.now() - JANELA_ACESSOS_HORAS * 60 * 60 * 1000) },
      },
    });
    if (acessos24h >= LIMITE_ACESSOS) {
      const jaAlertou = await hasRecent(TIPOS.TRES_ACESSOS, site.leadId, site.id);
      if (!jaAlertou) {
        const alerta = await prisma.alerta.create({
          data: {
            leadId: site.leadId,
            tipo: TIPOS.TRES_ACESSOS,
            prioridade: 'alta',
            titulo: '🔥 Lead acessou o site 3+ vezes em 24h',
            mensagem: `${site.lead?.nome || 'O lead'} visitou "${site.nomeSite}" ${site.visualizacoes} vezes (${acessos24h} nas últimas 24h). Interesse muito alto — ofereça o fechamento.`,
            detalhe: JSON.stringify({ siteId: site.id, nomeSite: site.nomeSite, total: site.visualizacoes, acessos24h }),
          },
        });
        alertasCriados.push(alerta);
      }
    }
  }

  return alertasCriados;
}

/**
 * Verifica sites "enviados" que não receberam acesso em 48h → alerta de follow-up.
 * Chamada periodicamente ou sob demanda (ex: ao abrir o dashboard/galeria).
 */
async function verificarSemAcesso() {
  const limite = new Date(Date.now() - SEM_ACESSO_HORAS * 60 * 60 * 1000);
  const sites = await prisma.siteDemo.findMany({
    where: {
      status: 'enviado',
      enviadoEm: { lte: limite },
    },
    include: { lead: { select: { id: true, nome: true } } },
  });

  const criados = [];
  for (const site of sites) {
    const jaAlertou = await hasRecent(TIPOS.SEM_ACESSO, site.leadId, site.id, 24 * 7);
    if (jaAlertou) continue;
    const alerta = await prisma.alerta.create({
      data: {
        leadId: site.leadId,
        tipo: TIPOS.SEM_ACESSO,
        prioridade: 'media',
        titulo: '⏰ Site enviado há 48h sem acesso',
        mensagem: `O link do site "${site.nomeSite}" foi enviado há 48h mas ${site.lead?.nome || 'o lead'} ainda não abriu. Tente abordar por outro canal.`,
        detalhe: JSON.stringify({ siteId: site.id, nomeSite: site.nomeSite, link: site.link }),
      },
    });
    criados.push(alerta);
  }
  return criados;
}

/**
 * Acionado quando o site é marcado como "aprovado" → alerta de iniciar fechamento.
 */
async function processarAprovacao(site) {
  const jaAlertou = await hasRecent(TIPOS.APROVADO, site.leadId, site.id, 24 * 7);
  if (jaAlertou) return null;

  return prisma.alerta.create({
    data: {
      leadId: site.leadId,
      tipo: TIPOS.APROVADO,
      prioridade: 'alta',
      titulo: '👍 Lead aprovou o site de demonstração',
      mensagem: `${site.lead?.nome || 'O lead'} aprovou "${site.nomeSite}". Inicie o briefing e prepare a proposta de fechamento!`,
      detalhe: JSON.stringify({ siteId: site.id, nomeSite: site.nomeSite, link: site.link }),
    },
  });
}

module.exports = {
  TIPOS,
  processarVisita,
  verificarSemAcesso,
  processarAprovacao,
  JANELA_ACESSOS_HORAS,
  LIMITE_ACESSOS,
  SEM_ACESSO_HORAS,
};
