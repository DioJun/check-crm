/**
 * Normaliza e valida telefones brasileiros
 */

function normalizarTelefone(telefone) {
  if (!telefone) return '';

  // Remove tudo que não é dígito
  const apenas_numeros = String(telefone).replace(/\D/g, '');

  if (!apenas_numeros) return '';

  // Se tiver 55 no início (internacional), remove
  let cleaned = apenas_numeros;
  if (cleaned.startsWith('55')) {
    cleaned = cleaned.slice(2);
  }

  // Deve ter 10 (fixo) ou 11 (celular) dígitos
  if (cleaned.length !== 10 && cleaned.length !== 11) {
    return '';
  }

  // Validação básica: DDD deve estar entre 11-99
  const ddd = cleaned.slice(0, 2);
  const ddd_num = parseInt(ddd);
  if (ddd_num < 11 || ddd_num > 99) {
    return '';
  }

  // Se for celular (9 dígitos) ou fixo (8 dígitos), valida o primeiro dígito pós-DDD
  const resto = cleaned.slice(2);
  if (resto.length === 9 && !['6', '7', '8', '9'].includes(resto[0])) {
    // Celular deve começar com 6-9
    return '';
  }

  // Retorna no formato internacional: +55XXXXXXXXXX
  return `+55${cleaned}`;
}

function formatarTelefone(telefone) {
  const normalizado = normalizarTelefone(telefone);
  if (!normalizado) return '';

  // Remove +55
  const sem_pais = normalizado.slice(3);

  if (sem_pais.length === 10) {
    // Fixo: (XX) XXXX-XXXX
    return `(${sem_pais.slice(0, 2)}) ${sem_pais.slice(2, 6)}-${sem_pais.slice(6)}`;
  }

  // Celular: (XX) XXXXX-XXXX
  return `(${sem_pais.slice(0, 2)}) ${sem_pais.slice(2, 7)}-${sem_pais.slice(7)}`;
}

module.exports = { normalizarTelefone, formatarTelefone };
