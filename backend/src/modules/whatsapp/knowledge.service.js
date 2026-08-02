/**
 * CAMADA 3 — Base de Conhecimento do Negócio (RAG)
 *
 * Sistema de Retrieval Augmented Generation offline para SQLite:
 *   - Armazena documentos (catálogo, scripts, FAQ, políticas, cases)
 *   - Divide em chunks com sobreposição
 *   - Gera embeddings locais via TF-IDF hashing (256 dimensões) — SEM chamada externa
 *   - Busca por similaridade de cosseno
 *   - Injeta os trechos mais relevantes no prompt da IA
 *
 * ✅ Funciona 100% offline, sem custo de API, sem servidor externo.
 */

const prisma = require('../../core/lib/prisma');

// ============ EMBEDDING LOCAL (TF-IDF Hashing) ============

const EMBEDDING_DIM = 256;

/** Tokeniza e normaliza texto (minúsculas, sem acentos, remove stopwords comuns) */
function tokenize(texto) {
  const t = String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stopwords = new Set([
    'a', 'o', 'e', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
    'para', 'por', 'com', 'sem', 'um', 'uma', 'uns', 'umas', 'que', 'se', 'como',
    'mais', 'menos', 'muito', 'pouco', 'ser', 'estar', 'foi', 'sao', 'nao', 'sim',
    'voce', 'eu', 'ele', 'ela', 'nos', 'meu', 'sua', 'tem', 'ter', 'isso', 'aquilo',
    'quando', 'onde', 'qual', 'quais', 'esse', 'essa', 'este', 'esta', 'mas', 'ou',
    'ate', 'tambem', 'ja', 'ainda', 'so', 'bem', 'mau', 'cada', 'entre', 'depois',
  ]);

  return t.split(' ').filter((w) => w.length > 2 && !stopwords.has(w));
}

/** Hash de string -> índice 0..N */
function hashString(str, dim) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % dim;
}

/**
 * Gera embedding TF-IDF-like: vetor de frequência de termos com hashing.
 * Cada termo importante vira +1 em um bucket (com sinal baseado em hash para reduzir colisão).
 */
function generateEmbedding(texto) {
  const tokens = tokenize(texto);
  const vec = new Array(EMBEDDING_DIM).fill(0);

  // Frequência de termos
  const freq = {};
  tokens.forEach((t) => { freq[t] = (freq[t] || 0) + 1; });

  // Term frequency × IDF (IDF simulado: palavras raras pesam mais)
  const total = tokens.length || 1;
  for (const [termo, count] of Object.entries(freq)) {
    const idx = hashString(termo, EMBEDDING_DIM);
    const tf = count / total;
    // Palavras mais longas/raras têm mais peso (aproximação de IDF)
    const idf = 1 + Math.log(1 + termo.length / 3);
    vec[idx] += tf * idf;
  }
  return vec;
}

/** Normaliza um vetor (para cosseno) */
function normalizeVec(vec) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

/** Similaridade de cosseno entre dois vetores */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ============ CHUNKING ============

const CHUNK_SIZE = 500;      // caracteres por chunk
const CHUNK_OVERLAP = 80;    // sobreposição para não perder contexto

