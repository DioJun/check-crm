import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, Plus, Trash2, Eye, ExternalLink, MessageSquare, Loader2,
  Search, Clock, BarChart3, LayoutGrid, Filter,
} from 'lucide-react';
import api from '../services/api';

const STATUS_CONFIG = {
  gerado: { label: 'Gerado', cor: 'bg-blue-100 text-blue-700 border-blue-200', icone: '🆕' },
  enviado: { label: 'Enviado', cor: 'bg-purple-100 text-purple-700 border-purple-200', icone: '📤' },
  visualizado: { label: 'Visualizado', cor: 'bg-amber-100 text-amber-700 border-amber-200', icone: '👁️' },
  aprovado: { label: 'Aprovado', cor: 'bg-green-100 text-green-700 border-green-200', icone: '👍' },
  fechado: { label: 'Fechado', cor: 'bg-emerald-100 text-emerald-700 border-emerald-200', icone: '✅' },
  ignorado: { label: 'Ignorado', cor: 'bg-gray-100 text-gray-600 border-gray-200', icone: '🚫' },
};

const STATUS_ORDEM = ['gerado', 'enviado', 'visualizado', 'aprovado', 'fechado', 'ignorado'];

const TEMPLATE_CONFIG = {
  barbearia: { label: 'Barbearia', icone: '🪒' },
  restaurante: { label: 'Restaurante', icone: '🍕' },
  advocacia: { label: 'Advocacia', icone: '⚖️' },
  clinica: { label: 'Clínica', icone: '🦷' },
  personal: { label: 'Personal', icone: '💪' },
  loja: { label: 'Loja', icone: '🛍️' },
  servico: { label: 'Serviço geral', icone: '🧰' },
};

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const agora = new Date();
  const diffMin = Math.floor((agora - d) / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `${diffMin} min atrás`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h atrás`;
  return d.toLocaleDateString('pt-BR');
}

export default function SiteGallery() {
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTemplate, setFiltroTemplate] = useState('');

  async function loadSites() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busca) params.set('busca', busca);
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroTemplate) params.set('template', filtroTemplate);
      const res = await api.get(`/sites?${params.toString()}`);
      setSites(res.data?.sites || []);
    } catch (err) {
      setError('Erro ao carregar sites: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await api.get('/sites/stats');
      setStats(res.data);
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    loadSites();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus, filtroTemplate]);

  useEffect(() => {
    const t = setTimeout(() => loadSites(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  async function handleDelete(site) {
    if (!window.confirm(`Remover o site de demonstração de "${site.lead?.nome || site.nomeSite}"?`)) return;
    try {
      await api.delete(`/sites/${site.id}`);
      loadSites();
      loadStats();
    } catch (err) {
      setError('Erro ao remover: ' + (err.response?.data?.error || err.message));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 flex items-center gap-2">
            <Globe className="text-gold-700" /> Sites de demonstração
          </h1>
          <p className="text-sm text-dark-500">
            Sites de amostra gerados para leads. Apenas demonstração para vender o produto final.
          </p>
        </div>
        <button
          onClick={() => navigate('/sites/novo')}
          className="bg-gold-700 hover:bg-gold-800 text-white font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2"
        >
          <Plus size={18} /> Criar site
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
      )}

      {/* Resumo geral */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-dark-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-50 flex items-center justify-center">
              <LayoutGrid className="text-gold-700" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-900">{stats.total}</p>
              <p className="text-xs text-dark-500">sites criados</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-dark-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Eye className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-900">{stats.totalVisitas}</p>
              <p className="text-xs text-dark-500">visitas no total</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-dark-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <BarChart3 className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-900">{stats.porStatus?.visualizado || 0}</p>
              <p className="text-xs text-dark-500">visualizados</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-dark-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Clock className="text-emerald-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-900">{(stats.porStatus?.aprovado || 0) + (stats.porStatus?.fechado || 0)}</p>
              <p className="text-xs text-dark-500">aprovados + fechados</p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-dark-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 text-dark-400" size={16} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por lead ou site..."
              className="w-full border border-dark-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-dark-500">
            <Filter size={14} /> Status:
          </div>
          {STATUS_ORDEM.map((key) => (
            <button
              key={key}
              onClick={() => setFiltroStatus(filtroStatus === key ? '' : key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                filtroStatus === key ? 'border-gold-600 bg-gold-50 text-gold-800' : 'border-dark-300 text-dark-600 hover:bg-dark-50'
              }`}
            >
              {STATUS_CONFIG[key].icone} {STATUS_CONFIG[key].label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-dark-500">
            <LayoutGrid size={14} /> Template:
          </div>
          <button
            onClick={() => setFiltroTemplate('')}
            className={`px-3 py-1 rounded-lg text-xs border transition ${!filtroTemplate ? 'border-gold-600 bg-gold-50 text-gold-800' : 'border-dark-300 text-dark-600 hover:bg-dark-50'}`}
          >
            Todos
          </button>
          {Object.entries(TEMPLATE_CONFIG).map(([id, cfg]) => (
            <button
              key={id}
              onClick={() => setFiltroTemplate(filtroTemplate === id ? '' : id)}
              className={`px-3 py-1 rounded-lg text-xs border transition ${
                filtroTemplate === id ? 'border-gold-600 bg-gold-50 text-gold-800' : 'border-dark-300 text-dark-600 hover:bg-dark-50'
              }`}
            >
              {cfg.icone} {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-gold-700" size={28} />
        </div>
      ) : sites.length === 0 ? (
        <div className="bg-white border border-dashed border-dark-300 rounded-xl p-10 text-center text-dark-500">
          <Globe className="mx-auto mb-2 opacity-40" size={40} />
          <p className="font-medium">Nenhum site de demonstração encontrado.</p>
          <p className="text-sm">Clique em "Criar site" para gerar a primeira demo ou ajuste os filtros.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => {
            const st = STATUS_CONFIG[site.status] || STATUS_CONFIG.gerado;
            const tpl = TEMPLATE_CONFIG[site.template] || { icone: '🧰', label: site.template };
            return (
              <div key={site.id} className="bg-white rounded-xl border border-dark-200 p-4 flex flex-col gap-3 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-dark-900 truncate">{site.nomeSite || site.lead?.nome}</h3>
                    <p className="text-xs text-dark-500 truncate">
                      {tpl.icone} {tpl.label} · {site.lead?.nome}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${st.cor}`}>
                    {st.icone} {st.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-dark-500">
                  <span className="flex items-center gap-1"><Eye size={14} /> {site._count?.visitas || 0} visitas</span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: site.cor }} /> {site.cor}
                  </span>
                </div>

                {/* Última visita / criação */}
                <div className="text-xs text-dark-400 space-y-0.5">
                  {site.ultimaVisita && (
                    <p className="flex items-center gap-1">
                      <Clock size={13} /> Última visita: {formatarData(site.ultimaVisita)}
                    </p>
                  )}
                  <p>Criado: {formatarData(site.createdAt)}</p>
                </div>

                {site.link && (
                  <a
                    href={site.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gold-700 hover:underline flex items-center gap-1 truncate"
                  >
                    <ExternalLink size={14} /> {site.link}
                  </a>
                )}

                <div className="flex gap-2 mt-auto pt-2 border-t border-dark-100">
                  <button
                    onClick={() => navigate(`/sites/${site.id}/editar`)}
                    className="flex-1 text-center text-sm bg-dark-100 hover:bg-dark-200 text-dark-700 rounded-lg px-3 py-1.5"
                  >
                    Editar
                  </button>
                  {site.lead?.telefone && (
                    <a
                      href={`https://wa.me/${site.lead.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Olá ${site.lead.nome}! Criei um site de demonstração para o seu negócio. Dá uma olhada: ${site.link || '(link em breve)'}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 text-center text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg px-3 py-1.5 flex items-center justify-center gap-1"
                    >
                      <MessageSquare size={14} /> Enviar
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(site)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                    title="Remover"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
