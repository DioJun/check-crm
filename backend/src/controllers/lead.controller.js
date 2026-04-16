const leadService = require('../services/lead.service');
const { analyzeLeadWithGemini } = require('../services/ai.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAll(req, res) {
  try {
    const { status, cidade, servico } = req.query;
    const leads = await leadService.getAll({ status, cidade, servico });
    return res.json(leads);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getStats(req, res) {
  try {
    const stats = await leadService.getDashboardStats();
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getById(req, res) {
  try {
    const lead = await leadService.getById(req.params.id);
    return res.json(lead);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

async function create(req, res) {
  try {
    const lead = await leadService.create(req.body);
    return res.status(201).json(lead);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function update(req, res) {
  try {
    const lead = await leadService.update(req.params.id, req.body);
    return res.json(lead);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

async function deleteLead(req, res) {
  try {
    await leadService.delete(req.params.id);
    return res.status(204).send();
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

async function importLeads(req, res) {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: 'O campo "leads" deve ser um array' });
    }
    const result = await leadService.importLeads(leads);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function deleteMultiple(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'O campo "ids" deve ser um array não vazio' });
    }
    const result = await leadService.deleteMultiple(ids);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function analyzeWithAI(req, res) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { interacoes: { orderBy: { data: 'desc' } } },
    });
    
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const analysis = await analyzeLeadWithGemini(lead);

    // Formatar análise como texto para registrar na interação
    const analysisText = `[ANÁLISE IA] 
Diagnóstico: ${analysis.diagnostico}
Serviço Recomendado: ${analysis.servicoRecomendado}
Proposta: ${analysis.proposta}
Abordagem: ${analysis.abordagem}
Como Ser Convincente: ${analysis.comoSerConvincente}
Prioridade: ${analysis.prioridade} - ${analysis.justificativaPrioridade}`;

    // Registrar a análise como uma interação
    await prisma.interacao.create({
      data: {
        leadId: req.params.id,
        tipo: 'ia_analysis',
        conteudo: analysisText,
        data: new Date(),
      },
    });

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        aiAnalysis: JSON.stringify(analysis),
        aiAnalysisAt: new Date(),
      },
    });

    return res.json({ analysis, analyzedAt: updated.aiAnalysisAt });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getAll, getStats, getById, create, update, delete: deleteLead, importLeads, deleteMultiple, analyzeWithAI };
