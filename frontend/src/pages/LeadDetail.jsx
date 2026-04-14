import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Phone, StickyNote, ExternalLink, Edit2, Check, X, Sparkles, RefreshCw, Copy } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';
import WhatsAppButton from '../components/ui/WhatsAppButton';

const STATUSES = ['novo', 'contatado', 'interessado', 'fechado'];
const TIPOS = [
  { value: 'mensagem', label: 'Mensagem', icon: MessageSquare },
  { value: 'ligacao', label: 'Ligação', icon: Phone },
  { value: 'anotacao', label: 'Anotação', icon: StickyNote },
];

const TIPO_COLORS = {
  mensagem: 'bg-blue-100 text-blue-800',
  ligacao: 'bg-green-100 text-green-800',
  anotacao: 'bg-yellow-100 text-yellow-800',
};

function formatDateTime(str) {
  if (!str) return '-';
  return new Date(str).toLocaleString('pt-BR');
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ tipo: 'mensagem', conteudo: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Edição de informações adicionais
  const [editingInfo, setEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({
    site: '',
    temWhatsapp: false,
    temSite: false,
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalysisAt, setAiAnalysisAt] = useState(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/leads/${id}`),
      api.get(`/interactions/${id}`),
    ]).then(([leadRes, interRes]) => {
      const l = leadRes.data?.lead || leadRes.data;
      setLead(l);
      
      // Inicializar form de edição
      setEditForm({
        site: l?.site || '',
        temWhatsapp: l?.temWhatsapp || false,
        temSite: l?.temSite || false,
      });

      // Carregar análise AI salva
      if (l?.aiAnalysis) {
        try { setAiAnalysis(JSON.parse(l.aiAnalysis)); } catch { /* ignorar */ }
        setAiAnalysisAt(l.aiAnalysisAt);
      }
      
      const raw = interRes.data?.interactions || interRes.data || [];
      setInteractions([...raw].sort((a, b) => new Date(b.data || b.createdAt) - new Date(a.data || a.createdAt)));
    }).catch(() => setError('Erro ao carregar dados do lead'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(e) {
    const newStatus = e.target.value;
    setStatusUpdating(true);
    try {
      const res = await api.put(`/leads/${id}`, { status: newStatus });
      setLead((l) => ({ ...l, status: newStatus, ...res.data?.lead }));
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleAddInteraction(e) {
    e.preventDefault();
    if (!interactionForm.conteudo.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/interactions/${id}`, interactionForm);
      const newItem = res.data?.interaction || res.data;
      setInteractions((prev) => [newItem, ...prev]);
      setInteractionForm((f) => ({ ...f, conteudo: '' }));
    } catch {
      setError('Erro ao adicionar interação');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnalyzeAI() {
    setAnalyzingAI(true);
    setAiError('');
    try {
      const res = await api.post(`/leads/${id}/analyze`);
      setAiAnalysis(res.data.analysis);
      setAiAnalysisAt(res.data.analyzedAt);
    } catch (err) {
      setAiError(err.response?.data?.error || 'Erro ao analisar lead com IA');
    } finally {
      setAnalyzingAI(false);
    }
  }

  function copyToClipboard(text, field) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    });
  }

  async function handleSaveInfo() {
    setSavingInfo(true);
    try {
      const res = await api.put(`/leads/${id}`, editForm);
      setLead((l) => ({ ...l, ...editForm, ...res.data?.lead }));
      setEditingInfo(false);
    } catch {
      setError('Erro ao atualizar informações');
    } finally {
      setSavingInfo(false);
    }
  }

  function handleCancelEdit() {
    setEditForm({
      site: lead?.site || '',
      temWhatsapp: lead?.temWhatsapp || false,
      temSite: lead?.temSite || false,
    });
    setEditingInfo(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error && !lead) {
    return <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/leads')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Leads
      </button>

      {/* Lead info card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{lead?.nome}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{lead?.telefone}</p>
          </div>
          <WhatsAppButton telefone={lead?.telefone} nome={lead?.nome} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <InfoItem label="Cidade" value={lead?.cidade} />
          <InfoItem label="Serviço" value={lead?.servico} />
          <InfoItem label="Origem" value={lead?.origem} />
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Status</p>
            <select
              value={lead?.status || 'novo'}
              onChange={handleStatusChange}
              disabled={statusUpdating}
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Additional Info section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Informações Adicionais</h2>
          {!editingInfo && (
            <button
              onClick={() => setEditingInfo(true)}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
          )}
        </div>

        {editingInfo ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site
              </label>
              <input
                type="url"
                value={editForm.site}
                onChange={(e) => setEditForm({ ...editForm, site: e.target.value })}
                placeholder="https://exemplo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.temWhatsapp}
                  onChange={(e) => setEditForm({ ...editForm, temWhatsapp: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Tem WhatsApp</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.temSite}
                  onChange={(e) => setEditForm({ ...editForm, temSite: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Tem Site</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveInfo}
                disabled={savingInfo}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Salvar
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={savingInfo}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-2">Site</p>
              {lead?.site ? (
                <a
                  href={lead.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 hover:underline break-all text-sm flex items-center gap-1"
                >
                  {lead.site}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ) : (
                <p className="text-sm text-gray-400">Não informado</p>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-2">WhatsApp</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lead?.temWhatsapp ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                {lead?.temWhatsapp ? '✓ Tem WhatsApp' : '✗ Sem WhatsApp'}
              </span>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-2">Tem Site</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lead?.temSite ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                {lead?.temSite ? '✓ Tem Site' : '✗ Sem Site'}
              </span>
            </div>

            {lead?.avaliacao && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-2">Avaliação</p>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600 font-medium">⭐ {lead.avaliacao}</span>
                  {lead?.reviews && <span className="text-gray-500 text-sm">({lead.reviews})</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Analysis */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <h2 className="text-base font-semibold text-gray-900">Análise de IA — Estratégia de Venda</h2>
          </div>
          <div className="flex items-center gap-3">
            {aiAnalysisAt && (
              <span className="text-xs text-gray-400">
                Gerado em {new Date(aiAnalysisAt).toLocaleString('pt-BR')}
              </span>
            )}
            <button
              onClick={handleAnalyzeAI}
              disabled={analyzingAI}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {analyzingAI ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analisando...</>
              ) : aiAnalysis ? (
                <><RefreshCw className="w-4 h-4" /> Reanalisar</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Analisar com IA</>
              )}
            </button>
          </div>
        </div>

        {aiError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{aiError}</p>
        )}

        {analyzingAI && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-violet-500">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <p className="text-sm font-medium">Consultando IA... pode levar alguns segundos</p>
          </div>
        )}

        {!analyzingAI && aiAnalysis && (
          <div className="space-y-4">

            {/* Prioridade + Diagnóstico */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 bg-white rounded-lg p-4 border border-violet-100">
                <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">🔍 Diagnóstico</p>
                <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis.diagnostico}</p>
              </div>
              <div className="sm:w-40 bg-white rounded-lg p-4 border border-violet-100 flex flex-col items-center justify-center">
                <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-2">Prioridade</p>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  aiAnalysis.prioridade === 'alta' ? 'bg-red-100 text-red-700' :
                  aiAnalysis.prioridade === 'media' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {aiAnalysis.prioridade?.toUpperCase()}
                </span>
                {aiAnalysis.justificativaPrioridade && (
                  <p className="text-xs text-gray-400 text-center mt-2 leading-snug">{aiAnalysis.justificativaPrioridade}</p>
                )}
              </div>
            </div>

            {/* Serviço Recomendado */}
            <div className="bg-white rounded-lg p-4 border border-violet-100">
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">💡 Serviço Recomendado</p>
              <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis.servicoRecomendado}</p>
            </div>

            {/* Proposta */}
            <div className="bg-white rounded-lg p-4 border border-violet-100">
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">📋 Proposta</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{aiAnalysis.proposta}</p>
            </div>

            {/* Abordagem */}
            <div className="bg-white rounded-lg p-4 border border-violet-100">
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">🎯 Estratégia de Abordagem</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{aiAnalysis.abordagem}</p>
            </div>

            {/* Como ser convincente */}
            <div className="bg-white rounded-lg p-4 border border-violet-100">
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">🧠 Como Ser Convincente</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{aiAnalysis.comoSerConvincente}</p>
            </div>

            {/* Pitch WhatsApp */}
            <div className="bg-white rounded-lg p-4 border border-green-100 border-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">💬 Pitch WhatsApp (pronto para enviar)</p>
                <button
                  onClick={() => copyToClipboard(aiAnalysis.pitchWhatsApp, 'whatsapp')}
                  className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 border border-green-300 hover:bg-green-50 px-2 py-1 rounded transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedField === 'whatsapp' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{aiAnalysis.pitchWhatsApp}</p>
            </div>

            {/* Script Ligação */}
            {aiAnalysis.pitchLigacao && (
              <div className="bg-white rounded-lg p-4 border border-blue-100 border-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">📞 Script de Ligação (abertura)</p>
                  <button
                    onClick={() => copyToClipboard(aiAnalysis.pitchLigacao, 'ligacao')}
                    className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 border border-blue-300 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedField === 'ligacao' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{aiAnalysis.pitchLigacao}</p>
              </div>
            )}

          </div>
        )}

        {!analyzingAI && !aiAnalysis && (
          <div className="text-center py-8 text-gray-400">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Clique em <strong>Analisar com IA</strong> para gerar proposta, estratégia de abordagem, pitch de WhatsApp e muito mais.</p>
          </div>
        )}
      </div>

      {/* Add interaction */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Adicionar Interação</h2>
        <form onSubmit={handleAddInteraction} className="space-y-3">
          <div className="flex gap-3">
            {TIPOS.map(({ value, label, icon: Icon }) => (
              <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value={value}
                  checked={interactionForm.tipo === value}
                  onChange={(e) => setInteractionForm((f) => ({ ...f, tipo: e.target.value }))}
                  className="accent-indigo-600"
                />
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
          <textarea
            value={interactionForm.conteudo}
            onChange={(e) => setInteractionForm((f) => ({ ...f, conteudo: e.target.value }))}
            rows={3}
            placeholder="Descreva a interação..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !interactionForm.conteudo.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>
      </div>

      {/* Interaction history */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Histórico de Interações{' '}
          <span className="text-gray-400 font-normal text-sm">({interactions.length})</span>
        </h2>
        {interactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhuma interação registrada.</p>
        ) : (
          <div className="space-y-3">
            {interactions.map((item, idx) => (
              <div key={item.id || idx} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORS[item.tipo] || 'bg-gray-100 text-gray-700'}`}>
                      {item.tipo}
                    </span>
                    <span className="text-xs text-gray-400">{formatDateTime(item.data || item.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.conteudo}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || '-'}</p>
    </div>
  );
}
