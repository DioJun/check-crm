const prisma = require('../../core/lib/prisma');
const { onLeadCreated, onLeadUpdated, onLeadDeleted } = require('../../core/services/webhook.service');

/**
 * GET /api/v1/leads
 * Listar todos os leads com filtros opcionais
 */
const listLeads = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0, search } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { nome: { contains: search } },
        { telefone: { contains: search } },
        { cidade: { contains: search } }
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        take: Math.min(parseInt(limit), 100),
        skip: parseInt(offset),
        orderBy: { dataEntrada: 'desc' },
        select: {
          id: true,
          nome: true,
          telefone: true,
          cidade: true,
          servico: true,
          status: true,
          origem: true,
          dataEntrada: true,
          ultimaInteracao: true,
          avaliacao: true,
          temWhatsapp: true,
          site: true
        }
      }),
      prisma.lead.count({ where })
    ]);

    res.json({
      success: true,
      data: leads,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('[API] Error listing leads:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/v1/leads/:id
 * Obter um lead específico
 */
const getLead = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        interacoes: {
          orderBy: { data: 'desc' },
          take: 10
        }
      }
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    res.json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('[API] Error fetching lead:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/v1/leads
 * Criar novo lead
 */
const createLead = async (req, res) => {
  try {
    const { nome, telefone, cidade, servico, status = 'novo', origem = 'api' } = req.body;

    if (!nome) {
      return res.status(400).json({
        success: false,
        error: 'Field "nome" is required'
      });
    }

    const lead = await prisma.lead.create({
      data: {
        nome,
        telefone: telefone || null,
        cidade: cidade || null,
        servico: servico || null,
        status,
        origem
      }
    });

    // Trigger webhook asynchronously
    onLeadCreated(lead).catch(err => console.error('[Webhook Error]', err));

    res.status(201).json({
      success: true,
      data: lead
    });
  } catch (error) {
    console.error('[API] Error creating lead:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PATCH /api/v1/leads/:id
 * Atualizar um lead
 */
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};

    // Whitelist de campos atualizáveis
    const allowedFields = ['nome', 'telefone', 'cidade', 'servico', 'status', 'origem', 'avaliacao', 'temWhatsapp', 'temSite', 'site'];
    allowedFields.forEach(field => {
      if (field in req.body) {
        updateData[field] = req.body[field];
      }
    });

    // Atualizar última interação
    if (Object.keys(updateData).length > 0) {
      updateData.ultimaInteracao = new Date();
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData
    });

    // Trigger webhook asynchronously
    onLeadUpdated(lead).catch(err => console.error('[Webhook Error]', err));

    res.json({
      success: true,
      data: lead
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    console.error('[API] Error updating lead:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * DELETE /api/v1/leads/:id
 * Deletar um lead
 */
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.lead.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    console.error('[API] Error deleting lead:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  listLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead
};
