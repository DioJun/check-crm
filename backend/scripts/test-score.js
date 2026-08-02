// Teste do Lead Score dinâmico com cenários simulados
const scoreService = require('../src/modules/whatsapp/score.service');

function show(label, lead, messages, interacoesCount = 0) {
  const r = scoreService.calculateScore({ lead, messages, interacoesCount });
  console.log(`--- ${label} ---`);
  console.log(`  Score: ${r.score}/100 (${r.label} / ${r.cor})`);
  console.log(`  Fatores: freq=${r.fatores.frequencia} vel=${r.fatores.velocidade} tam=${r.fatores.tamanho} kw=${r.fatores.keywords} hist=${r.fatores.historico} mult=${r.fatores.multiplicadorStage}`);
  console.log('');
}

// CENÁRIO 1: lead quente (responde rápido, mensagens longas, sinal de compra, interessado)
show('CENÁRIO 1: Lead QUENTE', { id: 'l1', status: 'interessado' }, [
  { from: 'vendedor', text: 'Olá! Como posso ajudar?', time: '10:00' },
  { from: 'lead', text: 'Oi! Preciso de um site profissional para minha loja de roupas, com loja virtual integrada', time: '10:02' },
  { from: 'vendedor', text: 'Perfeito! Tenho ótimas opções', time: '10:03' },
  { from: 'lead', text: 'Quanto custa? Preciso para o mês que vem, estou com pressa e quero fechar essa semana', time: '10:04' },
], 8);

// CENÁRIO 2: lead morno (responde devagar, mensagens curtas, sem sinal claro)
show('CENÁRIO 2: Lead MORNO', { id: 'l2', status: 'contatado' }, [
  { from: 'vendedor', text: 'Olá! Vi seu contato', time: '09:00' },
  { from: 'lead', text: 'oi', time: '11:30' },
  { from: 'vendedor', text: 'Posso te mostrar uma solução?', time: '11:31' },
  { from: 'lead', text: 'pode', time: '14:15' },
], 2);

// CENÁRIO 3: lead frio (desinteresse explícito)
show('CENÁRIO 3: Lead FRIO', { id: 'l3', status: 'sem_contato' }, [
  { from: 'vendedor', text: 'Olá! Tenho uma proposta', time: '09:00' },
  { from: 'lead', text: 'agora não, obrigado', time: '09:10' },
  { from: 'vendedor', text: 'Posso mandar mais detalhes?', time: '09:11' },
  { from: 'lead', text: 'não preciso mais', time: '09:20' },
], 1);

// CENÁRIO 4: lead fechado (stage multiplicador 1.2)
show('CENÁRIO 4: Lead FECHADO (multiplicador)', { id: 'l4', status: 'fechado' }, [
  { from: 'vendedor', text: 'Aqui está o contrato', time: '10:00' },
  { from: 'lead', text: 'Perfeito, vamos fechar! Quero contratar hoje mesmo', time: '10:05' },
], 12);
