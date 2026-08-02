/**
 * Controller da Base de Conhecimento (RAG) — Camada 3
 * Endpoints para upload, listagem, exclusão, reindex e busca na base.
 */
const knowledgeService = require('./knowledge.service');
const multer = require('multer');
const path = require('path');

// Configuração de upload em memória (processa na hora, não salva arquivo)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

/**
 * GET /api/whatsapp/knowledge
 * Lista documentos da base de conhecimento.
 */
async function list(req, res) {
  try {
    const docs = await knowledgeService.listDocuments();
    return res.json({ success: true, docs });
  } catch (err) {
    console.error('[Knowledge list] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/knowledge/manual
 * Adiciona entrada manual (formulário).
 * Body: { nome, categoria, conteudo }
 */
async function addManual(req, res) {
  try {
    const { nome, categoria = 'outros', conteudo } = req.body;
    if (!nome || !conteudo) {
      return res.status(400).json({ success: false, error: 'nome e conteudo são obrigatórios' });
    }
    const doc = await knowledgeService.addDocument({ nome, tipo: 'formulario', categoria, conteudo });
    return res.status(201).json({ success: true, doc });
  } catch (err) {
    console.error('[Knowledge manual] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/knowledge/upload
 * Upload de arquivo (TXT, PDF, DOCX via texto). Multipart com campo "file".
 * Body (form-data): file, categoria
 */
async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Arquivo não enviado (campo "file")' });
    }
    const categoria = req.body.categoria || 'outros';
    const originalName = req.file.originalname || 'documento';
    const ext = path.extname(originalName).toLowerCase();

    // Extrai texto conforme o tipo
    let texto = '';
    let tipo = 'texto';
    const buffer = req.file.buffer;

    if (ext === '.txt' || ext === '.md') {
      texto = buffer.toString('utf-8');
      tipo = 'txt';
    } else if (ext === '.pdf') {
      // PDF: tenta extrair texto simples (fallback: decodifica latin1 e limpa)
      // Para PDFs completos recomenda-se colar o texto via formulário.
      try {
        // Tenta extração básica de PDF via regex (text streams)
        const raw = buffer.toString('latin1');
        const matches = raw.match(/\(([^)]{3,})\)/g) || [];
        texto = matches.map((m) => m.slice(1, -1)).join(' ');
        tipo = 'pdf';
      } catch {
        texto = buffer.toString('utf-8');
      }
    } else if (ext === '.docx' || ext === '.doc') {
      // DOCX: usa texto bruto dos XML (aproximação sem lib externa)
      try {
        const raw = buffer.toString('utf-8');
        const texts = raw.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        texto = texts.map((t) => t.replace(/<[^>]+>/g, '')).join(' ');
        tipo = 'docx';
      } catch {
        texto = buffer.toString('utf-8');
      }
    } else if (ext === '.csv') {
      texto = buffer.toString('utf-8');
      tipo = 'csv';
    } else {
      // Fallback: tenta utf-8
      texto = buffer.toString('utf-8');
    }

    if (!texto || texto.trim().length < 20) {
      return res.status(422).json({
        success: false,
        error: 'Não foi possível extrair texto suficiente do arquivo. Para PDFs, prefira colar o texto via "Adicionar entrada manual".',
        ext,
      });
    }

    const doc = await knowledgeService.addDocument({
      nome: originalName,
      tipo,
      categoria,
      conteudo: texto,
    });

    return res.status(201).json({ success: true, doc });
  } catch (err) {
    console.error('[Knowledge upload] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/whatsapp/knowledge/:id
 * Remove um documento da base.
 */
async function remove(req, res) {
  try {
    const { id } = req.params;
    await knowledgeService.deleteDocument(id);
    return res.json({ success: true, message: 'Documento removido' });
  } catch (err) {
    console.error('[Knowledge delete] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/whatsapp/knowledge/reindex
 * Reprocessa toda a base (re-gera embeddings).
 */
async function reindex(req, res) {
  try {
    const result = await knowledgeService.reindexAll();
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Knowledge reindex] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/whatsapp/knowledge/search?q=...
 * Busca na base (para teste/visualização).
 */
async function search(req, res) {
  try {
    const { q, topK = 3 } = req.query;
    if (!q) return res.status(400).json({ success: false, error: 'q é obrigatório' });
    const chunks = await knowledgeService.search(q, { topK: parseInt(topK, 10) || 3 });
    return res.json({ success: true, chunks });
  } catch (err) {
    console.error('[Knowledge search] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { list, addManual, uploadFile, upload, remove, reindex, search };
