const interactionService = require('../services/interaction.service');

async function getByLeadId(req, res) {
  try {
    const interactions = await interactionService.getByLeadId(req.params.leadId);
    return res.json(interactions);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function create(req, res) {
  try {
    const { tipo, conteudo } = req.body;
    const interaction = await interactionService.create(req.params.leadId, tipo, conteudo);
    return res.status(201).json(interaction);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getByLeadId, create };
