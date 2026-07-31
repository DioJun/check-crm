/**
 * Registry de Módulos do Backend
 * 
 * Para adicionar um novo módulo:
 * 1. Crie uma pasta em `src/modules/<nome-do-modulo>/`
 * 2. Crie um arquivo `index.js` que exporte `{ name, label, description, icon, register(app) }`
 * 3. Adicione o módulo ao array MODULES abaixo
 * 
 * O `register(app)` recebe a instância do Express e registra suas rotas.
 */
const crmModule = require('../modules/crm');
const prospectionModule = require('../modules/prospection');
const whatsappModule = require('../modules/whatsapp');

// Lista central de módulos registrados
const MODULES = [
  crmModule,
  prospectionModule,
  whatsappModule,
];

/**
 * Registra todos os módulos no app Express.
 * Cada módulo é isolado — se um falhar, os demais continuam funcionando.
 */
function registerModules(app) {
  MODULES.forEach((mod) => {
    try {
      mod.register(app);
      console.log(`🔌 Módulo carregado: ${mod.name}`);
    } catch (err) {
      console.error(`❌ Falha ao carregar módulo [${mod.name}]:`, err.message);
    }
  });
}

module.exports = { MODULES, registerModules };
