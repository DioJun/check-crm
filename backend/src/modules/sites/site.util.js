/**
 * Utilitários do módulo Sites
 */

/**
 * Normaliza um telefone para o formato internacional usado no wa.me.
 * Ex: "+55 11 99999-9999" → "5511999999999"
 */
function normalizeTelefone(telefone) {
  if (!telefone) return '';
  let digits = String(telefone).replace(/\D/g, '');
  // Se não tem DDI e começa com 0 (0XX), remove o 0
  if (digits.length >= 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  // Se não tem DDI (10 dígitos = DDD + número), adiciona 55
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  return digits;
}

/**
 * Slug básico para nomes de projeto (usado no deploy Vercel).
 * Ex: "Barbearia do João" → "barbearia-do-joao"
 */
function slugify(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

module.exports = { normalizeTelefone, slugify };