/** Divide texto em chunks com sobreposição */
function chunkText(texto) {
  const text = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    // Tenta quebrar em fim de frase/palavra quando possível
    if (end < text.length) {
      const breakAt = text.lastIndexOf('. ', end);
      const breakAtSpace = text.lastIndexOf(' ', end);
      const candidate = breakAt > start + CHUNK_SIZE * 0.5 ? breakAt : breakAtSpace;
      if (candidate > start) end = candidate;
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}

// ============ PROCESSAMENTO DE DOCUMENTOS ============

/** Extrai texto de um conteúdo (aceita string crua; PDF/docx extraídos pelo caller) */
function extractTextFromContent(conteudo) {
  return String(conteudo || '').trim();
}

/**
 * Processa um documento: chunking + embeddings + salva chunks.
 * @param {Object} doc - documento criado no banco
 * @param {string} conteudo - texto completo
 */
async function processDocument(doc, conteudo) {
  const texto = extractTextFromContent(conteudo);
  if (!texto) {
    return prisma.knowledgeDoc.update({ where: { id: doc.id }, data: { status: 'erro' } });
  }

  const chunks = chunkText(texto);
  const fonte = `${doc.categoria}:${doc.nome}`;

  // Salva chunks com embedding
  for (const chunk of chunks) {
    const embedding = generateEmbedding(chunk);
    await prisma.knowledgeChunk.create({
      data: {
        docId: doc.id,
        texto: chunk,
        embedding: JSON.stringify(embedding),
        fonte,
      },
    });
  }

  return prisma.knowledgeDoc.update({
    where: { id: doc.id },
    data: { status: 'pronto', conteudo: texto, chunkCount: chunks.length },
  });
}

/**
 * Cria um documento a partir de texto (formulário manual ou extração de arquivo).
 */
async function addDocument({ nome, tipo = 'texto', categoria = 'outros', conteudo, leadId = null }) {
  const doc = await prisma.knowledgeDoc.create({
    data: { nome, tipo, categoria, status: 'processando', leadId },
  });
  return processDocument(doc, conteudo);
}

/**
 * Remove um documento e seus chunks (cascade).
 */
async function deleteDocument(id) {
  return prisma.knowledgeDoc.delete({ where: { id } });
}

/** Lista documentos da base (com contagem de usos) */
async function listDocuments() {
  return prisma.knowledgeDoc.findMany({
    orderBy: [{ categoria: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { chunks: true } } },
  });
}

/**
 * Reprocessa a base inteira (re-gera embeddings de todos os documentos).
 * Chunks antigos são recriados.
 */
async function reindexAll() {
  const docs = await prisma.knowledgeDoc.findMany();
  let processados = 0;
  for (const doc of docs) {
    if (doc.conteudo) {
      // Remove chunks antigos e reprocessa
      await prisma.knowledgeChunk.deleteMany({ where: { docId: doc.id } });
      await processDocument(doc, doc.conteudo);
      processados++;
    }
  }
  return { processados };
}

// ============ BUSCA VETORIAL ============

/**
 * Busca os chunks mais relevantes para uma consulta (RAG retrieval).
 * @param {string} query - texto da consulta (ex: últimas mensagens da conversa)
 * @param {number} topK - quantos chunks retornar
 * @param {string|null} categoria - filtrar por categoria (opcional)
 */
async function search(query, { topK = 3, categoria = null } = {}) {
  const qEmbedding = normalizeVec(generateEmbedding(query));
  if (!qEmbedding.some((v) => v !== 0)) return [];

  const where = {};
  if (categoria) where.categoria = categoria;

  const docs = await prisma.knowledgeDoc.findMany({ where: { ...where, status: 'pronto' } });
  const resultados = [];

  for (const doc of docs) {
    const chunks = await prisma.knowledgeChunk.findMany({ where: { docId: doc.id } });
    for (const chunk of chunks) {
      let emb;
      try { emb = JSON.parse(chunk.embedding || '[]'); } catch { emb = []; }
      const sim = cosineSimilarity(qEmbedding, normalizeVec(emb));
      if (sim > 0.02) { // limiar mínimo
        resultados.push({
          docId: doc.id,
          docNome: doc.nome,
          categoria: doc.categoria,
          texto: chunk.texto,
          fonte: chunk.fonte,
          similarity: Math.round(sim * 1000) / 1000,
        });
      }
    }
  }

  // Ordena por similaridade desc e retorna top-K
  resultados.sort((a, b) => b.similarity - a.similarity);
  const top = resultados.slice(0, topK);

  // Incrementa contador de usos dos docs retornados
  const docIds = [...new Set(top.map((r) => r.docId))];
  for (const docId of docIds) {
    await prisma.knowledgeDoc.updateMany({
      where: { id: docId },
      data: { usos: { increment: 1 } },
    });
  }

  return top;
}

/**
 * Formata os chunks encontrados como seção de contexto para o prompt.
 */
function buildRagSection(chunks) {
  if (!chunks || !chunks.length) return '';
  const linhas = [
    '## BASE DE CONHECIMENTO (informações oficiais do negócio — use com prioridade)',
  ];
  chunks.forEach((c, i) => {
    linhas.push(`\n[Trecho ${i + 1} — ${c.fonte}]:`);
    linhas.push(c.texto);
  });
  linhas.push(`\nUse os trechos acima como FONTE AUTORITATIVA para preços, condições e informações do produto. Se o lead perguntar algo coberto pela base, responda com base nela.`);
  return linhas.join('\n');
}

/**
 * Busca contexto RAG e retorna pronto para injetar no prompt.
 */
async function searchRagForPrompt(query, { topK = 3, categoria = null } = {}) {
  const chunks = await search(query, { topK, categoria });
  return {
    chunks,
    ragSection: buildRagSection(chunks),
  };
}

module.exports = {
  EMBEDDING_DIM,
  tokenize,
  hashString,
  generateEmbedding,
  normalizeVec,
  cosineSimilarity,
  chunkText,
  addDocument,
  deleteDocument,
  listDocuments,
  reindexAll,
  search,
  buildRagSection,
  searchRagForPrompt,
  processDocument,
};
