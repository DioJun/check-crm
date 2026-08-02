/**
 * Controller do módulo Sites — endpoints de criação rápida
 */
const prisma = require('../../core/lib/prisma');
const SiteService = require('./site.service');
const DeployService = require('./deploy.service');
const GitHubService = require('./github.service');
const ClosingService = require('./closing.service');

class SitesController {
  /**
   * GET /api/sites/health
   */
  static health(req, res) {
    return res.json({ ok: true, message: 'Sites module loaded' });
  }

  /**
   * GET /api/sites/templates
   * Lista os templates/ramos disponíveis para o formulário.
   */
  static getTemplates(req, res) {
    return res.json({
      success: true,
      templates: Object.entries(SiteService.TEMPLATES).map(([id, t]) => ({ id, ...t })),
      tons: SiteService.TONS,
    });
  }

  /**
   * POST /api/sites
   * Cria um site de demonstração rapidamente para um lead.
   * body: { leadId, template?, cor?, tom?, nomeSite? }
   */
  static async create(req, res) {
    try {
      const { leadId, template, cor, tom, nomeSite } = req.body || {};
      if (!leadId) {
        return res.status(400).json({ success: false, error: 'leadId é obrigatório' });
      }
      const site = await SiteService.createQuick(leadId, { template, cor, tom, nomeSite });
      return res.status(201).json({ success: true, site });
    } catch (err) {
      console.error('❌ Erro ao criar site:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/sites
   * Lista os sites de demonstração (filtro: ?leadId=&status=&template=&busca=).
   */
  static async list(req, res) {
    try {
      const { leadId, status, template, busca } = req.query;
      const sites = await SiteService.list({ leadId, status, template, busca });
      return res.json({ success: true, sites, total: sites.length });
    } catch (err) {
      console.error('❌ Erro ao listar sites:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/sites/stats
   * Estatísticas da galeria (contagem por status, visitas recentes).
   */
  static async getStats(req, res) {
    try {
      const stats = await SiteService.getStats();
      return res.json({ success: true, ...stats });
    } catch (err) {
      console.error('❌ Erro ao buscar estatísticas:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sites/:id/visita
   * Registra uma visita ao site (tracking do beacon no site de demo).
   */
  static async registrarVisita(req, res) {
    try {
      const { id } = req.params;
      const { origem } = req.body || {};
      const site = await SiteService.registrarVisita(id, { origem });
      return res.json({ success: true, visualizacoes: site.visualizacoes, status: site.status, alertas: site.alertas || [] });
    } catch (err) {
      console.error('❌ Erro ao registrar visita:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sites/:id/aprovar
   * Marca o site como aprovado pelo lead → alerta de fechamento.
   */
  static async aprovarSite(req, res) {
    try {
      const { id } = req.params;
      const resultado = await SiteService.aprovarSite(id);
      return res.json({ success: true, ...resultado });
    } catch (err) {
      console.error('❌ Erro ao aprovar site:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sites/sem-acesso
   * Verifica sites enviados há 48h sem acesso → alertas de follow-up.
   */
  static async verificarSemAcesso(req, res) {
    try {
      const resultado = await SiteService.verificarSitesSemAcesso();
      return res.json({ success: true, ...resultado });
    } catch (err) {
      console.error('❌ Erro ao verificar sites sem acesso:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/sites/:id/briefing
   * Retorna o briefing atual do site (dados do site final).
   */
  static async getBriefing(req, res) {
    try {
      const { id } = req.params;
      const briefing = await ClosingService.getBriefing(id);
      return res.json({ success: true, briefing });
    } catch (err) {
      console.error('❌ Erro ao buscar briefing:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * PUT /api/sites/:id/briefing
   * Salva o briefing do site final.
   */
  static async saveBriefing(req, res) {
    try {
      const { id } = req.params;
      const briefing = await ClosingService.saveBriefing(id, req.body || {});
      return res.json({ success: true, briefing });
    } catch (err) {
      console.error('❌ Erro ao salvar briefing:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sites/:id/proposta
   * Gera a proposta comercial (reusa catálogo "Site Profissional").
   */
  static async gerarProposta(req, res) {
    try {
      const { id } = req.params;
      const resultado = await ClosingService.gerarProposta(id);
      return res.json({ success: true, ...resultado });
    } catch (err) {
      console.error('❌ Erro ao gerar proposta:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sites/:id/contrato
   * Gera o contrato simples de prestação de serviço.
   */
  static async gerarContrato(req, res) {
    try {
      const { id } = req.params;
      const resultado = await ClosingService.gerarContrato(id);
      return res.json({ success: true, ...resultado });
    } catch (err) {
      console.error('❌ Erro ao gerar contrato:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sites/:id/fechar
   * Marca o site como fechado (venda concluída).
   */
  static async fecharSite(req, res) {
    try {
      const { id } = req.params;
      const site = await SiteService.update(id, { status: 'fechado' });
      await prisma.siteDemo.update({ where: { id }, data: { fechadoEm: new Date() } });
      return res.json({ success: true, site });
    } catch (err) {
      console.error('❌ Erro ao fechar site:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/sites/:id
   * Detalhe de um site.
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const site = await SiteService.getById(id);
      if (!site) {
        return res.status(404).json({ success: false, error: 'Site não encontrado' });
      }
      return res.json({ success: true, site });
    } catch (err) {
      console.error('❌ Erro ao buscar site:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PUT /api/sites/:id
   * Atualiza cor/tom/template/nome/status do site.
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const site = await SiteService.update(id, req.body || {});
      return res.json({ success: true, site });
    } catch (err) {
      console.error('❌ Erro ao atualizar site:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/sites/:id
   * Remove um site de demonstração.
   */
  static async remove(req, res) {
    try {
      const { id } = req.params;
      await SiteService.remove(id);
      return res.json({ success: true, message: 'Site removido' });
    } catch (err) {
      console.error('❌ Erro ao remover site:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sites/:id/render
   * Renderiza o HTML do site (template + dados do lead + IA) e salva.
   * Se body contiver `overrides`, renderiza manualmente com o conteúdo editado.
   */
  static async render(req, res) {
    try {
      const { id } = req.params;
      const { overrides, usarIA } = req.body || {};
      const result = await SiteService.render(id, {
        usarIA: usarIA !== undefined ? !!usarIA : true,
        overrides: overrides || null,
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('❌ Erro ao renderizar site:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/sites/:id/conteudo
   * Retorna o conteúdo editável (overrides salvos + defaults) para o editor visual.
   */
  static async getConteudo(req, res) {
    try {
      const { id } = req.params;
      const resultado = await SiteService.getConteudo(id);
      return res.json({ success: true, ...resultado });
    } catch (err) {
      console.error('❌ Erro ao buscar conteúdo do site:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sites/:id/publicar
   * Publica o site no Vercel (deploy direto).
   * body opcional: { token, teamId } para configurar no primeiro deploy.
   */
  static async publicar(req, res) {
    try {
      const { id } = req.params;
      const { token, teamId } = req.body || {};
      const resultado = await SiteService.publicar(id, { token, teamId });
      return res.json({ success: true, ...resultado });
    } catch (err) {
      console.error('❌ Erro ao publicar site:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/sites/deploy/config
   * Retorna se o Vercel está configurado (sem expor o token).
   */
  static async getDeployConfig(req, res) {
    try {
      const config = await DeployService.getConfig();
      return res.json({
        success: true,
        configurado: !!config.token,
        teamId: config.teamId,
      });
    } catch (err) {
      console.error('❌ Erro ao ler config do Vercel:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PUT /api/sites/deploy/config
   * Salva token/teamId do Vercel.
   */
  static async saveDeployConfig(req, res) {
    try {
      const { token, teamId } = req.body || {};
      const config = await DeployService.saveConfig({ token, teamId });
      return res.json({ success: true, configurado: !!config.token });
    } catch (err) {
      console.error('❌ Erro ao salvar config do Vercel:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/sites/:id/github
   * Envia o código do site para o GitHub (backup/versionamento).
   * body opcional: { token, owner, repoNome }
   */
  static async enviarGitHub(req, res) {
    try {
      const { id } = req.params;
      const { token, owner, repoNome } = req.body || {};
      const resultado = await SiteService.enviarGitHub(id, { token, owner, repoNome });
      return res.json({ success: true, ...resultado });
    } catch (err) {
      console.error('❌ Erro ao enviar para GitHub:', err.message);
      return res.status(err.status || 500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/sites/github/config
   * Retorna se o GitHub está configurado (sem expor o token).
   */
  static async getGitHubConfig(req, res) {
    try {
      const config = await GitHubService.getConfig();
      return res.json({
        success: true,
        configurado: !!config.token,
        owner: config.owner,
      });
    } catch (err) {
      console.error('❌ Erro ao ler config do GitHub:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PUT /api/sites/github/config
   * Salva token/owner do GitHub.
   */
  static async saveGitHubConfig(req, res) {
    try {
      const { token, owner } = req.body || {};
      const config = await GitHubService.saveConfig({ token, owner });
      return res.json({ success: true, configurado: !!config.token });
    } catch (err) {
      console.error('❌ Erro ao salvar config do GitHub:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/sites/:id/preview
   * Retorna o HTML renderizado (para iframe de preview no editor).
   */
  static async preview(req, res) {
    try {
      const { id } = req.params;
      const html = await SiteService.getHtml(id);
      if (!html) {
        return res.status(404).json({ success: false, error: 'Site não encontrado' });
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      console.error('❌ Erro ao gerar preview:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = SitesController;
