import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/ui/StatusBadge';
import WhatsAppButton from '../components/ui/WhatsAppButton';
import LeadModal from '../components/Leads/LeadModal';

const STATUSES = ['novo', 'contatado', 'interessado', 'fechado'];

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCidade, setFilterCidade] = useState('');
  const [filterServico, setFilterServico] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    try {
      const res = await api.get('/leads');
      setLeads(res.data?.leads || res.data || []);
    } catch {
      setError('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditLead(null);
    setModalOpen(true);
  }

  function handleEdit(lead) {
    setEditLead(lead);
    setModalOpen(true);
  }

  function handleModalSuccess() {
    setModalOpen(false);
    fetchLeads();
  }

  const cidades = [...new Set(leads.map((l) => l.cidade).filter(Boolean))].sort();
  const servicos = [...new Set(leads.map((l) => l.servico).filter(Boolean))].sort();

  const filtered = leads.filter((l) => {
    const matchSearch = !search || l.nome?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || l.status === filterStatus;
    const matchCidade = !filterCidade || l.cidade === filterCidade;
    const matchServico = !filterServico || l.servico === filterServico;
    return matchSearch && matchStatus && matchCidade && matchServico;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterCidade, filterServico]);

  const selectClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} leads encontrados</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Lead
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="">Todos os status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={filterCidade} onChange={(e) => setFilterCidade(e.target.value)} className={selectClass}>
            <option value="">Todas as cidades</option>
            {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterServico} onChange={(e) => setFilterServico(e.target.value)} className={selectClass}>
            <option value="">Todos os serviços</option>
            {servicos.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Nenhum lead encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Nome', 'Telefone', 'Cidade', 'Serviço', 'Status', 'Origem', 'Data', 'Ações'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{lead.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{lead.telefone}</td>
                    <td className="px-4 py-3 text-gray-600">{lead.cidade || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{lead.servico || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{lead.origem || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(lead.createdAt || lead.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <WhatsAppButton telefone={lead.telefone} nome={lead.nome} />
                        <button
                          onClick={() => handleEdit(lead)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <LeadModal
          lead={editLead}
          onClose={() => setModalOpen(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
