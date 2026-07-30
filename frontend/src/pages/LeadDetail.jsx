import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Phone, StickyNote, ExternalLink, Edit2, Check, X, Sparkles, RefreshCw, Copy, Bot, MessageCircle, Lightbulb, Clock, Target, BarChart, ChevronDown } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';
import WhatsAppButton from '../components/ui/WhatsAppButton';

const STATUSES = ['novo', 'sem_contato', 'contatado', 'interessado', 'fechado'];
const TIPOS = [
  { value: 'mensagem', label: 'Mensagem', icon: MessageSquare },
  { value: 'ligacao', label: 'Ligação', icon: Phone },
  { value: 'anotacao', label: 'Anotação', icon: StickyNote },
];

const TIPO_COLORS = {
  mensagem: 'bg-blue-100 text-blue-800',
  ligacao: 'bg-green-100 text-green-800',
  anotacao: 'bg-yellow-100 text-yellow-800',
  ia_analysis: 'bg-violet-100 text-violet-800',
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
    googleMapsRating: '',
    hasProduct: false,
    instagram: '',
    instagramQuality: '',
    observacoes: '',
    porte: '',
    tempoMercado: '',
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalysisAt, setAiAnalysisAt] = useState(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);

  // AI Assistant
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState('');
  const [assistantHistory, setAssistantHistory] = useState([]);
  const [assistantExpanded, setAssistantExpanded] = useState(null); // id do item expandido
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
        googleMapsRating: l?.googleMapsRating || '',
        hasProduct: l?.hasProduct || false,
        instagram: l?.instagram || '',
        instagramQuality: l?.instagramQuality || '',
        observacoes: l?.observacoes || '',
        porte: l?.porte || '',
        tempoMercado: l?.tempoMercado || '',
      });

      // Carregar análise AI salva
      if (l?.aiAnalysis) {
        try { setAiAnalysis(JSON.parse(l.aiAnalysis)); } catch { /* ignorar */ }
        setAiAnalysisAt(l.aiAnalysisAt);
      }
      
      const raw = interRes.data?.interactions || interRes.data || [];
      const all = [...raw].sort((a, b) => new Date(b.data || b.createdAt) - new Date(a.data || a.createdAt));
      setInteractions(all.filter(i => i.tipo !== 'ia_assistant'));
      setAssistantHistory(all.filter(i => i.tipo === 'ia_assistant'));
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
      
      // Recarregar interações para incluir o registro da análise de IA
      try {
        const interRes = await api.get(`/interactions/${id}`);
        const raw = interRes.data?.interactions || interRes.data || [];
        setInteractions([...raw].sort((a, b) => new Date(b.data || b.createdAt) - new Date(a.data || a.createdAt)));
      } catch { /* ignorar erro ao recarregar */ }
    } catch (err) {
      setAiError(err.response?.data?.error || 'Erro ao analisar lead com IA');
    } finally {
      setAnalyzingAI(false);
    }
  }

  async function handleOpenAssistant() {
    setAssistantLoading(true);
    try {
      const res = await api.post(`/leads/${id}/assistant`);
      const nova = res.data.assistencia || 'Assistente não retornou resposta.';
      setAssistantResponse(nova);
      // Atualizar histórico com o retorno do servidor
      if (res.data.historico) {
        setAssistantHistory(res.data.historico);
      }
      // Expandir a resposta mais recente automaticamente
      if (res.data.historico?.length > 0) {
        setAssistantExpanded(res.data.historico[0].id);
      }
    } catch (err) {
      setAssistantResponse(`❌ Erro ao consultar assistente: ${err.response?.data?.error || err.message}`);
    } finally {
      setAssistantLoading(false);
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
      googleMapsRating: lead?.googleMapsRating || '',
      hasProduct: lead?.hasProduct || false,
      instagram: lead?.instagram || '',
      instagramQuality: lead?.instagramQuality || '',
      observacoes: lead?.observacoes || '',
      porte: lead?.porte || '',
      tempoMercado: lead?.tempoMercado || '',
    });
    setEditingInfo(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-700" />
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
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gold-700 mb-6 transition-colors"
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
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white"
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
              className="flex items-center gap-1.5 text-sm text-gold-700 hover:text-gold-600 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
          )}
        </div>

        {editingInfo ? (
          <div className="space-y-4">
            {/* Linha 1: Site + Instagram */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
                <input type="url" value={editForm.site} onChange={(e) => setEditForm({...editForm, site: e.target.value})}
                  placeholder="https://exemplo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                <input type="text" value={editForm.instagram} onChange={(e) => setEditForm({...editForm, instagram: e.target.value})}
                  placeholder="@usuario"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500" />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-200">
                <input type="checkbox" checked={editForm.temWhatsapp} onChange={(e) => setEditForm({...editForm, temWhatsapp: e.target.checked})}
                  className="w-4 h-4 rounded border-gray-300 text-gold-700" />
                <span className="text-sm text-gray-700">📱 WhatsApp</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-200">
                <input type="checkbox" checked={editForm.temSite} onChange={(e) => setEditForm({...editForm, temSite: e.target.checked})}
                  className="w-4 h-4 rounded border-gray-300 text-gold-700" />
                <span className="text-sm text-gray-700">🌐 Tem Site</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-gray-200">
                <input type="checkbox" checked={editForm.hasProduct} onChange={(e) => setEditForm({...editForm, hasProduct: e.target.checked})}
                  className="w-4 h-4 rounded border-gray-300 text-gold-700" />
                <span className="text-sm text-gray-700">📦 Tem Produto Digital</span>
              </label>
            </div>

            {/* Selectores */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">⭐ Google Maps</label>
                <select value={editForm.googleMapsRating} onChange={(e) => setEditForm({...editForm, googleMapsRating: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500">
                  <option value="">Selecione...</option>
                  <option value="Alto">⭐⭐⭐ Bem avaliado (4+ estrelas)</option>
                  <option value="Medio">⭐⭐ Avaliação média (3-4 estrelas)</option>
                  <option value="Baixo">⭐ Mal avaliado (abaixo de 3)</option>
                  <option value="NaoTem">❌ Não tem avaliações</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📸 Instagram</label>
                <select value={editForm.instagramQuality} onChange={(e) => setEditForm({...editForm, instagramQuality: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500">
                  <option value="">Selecione...</option>
                  <option value="Bom">🔥 Bom - ativo com engajamento</option>
                  <option value="Medio">👌 Médio - publicado mas sem engajamento</option>
                  <option value="Ruim">📉 Ruim - perfil parado ou sem conteúdo</option>
                  <option value="NaoTem">❌ Não tem Instagram</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Porte do Negócio</label>
                <select value={editForm.porte} onChange={(e) => setEditForm({...editForm, porte: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500">
                  <option value="">Selecione...</option>
                  <option value="Pequeno">🏪 Pequeno (MEI/autônomo)</option>
                  <option value="Medio">🏢 Médio (até 10 funcionários)</option>
                  <option value="Grande">🏛️ Grande (acima de 10)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">⏳ Tempo de Mercado</label>
                <select value={editForm.tempoMercado} onChange={(e) => setEditForm({...editForm, tempoMercado: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500">
                  <option value="">Selecione...</option>
                  <option value="Menos1ano">🌱 Menos de 1 ano</option>
                  <option value="1a3anos">🌿 De 1 a 3 anos</option>
                  <option value="3a5anos">🌳 De 3 a 5 anos</option>
                  <option value="Mais5anos">🌲 Mais de 5 anos</option>
                </select>
              </div>
            </div>

            {/* Anotações */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📝 Anotações</label>
              <textarea value={editForm.observacoes} onChange={(e) => setEditForm({...editForm, observacoes: e.target.value})}
                rows={3} placeholder="Informações relevantes sobre o lead..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none" />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveInfo} disabled={savingInfo}
                className="flex items-center gap-2 px-4 py-2 bg-gold-700 hover:bg-gold-500 disabled:bg-gold-300 text-dark-900 text-sm font-medium rounded-lg transition-colors">
                <Check className="w-4 h-4" /> Salvar
              </button>
              <button onClick={handleCancelEdit} disabled={savingInfo}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                <X className="w-4 h-4" /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Primeira linha: Site, Instagram, WhatsApp */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">🌐 Site</p>
                {lead?.site ? (
                  <a href={lead.site} target="_blank" rel="noopener noreferrer"
                    className="text-gold-700 hover:text-gold-600 hover:underline text-sm flex items-center gap-1 break-all">
                    {lead.site} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : <p className="text-sm text-gray-400">Não informado</p>}
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">📸 Instagram</p>
                {lead?.instagram ? (
                  <p className="text-sm text-gray-700">{lead.instagram}</p>
                ) : <p className="text-sm text-gray-400">Não informado</p>}
                {lead?.instagramQuality && (
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    lead.instagramQuality === 'Bom' ? 'bg-green-100 text-green-800' :
                    lead.instagramQuality === 'Medio' ? 'bg-yellow-100 text-yellow-800' :
                    lead.instagramQuality === 'Ruim' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>{lead.instagramQuality}</span>
                )}
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">📱 WhatsApp</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lead?.temWhatsapp ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                  {lead?.temWhatsapp ? '✓ Tem WhatsApp' : '✗ Sem WhatsApp'}
                </span>
              </div>
            </div>

            {/* Segunda linha: Google Maps, Produto, Porte, Tempo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">⭐ Google Maps</p>
                {lead?.googleMapsRating ? (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    lead.googleMapsRating === 'Alto' ? 'bg-green-100 text-green-800' :
                    lead.googleMapsRating === 'Medio' ? 'bg-yellow-100 text-yellow-800' :
                    lead.googleMapsRating === 'Baixo' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>{lead.googleMapsRating}</span>
                ) : <p className="text-sm text-gray-400">Não informado</p>}
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">📦 Produto Digital</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lead?.hasProduct ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                  {lead?.hasProduct ? '✓ Sim' : '✗ Não'}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">🏢 Porte</p>
                {lead?.porte ? <p className="text-sm text-gray-700">{lead.porte}</p> : <p className="text-sm text-gray-400">-</p>}
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">⏳ Tempo Mercado</p>
                {lead?.tempoMercado ? (
                  <span className="text-sm text-gray-700">{{
                    'Menos1ano': 'Menos de 1 ano',
                    '1a3anos': '1 a 3 anos',
                    '3a5anos': '3 a 5 anos',
                    'Mais5anos': 'Mais de 5 anos',
                  }[lead.tempoMercado] || lead.tempoMercado}</span>
                ) : <p className="text-sm text-gray-400">-</p>}
              </div>
            </div>

            {/* Anotações */}
            {lead?.observacoes && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">📝 Anotações</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.observacoes}</p>
              </div>
            )}

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
      <div className="bg-gradient-to-br from-dark-900/5 to-gold-50 border border-gold-200 rounded-xl shadow-sm p-6 mb-6">
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

      {/* Assistente de Vendas IA - Painel Fixo com Histórico */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Assistente de Vendas IA</h2>
            {assistantHistory.length > 0 && (
              <span className="text-xs text-gray-400">· {assistantHistory.length} análise{assistantHistory.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <button
            onClick={handleOpenAssistant}
            disabled={assistantLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:from-violet-300 disabled:to-purple-300 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            {assistantLoading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Analisando...</>
            ) : (
              <><Bot className="w-4 h-4" /> Nova Análise</>
            )}
          </button>
        </div>

        {assistantLoading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-violet-500">
            <div className="relative">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <Bot className="w-3 h-3 text-violet-700 absolute -bottom-0.5 -right-0.5" />
            </div>
            <p className="text-sm font-medium">Analisando interações e gerando recomendações...</p>
          </div>
        )}

        {/* Timeline de análises anteriores */}
        {!assistantLoading && assistantHistory.length > 0 && (
          <div className="space-y-3">
            {assistantHistory.map((item) => {
              const isExpanded = assistantExpanded === item.id;
              const lines = (item.conteudo || '').split('\n').filter(l => l.trim());
              const preview = lines.slice(0, 2).join(' · ').substring(0, 120);
              
              return (
                <div key={item.id} className="bg-white rounded-lg border border-violet-100 overflow-hidden">
                  <button
                    onClick={() => setAssistantExpanded(isExpanded ? null : item.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-violet-50/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Bot className="w-4 h-4 text-violet-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700">
                          Análise · {new Date(item.data).toLocaleString('pt-BR')}
                        </p>
                        {!isExpanded && preview && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{preview}...</p>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-violet-50 pt-3">
                      {lines.map((line, i) => {
                        if (line.startsWith('🎯') || line.startsWith('📊') || line.startsWith('💡') || 
                            line.startsWith('📝') || line.startsWith('⏰') || line.startsWith('⚡')) {
                          const emoji = line.charAt(0);
                          const titleMatch = line.match(/\*\*(.+?)\*\*/);
                          const title = titleMatch ? titleMatch[1] : '';
                          const content = line.replace(/\*\*(.+?)\*\*/, '').replace(emoji, '').trim();
                          const iconMap = {
                            '🎯': <Target className="w-4 h-4 text-violet-600" />,
                            '📊': <BarChart className="w-4 h-4 text-blue-600" />,
                            '💡': <Lightbulb className="w-4 h-4 text-amber-500" />,
                            '📝': <MessageCircle className="w-4 h-4 text-green-600" />,
                            '⏰': <Clock className="w-4 h-4 text-orange-500" />,
                            '⚡': <Sparkles className="w-4 h-4 text-yellow-500" />,
                          };
                          return (
                            <div key={i} className="bg-violet-50/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                {iconMap[emoji] || <Sparkles className="w-4 h-4" />}
                                <h4 className="text-xs font-bold text-gray-800">{title}</h4>
                              </div>
                              <p className="text-xs text-gray-600 leading-relaxed ml-6 whitespace-pre-wrap">{content}</p>
                            </div>
                          );
                        }
                        if (line.trim() === '') return null;
                        return <p key={i} className="text-xs text-gray-500 ml-6">{line}</p>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Estado vazio */}
        {!assistantLoading && assistantHistory.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Clique em <strong>Nova Análise</strong> para gerar recomendações de vendas baseadas no histórico de interações.</p>
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-gray-400">
              <span>🎯 Próximo passo</span>
              <span>📊 Análise do momento</span>
              <span>💡 Oportunidades</span>
              <span>📝 Script sugerido</span>
              <span>⏰ Timing ideal</span>
            </div>
          </div>
        )}
      </div>

      {/* Add interaction */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Adicionar Interação</h2>
        <form onSubmit={handleAddInteraction} className="space-y-3">
          <div className="flex gap-3">
            {TIPOS.map((item) => {
              const TipoIcon = item.icon;
              return (
                <label key={item.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value={item.value}
                    checked={interactionForm.tipo === item.value}
                    onChange={(e) => setInteractionForm((f) => ({ ...f, tipo: e.target.value }))}
                    className="accent-gold-700"
                  />
                  <TipoIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </label>
              );
            })}
          </div>
          <textarea
            value={interactionForm.conteudo}
            onChange={(e) => setInteractionForm((f) => ({ ...f, conteudo: e.target.value }))}
            rows={3}
            placeholder="Descreva a interação..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !interactionForm.conteudo.trim()}
                className="px-4 py-2 bg-gold-700 hover:bg-gold-500 disabled:bg-gold-300 text-dark-900 text-sm font-medium rounded-lg transition-colors"
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
              <div key={item.id || idx} className={`flex gap-3 p-4 rounded-lg ${item.tipo === 'ia_analysis' ? 'bg-violet-50 border border-violet-200' : 'bg-gray-50'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${TIPO_COLORS[item.tipo] || 'bg-gray-100 text-gray-700'}`}>
                      {item.tipo === 'ia_analysis' ? '✨ Análise IA' : item.tipo}
                    </span>
                    <span className="text-xs text-gray-400">{formatDateTime(item.data || item.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.conteudo}</p>
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
