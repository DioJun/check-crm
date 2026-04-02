const interactionRepository = require('../repositories/interaction.repository');
const leadRepository = require('../repositories/lead.repository');

async function getByLeadId(leadId) {
  return interactionRepository.findByLeadId(leadId);
}

async function create(leadId, tipo, conteudo) {
  const interaction = await interactionRepository.create({ leadId, tipo, conteudo });
  await leadRepository.update(leadId, { ultimaInteracao: new Date() });
  return interaction;
}

module.exports = { getByLeadId, create };
