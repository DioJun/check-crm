import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Globe, Sparkles, ArrowLeft, Loader2, CheckCircle2, RefreshCw, MessageSquareText } from 'lucide-react';
import api from '../services/api';

// Cores sugeridas para o formulário
const CORES = [
  { hex: '#d4af37', nome: 'Dourado' },
  { hex: '#2563eb', nome: 'Azul' },
  { hex: '#059669', nome: 'Verde' },
  { hex: '#e11d48', nome: 'Vermelho' },
  { hex: '#7c3aed', nome: 'Roxo' },
  { hex: '#0f172a', nome: 'Escuro' },
  { hex: '#f59e0b', nome: 'Âmbar' },
  { hex: '#14b8a6', nome: 'Teal' },
];

// Sugestões rápidas para o campo de instruções
const SUGESTOES = [
  { texto: 'Foco em agendamento pelo WhatsApp e preços visíveis', icone: '📅' },
  { texto: 'Sou especializado em serviços premium, destaque qualidade e atendimento personalizado', icone: '⭐' },
  { texto: 'Quero seções: sobre, serviços, depoimentos e contato. Tom acolhedor', icone: '🧩' },
  { texto: 'Público jovem, tom descontraído e moderno, botões chamativos', icone: '🔥' },
];

export default function SiteCreator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetLeadId = searchParams.get('leadId');

  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tons, setTons] = useState([]);

  const [form, setForm] = useState({
    leadId: presetLeadId || '',
    template: '',
    cor: '#d4af37',
    tom: 'moderno',
    nomeSite: '',
    instrucoes: '',
  });

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [tRes, lRes] = await Promise.all([
          api.get('/sites/templates'),
          api.get('/leads'),
        ]);
        const tData = tRes.data?.templates || [];
        setTemplates(tData);
        setTons(tRes.data?.tons || []);
        const lData = lRes.data?.leads || lRes.data || [];
        setLeads(lData);
        if (!presetLeadId && lData.length > 0) {
          setForm((f) => ({ ...f, leadId: lData[0].id }));
        }
      } catch (err) {
        setError('Erro ao carregar dados: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [presetLeadId]);

  function handleChange(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (campo === 'leadId') {
      const lead = leads.find((l) => l.id === valor);
      if (lead) {
        setForm((f) => ({ ...f, leadId: valor, nomeSite: lead.nome ? lead.nome.split(' ')[0] : '' }));
      }
    }
  }

  async function handleCreate() {
    setError('');
    if (!form.leadId) {
      setError('Selecione um lead para criar o site de demonstração.');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/sites', {
        leadId: form.leadId,
        template: form.template || undefined,
        cor: form.cor,
        tom: form.tom,
        nomeSite: form.nomeSite || undefined,
        instrucoes: form.instrucoes?.trim() || undefined,
      });
      const site = res.data?.site;
      setCreated(site);
      setTimeout(() => navigate(`/sites/${site.id}/editar`), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar site');
    } finally {
      setCreating(false);
    }
  }

  const leadSelecionado = leads.find((l) => l.id === form.leadId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-dark-100 text-dark-500"
          title="Voltar"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-dark-900 flex items-center gap-2">
            <Globe className="text-gold-700" /> Criar site de demonstração
          </h1>
          <p className="text-sm text-dark-500">
            Gere uma landing page de amostra para vender o site profissional. É apenas demonstração — não o produto final.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
      )}

      {created ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="mx-auto text-green-600 mb-2" size={40} />
          <h2 className="text-lg font-semibold text-green-800">Site criado com sucesso!</h2>
          <p className="text-green-700 mt-1">Redirecionando para o editor...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Coluna 1-2: formulário */}
          <div className="md:col-span-2 bg-white rounded-xl border border-dark-200 p-6 space-y-5">
            {/* Seleção de lead */}
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Lead *</label>
              <select
                value={form.leadId}
                onChange={(e) => handleChange('leadId', e.target.value)}
                className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                <option value="">Selecione um lead...</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome} {l.servico ? `— ${l.servico}` : ''}
                  </option>
                ))}
              </select>
              {leadSelecionado && (
                <div className="mt-2 text-xs text-dark-500 bg-dark-50 rounded-lg p-2">
                  💡 Perfil: {leadSelecionado.servico || 'sem serviço'} · {leadSelecionado.cidade || 'sem cidade'}
                  {leadSelecionado.instagram ? ` · ${leadSelecionado.instagram}` : ''}
                </div>
              )}
            </div>

            {/* Nome do site */}
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Nome do site</label>
              <input
                value={form.nomeSite}
                onChange={(e) => handleChange('nomeSite', e.target.value)}
                placeholder="Ex: Barbearia do João"
                className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>

            {/* Chat de instruções para a IA */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4 space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                <MessageSquareText className="text-violet-600" size={18} />
                Instruções para a IA (opcional)
              </label>
              <p className="text-xs text-violet-600">
                Descreva como você quer o site. A IA segue essas instruções com <strong>prioridade máxima</strong> sobre o resto.
              </p>
              <textarea
                value={form.instrucoes}
                onChange={(e) => handleChange('instrucoes', e.target.value)}
                rows={3}
                placeholder="Ex: Sou uma clínica de podologia, quero seções de avaliação, tratamento de unhas e depoimentos. Tom acolhedor, destaque o agendamento pelo WhatsApp..."
                className="w-full border border-violet-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {SUGESTOES.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleChange('instrucoes', (form.instrucoes ? form.instrucoes + ' ' : '') + s.texto)}
                    className="text-xs bg-white border border-violet-200 text-violet-700 rounded-full px-2.5 py-1 hover:bg-violet-100 transition"
                  >
                    {s.icone} {s.texto.slice(0, 38)}{s.texto.length > 38 ? '…' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Template/ramo */}
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Ramo / Template</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleChange('template', form.template === t.id ? '' : t.id)}
                    className={`text-left rounded-lg border px-3 py-2 text-sm transition ${
                      form.template === t.id
                        ? 'border-gold-600 bg-gold-50 text-gold-800'
                        : 'border-dark-300 hover:border-gold-400'
                    }`}
                  >
                    <span className="mr-1">{t.icone}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-dark-500 mt-1">Deixe em branco para detectar automaticamente pelo perfil do lead.</p>
            </div>

            {/* Cor */}
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Cor principal</label>
              <div className="flex flex-wrap gap-2 items-center">
                {CORES.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => handleChange('cor', c.hex)}
                    className={`w-9 h-9 rounded-full border-2 transition ${
                      form.cor === c.hex ? 'border-dark-900 scale-110' : 'border-dark-200'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.nome}
                  />
                ))}
                <input
                  type="color"
                  value={form.cor}
                  onChange={(e) => handleChange('cor', e.target.value)}
                  className="w-9 h-9 rounded cursor-pointer"
                  title="Cor personalizada"
                />
                <span className="text-xs font-mono text-dark-500">{form.cor}</span>
              </div>
            </div>

            {/* Tom */}
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Tom da comunicação</label>
              <div className="flex gap-2">
                {tons.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleChange('tom', t)}
                    className={`rounded-lg px-4 py-2 text-sm capitalize transition ${
                      form.tom === t
                        ? 'bg-gold-700 text-white'
                        : 'bg-dark-100 text-dark-700 hover:bg-dark-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna 3: resumo + ação */}
          <div className="bg-white rounded-xl border border-dark-200 p-6 h-fit space-y-4">
            <h3 className="font-semibold text-dark-900 flex items-center gap-2">
              <Sparkles className="text-gold-700" size={18} /> Resumo da demo
            </h3>
            <div className="text-sm space-y-2 text-dark-600">
              <p><strong>Lead:</strong> {leadSelecionado?.nome || '—'}</p>
              <p><strong>Ramo:</strong> {templates.find((t) => t.id === form.template)?.label || 'Detecção automática'}</p>
              <p><strong>Nome:</strong> {form.nomeSite || 'A partir do lead'}</p>
              <p><strong>Cor:</strong> <span className="inline-block w-3 h-3 rounded-full align-middle" style={{ backgroundColor: form.cor }} /> {form.cor}</p>
              <p><strong>Tom:</strong> {form.tom}</p>
              {form.instrucoes?.trim() && (
                <p className="text-violet-700 bg-violet-50 border border-violet-200 rounded-lg p-2 text-xs">
                  <MessageSquareText size={12} className="inline align-[-1px]" /> IA seguirá suas instruções: <em>{form.instrucoes.slice(0, 80)}{form.instrucoes.length > 80 ? '…' : ''}</em>
                </p>
              )}
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full bg-gold-700 hover:bg-gold-800 text-white font-semibold rounded-lg px-4 py-2.5 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Criando...
                </>
              ) : (
                <>
                  <RefreshCw size={18} /> Gerar site de demonstração
                </>
              )}
            </button>
            <p className="text-xs text-dark-500 text-center">
              O site de amostra será salvo e poderá ser editado e publicado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
