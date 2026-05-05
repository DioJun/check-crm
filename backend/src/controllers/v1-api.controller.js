const { PrismaClient } = require('@prisma/client');
const { onLeadCreated, onLeadUpdated, onLeadDeleted } = require('../services/webhook.service');
const prisma = new PrismaClient();

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
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        take: Math.min(parseInt(limit), 100),
        skip: parseInt(offset),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          status: true,
          source: true,
          value: true,
          createdAt: true,
          updatedAt: true
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
        interactions: {
          orderBy: { createdAt: 'desc' },
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
    const { name, email, phone, company, status = 'prospect', source, value } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Field "name" is required'
      });
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        status,
        source: source || 'api',
        value: value ? parseFloat(value) : null
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
    const allowedFields = ['name', 'email', 'phone', 'company', 'status', 'value'];
    allowedFields.forEach(field => {
      if (field in req.body) {
        updateData[field] = req.body[field];
      }
    });

    if (updateData.value) {
      updateData.value = parseFloat(updateData.value);
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData
    });

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
