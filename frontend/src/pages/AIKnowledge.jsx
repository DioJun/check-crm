import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Upload, FileText, Plus, Trash2, RefreshCw, Search, X } from 'lucide-react';

const CATEGORIAS = [
  { id: 'produto', label: 'Produtos' },
  { id: 'script', label: 'Scripts de vendas' },
  { id: 'faq', label: 'FAQ' },
  { id: 'preco', label: 'Preços e políticas' },
  { id: 'case', label: 'Cases de sucesso' },
  { id: 'concorrencia', label: 'Concorrência' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'outros', label: 'Outros' },
];

const API = 'http://localhost:3001/api/whatsapp/knowledge';

export default function AIKnowledge() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [showManual, setShowManual] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [form, setForm] = useState({ nome: '', categoria: 'produto', conteudo: '' });
  const [uploading, setUploading] = useState(false);

  const notify = (text, type = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  };

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const data = await res.json();
      if (data.success) setDocs(data.docs);
    } catch (err) {
      notify(`Erro ao carregar base: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Upload de arquivo
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('categoria', form.categoria || 'outros');
      const res = await fetch(`${API}/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        notify(`✅ "${file.name}" processado com sucesso`);
        await loadDocs();
      } else {
        notify(data.error || 'Erro no upload', 'error');
      }
    } catch (err) {
      notify(`Erro no upload: ${err.message}`, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Adicionar manual
  const handleAddManual = async () => {
    if (!form.nome.trim() || !form.conteudo.trim()) {
      notify('Preencha nome e conteúdo', 'error');
      return;
    }
    try {
      const res = await fetch(`${API}/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        notify('✅ Entrada adicionada à base');
        setShowManual(false);
        setForm({ nome: '', categoria: 'produto', conteudo: '' });
        await loadDocs();
      } else {
        notify(data.error || 'Erro ao adicionar', 'error');
      }
    } catch (err) {
      notify(`Erro: ${err.message}`, 'error');
    }
  };

  // Remover documento
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notify('🗑️ Documento removido');
        await loadDocs();
      }
    } catch (err) {
      notify(`Erro: ${err.message}`, 'error');
    }
  };

  // Reindexar
  const handleReindex = async () => {
    try {
      const res = await fetch(`${API}/reindex`, { method: 'POST' });
      const data = await res.json();
      if (data.success) notify(`🔄 Base reprocessada (${data.processados} documentos)`);
    } catch (err) {
      notify(`Erro: ${err.message}`, 'error');
    }
  };

  // Buscar na base
  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQ)}&topK=5`);
      const data = await res.json();
      setSearchResults(data.chunks || []);
    } catch (err) {
      notify(`Erro na busca: ${err.message}`, 'error');
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500';

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-gold-100 text-gold-700">
            <BookOpen className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Base de Conhecimento</h1>
            <p className="text-sm text-gray-500">
              A IA consulta esta base para responder com preços, políticas e scripts oficiais.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReindex}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar base
          </button>
          <button
            onClick={() => setShowManual((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gold-700 hover:bg-gold-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar manual
          </button>
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm ${msgType === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      {/* Upload de arquivo */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-gold-500 transition-colors">
          <Upload className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-sm font-medium text-gray-700">
            {uploading ? 'Processando arquivo...' : 'Enviar arquivo (TXT, PDF, DOCX, CSV)'}
          </span>
          <span className="text-xs text-gray-400 mt-1">
            Catálogos, scripts, FAQ, políticas de preço, cases de sucesso
          </span>
          <input type="file" accept=".txt,.md,.pdf,.docx,.doc,.csv" className="hidden" onChange={handleUpload} />
        </label>
        <div className="mt-3">
          <label className="text-xs font-medium text-gray-600">Categoria do upload:</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className={`${inputClass} mt-1`}
          >
            {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Formulário manual */}
      {showManual && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Adicionar entrada manual</h3>
            <button onClick={() => setShowManual(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Título</label>
              <input
                className={inputClass}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Política de parcelamento 2026"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Categoria</label>
              <select
                className={inputClass}
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Conteúdo</label>
            <textarea
              className={`${inputClass} min-h-[120px]`}
              value={form.conteudo}
              onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
              placeholder="Cole aqui o conteúdo que a IA deve usar como fonte oficial (preços, scripts, respostas padrão...)"
            />
          </div>
          <button
            onClick={handleAddManual}
            className="px-4 py-2 bg-gold-700 hover:bg-gold-500 text-white text-sm font-medium rounded-lg"
          >
            Salvar na base
          </button>
        </div>
      )}

      {/* Busca na base */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Testar busca</h3>
          <span className="text-xs text-gray-400">— veja o que a IA encontra para uma pergunta</span>
        </div>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder='Ex: "quanto custa um site?"'
          />
          <button onClick={handleSearch} className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg">
            Buscar
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((r, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gold-700">{r.fonte}</span>
                  <span className="text-[10px] text-gray-400">similaridade {r.similarity}</span>
                </div>
                <p className="text-sm text-gray-600">{r.texto}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista de documentos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Documentos na base ({docs.length})</h3>
          {loading && <span className="text-xs text-gray-400">Carregando...</span>}
        </div>
        {docs.length === 0 && !loading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            Nenhum documento ainda. Envie um arquivo ou adicione manualmente para a IA começar a usar.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <div key={doc.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-2 rounded-lg bg-gray-100 text-gray-500 flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.nome}</p>
                    <p className="text-xs text-gray-400">
                      {CATEGORIAS.find((c) => c.id === doc.categoria)?.label || doc.categoria}
                      {' · '}{doc._count?.chunks || doc.chunkCount} trechos · {doc.usos} usos pela IA
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
