// Teste do motor de detecção de padrões com cenários simulados
const patterns = require('../src/modules/whatsapp/patterns.service');

async function main() {
  const lead = {
    id: 'teste-lead',
    nome: 'Padaria Estrela',
    status: 'interessado',
    ultimaInteracao: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000), // 9 dias atrás
    dataEntrada: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    aniversario: new Date(),
  };

  // CENÁRIO 1: urgência + follow-up prometido
  const conv1 = [
    { from: 'vendedor', text: 'Olá! Vi que sua padaria é muito bem avaliada no Google.', time: '10:00' },
    { from: 'lead', text: 'Obrigado! Estou vendo opções para melhorar meu site', time: '10:03' },
    { from: 'vendedor', text: 'Posso te mandar uma proposta.', time: '10:05' },
    { from: 'lead', text: 'Quanto custa? E tem desconto se fechar essa semana?', time: '10:08' },
    { from: 'vendedor', text: 'Deixa eu preparar tudo e te retorno na sexta com os valores.', time: '10:10' },
  ];

  const u1 = await patterns.detectUrgency(lead, conv1);
  const o1 = await patterns.detectOpportunity(lead, conv1, patterns.DEFAULT_CONFIG);
  console.log('--- CENÁRIO 1 (urgência + follow-up) ---');
  console.log('Urgência:', u1.map((a) => a.titulo).join(' | ') || 'nenhum');
  console.log('Oportunidade:', o1.map((a) => a.titulo).join(' | ') || 'nenhum');

  // CENÁRIO 2: risco (concorrente)
  const conv2 = [
    { from: 'lead', text: 'Olá, quero um site profissional para minha loja', time: '09:00' },
    { from: 'vendedor', text: 'Perfeito, posso te ajudar', time: '09:05' },
    { from: 'lead', text: 'Vi que você tem bons trabalhos, mas já fechei com outra empresa hoje.', time: '09:10' },
  ];
  const r2 = await patterns.detectRisk(lead, conv2);
  console.log('--- CENÁRIO 2 (risco - concorrente) ---');
  console.log('Risco:', r2.map((a) => `${a.titulo} [${a.prioridade}]`).join(' | ') || 'nenhum');

  // CENÁRIO 3: risco (desinteresse + tom curto)
  const conv3 = [
    { from: 'lead', text: 'Gostei muito da sua apresentação, quero saber todos os detalhes do sistema', time: '09:00' },
    { from: 'vendedor', text: 'Ótimo! Vou te explicar tudo', time: '09:05' },
    { from: 'lead', text: 'Quero também entender sobre o suporte e a garantia e os prazos de entrega', time: '09:08' },
    { from: 'vendedor', text: 'Claro, o suporte é 24h', time: '09:10' },
    { from: 'lead', text: 'ok', time: '09:11' },
    { from: 'vendedor', text: 'Posso preparar a proposta?', time: '09:12' },
    { from: 'lead', text: 'não', time: '09:13' },
  ];
  const r3 = await patterns.detectRisk(lead, conv3);
  console.log('--- CENÁRIO 3 (risco - tom curto) ---');
  console.log('Risco:', r3.map((a) => `${a.titulo} [${a.prioridade}]`).join(' | ') || 'nenhum');

  // CENÁRIO 4: padrão (melhor horário + velocidade)
  const conv4 = [
    { from: 'vendedor', text: 'Oi!', time: '09:00' },
    { from: 'lead', text: 'Oi, tudo bem?', time: '09:01' },
    { from: 'vendedor', text: 'Vi seu contato', time: '14:00' },
    { from: 'lead', text: 'Pode me ligar?', time: '14:02' },
    { from: 'vendedor', text: 'Claro', time: '14:03' },
    { from: 'lead', text: 'Qual horário é melhor para você?', time: '20:00' },
    { from: 'vendedor', text: 'Qualquer um', time: '20:01' },
  ];
  const p4 = await patterns.detectPattern(lead, conv4);
  console.log('--- CENÁRIO 4 (padrão) ---');
  console.log('Padrão:', p4.map((a) => `${a.titulo} [${a.prioridade}]`).join(' | ') || 'nenhum');

  // CENÁRIO 5: inatividade
  const i5 = await patterns.detectInactivity(lead, patterns.DEFAULT_CONFIG);
  console.log('--- CENÁRIO 5 (inatividade) ---');
  console.log('Inatividade:', i5.map((a) => `${a.titulo} [${a.prioridade}]`).join(' | ') || 'nenhum');
}

main().catch((e) => { console.error('ERRO:', e); process.exit(1); });
