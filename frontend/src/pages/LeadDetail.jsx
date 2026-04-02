import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Phone, StickyNote, ExternalLink, Edit2, Check, X } from 'lucide-react';
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

  useEffect(() => {
    Promise.all([
      api.get(`/leads/${id}`),
      api.get(`/interactions/${id}`),
    ]).then(([leadRes, interRes]) => {
      setLead(leadRes.data?.lead || leadRes.data);
      const lead = leadRes.data?.lead || leadRes.data;
      
      // Inicializar form de edição
      setEditForm({
        site: lead?.site || '',
        temWhatsapp: lead?.temWhatsapp || false,
        temSite: lead?.temSite || false,
      });
      
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
          <div className="space-y-3">
            <InfoItemWithLink 
              label="Site" 
              value={lead?.site}
            />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">WhatsApp:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lead?.temWhatsapp ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                {lead?.temWhatsapp ? '✓ Sim' : '✗ Não'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Site:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lead?.temSite ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                {lead?.temSite ? '✓ Sim' : '✗ Não'}
              </span>
            </div>
            {lead?.avaliacao && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Avaliação:</span>
                <span className="text-yellow-600 font-medium">⭐ {lead.avaliacao}</span>
                {lead?.reviews && <span className="text-gray-500">({lead.reviews})</span>}
              </div>
            )}
          </div>
        )}

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

function InfoItemWithLink({ label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">{label}:</span>
      {value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 break-all"
        >
          <span className="truncate">{value}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      ) : (
        <span className="text-gray-400">-</span>
      )}
    </div>
  );
}
