// Teste dos thresholds configuráveis
const prisma = require('../src/core/lib/prisma');
const configService = require('../src/modules/whatsapp/config.service');

async function main() {
  console.log('--- 1. Config padrão (sem nada salvo) ---');
  let config = await configService.getConfig();
  console.log('inatividadeDias.novo =', config.inatividadeDias.novo);
  console.log('inatividadeDias.interessado =', config.inatividadeDias.interessado);
  console.log('propostaPendenteDias =', config.propostaPendenteDias);

  console.log('\n--- 2. Salvar personalizações ---');
  config = await configService.updateConfig({
    inatividadeDias: { novo: 5, interessado: 10 },
    propostaPendenteDias: 5,
    silencioDias: 14,
  });
  console.log('Atualizado: novo=', config.inatividadeDias.novo, 'interessado=', config.inatividadeDias.interessado, 'proposta=', config.propostaPendenteDias, 'silencio=', config.silencioDias);
  // Os demais devem permanecer defaults
  console.log('contatado (default preservado) =', config.inatividadeDias.contatado);
  console.log('respostaRapidaMin (default preservado) =', config.respostaRapidaMin);

  console.log('\n--- 3. Recarregar do banco (persistência) ---');
  config = await configService.getConfig();
  console.log('novo=', config.inatividadeDias.novo, 'interessado=', config.inatividadeDias.interessado, 'silencio=', config.silencioDias);

  console.log('\n--- 4. Sanitização (valores inválidos) ---');
  config = await configService.updateConfig({ propostaPendenteDias: -5, respostaRapidaMin: 'abc' });
  console.log('propostaPendenteDias (inválido -5 → default 3) =', config.propostaPendenteDias);
  console.log('respostaRapidaMin (inválido abc → default 5) =', config.respostaRapidaMin);

  console.log('\n--- 5. Reset para defaults ---');
  config = await configService.resetConfig();
  console.log('novo=', config.inatividadeDias.novo, 'interessado=', config.inatividadeDias.interessado, 'silencio=', config.silencioDias);
}

main()
  .catch((e) => { console.error('ERRO:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
