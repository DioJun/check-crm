import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Save, Loader2, ExternalLink, Eye,
  Sparkles, PenLine, Plus, Trash2, Wand2, CheckCircle2, Rocket, Link2, GitBranch,
  ClipboardList, FileText, Handshake, Copy,
} from 'lucide-react';
import api from '../services/api';

const STATUS_OPCOES = [
  { value: 'gerado', label: 'Gerado' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'visualizado', label: 'Visualizado' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'fechado', label: 'Fechado' },
  { value: 'ignorado', label: 'Ignorado' },
];

// Campos de texto editáveis do conteúdo
const CAMPOS_TEXTO = [
  { chave: 'heroTitulo', label: 'Título principal (hero)', tipo: 'text' },
  { chave: 'heroSub', label: 'Subtítulo do hero', tipo: 'textarea' },
  { chave: 'heroCta', label: 'Texto do botão do hero', tipo: 'text' },
  { chave: 'servicosTitulo', label: 'Título da seção de serviços', tipo: 'text' },
  { chave: 'servicosSub', label: 'Subtítulo de serviços', tipo: 'text' },
  { chave: 'sobreTitulo', label: 'Título da seção "Sobre"', tipo: 'text' },
  { chave: 'sobreTexto', label: 'Texto da seção "Sobre"', tipo: 'textarea' },
  { chave: 'ctaTitulo', label: 'Título do CTA final', tipo: 'text' },
  { chave: 'ctaTexto', label: 'Texto do CTA final', tipo: 'text' },
  { chave: 'ctaBotao', label: 'Botão do CTA final', tipo: 'text' },
  { chave: 'waMensagem', label: 'Mensagem do WhatsApp', tipo: 'textarea' },
];

export default function SiteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);

  // Conteúdo editável (overrides)
  const [conteudo, setConteudo] = useState(null);
  const [usouIA, setUsouIA] = useState(false);
  const [avisoIA, setAvisoIA] = useState('');
  const [abas, setAbas] = useState('geral'); // geral | conteudo | preview

  // Publicação (Vercel)
  const [publicando, setPublicando] = useState(false);
  const [publicadoMsg, setPublicadoMsg] = useState('');

  // GitHub (backup)
  const [ghEnviando, setGhEnviando] = useState(false);
  const [ghMsg, setGhMsg] = useState('');

  // Tracking / aprovação
  const [marcandoVisita, setMarcandoVisita] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [trackingMsg, setTrackingMsg] = useState('');

  // Fechamento
  const [briefing, setBriefing] = useState(null);
  const [salvandoBriefing, setSalvandoBriefing] = useState(false);
  const [gerandoProposta, setGerandoProposta] = useState(false);
  const [gerandoContrato, setGerandoContrato] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [propostaTexto, setPropostaTexto] = useState('');
  const [contratoTexto, setContratoTexto] = useState('');
  const [copiedDoc, setCopiedDoc] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/sites/${id}`);
        const s = res.data?.site;
        setSite(s);
        setForm({
          nomeSite: s.nomeSite || '',
          status: s.status || 'gerado',
          cor: s.cor || '#d4af37',
          tom: s.tom || 'moderno',
          link: s.link || '',
          observacoes: s.observacoes || '',
          instrucoes: s.instrucoes || '',
        });

        // Carregar conteúdo editável salvo
        try {
          const cRes = await api.get(`/sites/${id}/conteudo`);
          setConteudo(cRes.data?.overrides || {});
        } catch { setConteudo({}); }

        // Carregar briefing do fechamento
        try {
          const bRes = await api.get(`/sites/${id}/briefing`);
          setBriefing(bRes.data?.briefing || {});
        } catch { setBriefing({}); }

        // Se já tem HTML salvo, mostra preview
        setPreviewUrl(`/sites/${id}/preview?t=${Date.now()}`);
      } catch (err) {
        setError('Erro ao carregar site: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/sites/${id}`, form);
      setSite((s) => ({ ...s, ...form }));
    } catch (err) {
      setError('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }

  // Renderiza com IA (regenera o conteúdo)
  async function handleRenderIA() {
    setRendering(true);
    setError('');
    try {
      await api.put(`/sites/${id}`, form);
      const res = await api.post(`/sites/${id}/render`, { usarIA: true });
      setUsouIA(res.data?.usouIA);
      setAvisoIA(res.data?.aviso || '');
      setConteudo(res.data?.overrides || {});
      setPreviewUrl(`/sites/${id}/preview?t=${Date.now()}`);
    } catch (err) {
      setError('Erro ao renderizar: ' + (err.response?.data?.error || err.message));
    } finally {
      setRendering(false);
    }
  }

  // Salva o conteúdo editado manualmente e re-renderiza
  async function handleSalvarConteudo() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/sites/${id}`, form);
      const res = await api.post(`/sites/${id}/render`, { overrides: conteudo });
      setUsouIA(false);
      setAvisoIA(res.data?.aviso || 'Conteúdo editado manualmente.');
      setPreviewUrl(`/sites/${id}/preview?t=${Date.now()}`);
    } catch (err) {
      setError('Erro ao salvar conteúdo: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }

  // Publica no Vercel (deploy direto)
  async function handlePublicar() {
    setPublicando(true);
    setError('');
    setPublicadoMsg('');
    try {
      // Salva configurações atuais antes de publicar
      await api.put(`/sites/${id}`, form);
      const res = await api.post(`/sites/${id}/publicar`, {});
      setPublicadoMsg(res.data?.mensagem || 'Site publicado!');
      setForm((f) => ({ ...f, link: res.data?.link || f.link, status: 'enviado' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao publicar. Verifique o token do Vercel em Configurações.');
    } finally {
      setPublicando(false);
    }
  }

  // Envia o código para o GitHub (backup)
  async function handleEnviarGitHub() {
    setGhEnviando(true);
    setError('');
    setGhMsg('');
    try {
      await api.put(`/sites/${id}`, form);
      const res = await api.post(`/sites/${id}/github`, {});
      setGhMsg(res.data?.message || 'Código salvo no GitHub!');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao enviar para o GitHub. Verifique o token em Configurações.');
    } finally {
      setGhEnviando(false);
    }
  }

  // Marca o site como visualizado (tracking manual quando não há beacon público)
  async function handleMarcarVisto() {
    setMarcandoVisita(true);
    setError('');
    setTrackingMsg('');
    try {
      const res = await api.post(`/sites/${id}/visita`, { origem: 'manual' });
      setForm((f) => ({ ...f, status: res.data?.status || f.status }));
      setTrackingMsg(`✅ Visita registrada! O lead visualizou o site (${res.data?.visualizacoes || 1}ª visita).`);
    } catch (err) {
      setError('Erro ao registrar visita: ' + (err.response?.data?.error || err.message));
    } finally {
      setMarcandoVisita(false);
    }
  }

  // Aprova o site (lead aprovou a demo → inicia fechamento)
  async function handleAprovar() {
    setAprovando(true);
    setError('');
    setTrackingMsg('');
    try {
      const res = await api.post(`/sites/${id}/aprovar`, {});
      setForm((f) => ({ ...f, status: res.data?.site?.status || 'aprovado' }));
      setTrackingMsg('👍 Site aprovado! Alerta de fechamento disparado no CRM.');
    } catch (err) {
      setError('Erro ao aprovar: ' + (err.response?.data?.error || err.message));
    } finally {
      setAprovando(false);
    }
  }

  // Salva o briefing do site final
  async function handleSalvarBriefing() {
    setSalvandoBriefing(true);
    setError('');
    try {
      const res = await api.put(`/sites/${id}/briefing`, briefing);
      setBriefing(res.data?.briefing || briefing);
      setTrackingMsg('📋 Briefing do site final salvo!');
    } catch (err) {
      setError('Erro ao salvar briefing: ' + (err.response?.data?.error || err.message));
    } finally {
      setSalvandoBriefing(false);
    }
  }

  // Gera a proposta comercial
  async function handleGerarProposta() {
    setGerandoProposta(true);
    setError('');
    setPropostaTexto('');
    try {
      const res = await api.post(`/sites/${id}/proposta`, {});
      setPropostaTexto(res.data?.proposta || '');
      setTrackingMsg('📝 Proposta gerada! Copie e envie para o lead.');
    } catch (err) {
      setError('Erro ao gerar proposta: ' + (err.response?.data?.error || err.message));
    } finally {
      setGerandoProposta(false);
    }
  }

  // Gera o contrato
  async function handleGerarContrato() {
    setGerandoContrato(true);
    setError('');
    setContratoTexto('');
    try {
      const res = await api.post(`/sites/${id}/contrato`, {});
      setContratoTexto(res.data?.contrato || '');
      setTrackingMsg('📄 Contrato gerado! Copie e imprima para assinatura.');
    } catch (err) {
      setError('Erro ao gerar contrato: ' + (err.response?.data?.error || err.message));
    } finally {
      setGerandoContrato(false);
    }
  }

  // Fecha a venda
  async function handleFechar() {
    if (!window.confirm('Confirmar o fechamento desta venda?')) return;
    setFechando(true);
    setError('');
    try {
      await api.post(`/sites/${id}/fechar`, {});
      setForm((f) => ({ ...f, status: 'fechado' }));
      setTrackingMsg('✅ Venda fechada! Site marcado como FECHADO.');
    } catch (err) {
      setError('Erro ao fechar: ' + (err.response?.data?.error || err.message));
    } finally {
      setFechando(false);
    }
  }

  function copyDoc(tipo, texto) {
    navigator.clipboard.writeText(texto);
    setCopiedDoc(tipo);
    setTimeout(() => setCopiedDoc(''), 2000);
  }

  function updateCampo(chave, valor) {
    setConteudo((c) => ({ ...c, [chave]: valor }));
  }  function updateServico(idx, campo, valor) {
    setConteudo((c) => {
      const servicos = [...(c.servicos || [])];
      if (!servicos[idx]) servicos[idx] = { icone: '⭐', nome: '', desc: '', preco: '' };
      servicos[idx] = { ...servicos[idx], [campo]: valor };
      return { ...c, servicos };
    });
  }

  function addServico() {
    setConteudo((c) => ({
      ...c,
      servicos: [...(c.servicos || []), { icone: '⭐', nome: 'Novo serviço', desc: '', preco: '' }],
    }));
  }

  function removeServico(idx) {
    setConteudo((c) => ({ ...c, servicos: (c.servicos || []).filter((_, i) => i !== idx) }));
  }

  function updateDepoimento(idx, campo, valor) {
    setConteudo((c) => {
      const depoimentos = [...(c.depoimentos || [])];
      if (!depoimentos[idx]) depoimentos[idx] = { texto: '', autor: '' };
      depoimentos[idx] = { ...depoimentos[idx], [campo]: valor };
      return { ...c, depoimentos };
    });
  }

  function addDepoimento() {
    setConteudo((c) => ({ ...c, depoimentos: [...(c.depoimentos || []), { texto: '', autor: '' }] }));
  }

  function removeDepoimento(idx) {
    setConteudo((c) => ({ ...c, depoimentos: (c.depoimentos || []).filter((_, i) => i !== idx) }));
  }

  function updateSelo(idx, valor) {
    setConteudo((c) => {
      const selos = [...(c.selos || [])];
      selos[idx] = valor;
      return { ...c, selos };
    });
  }

  function addSelo() {
    setConteudo((c) => ({ ...c, selos: [...(c.selos || []), ''] }));
  }

  function removeSelo(idx) {
    setConteudo((c) => ({ ...c, selos: (c.selos || []).filter((_, i) => i !== idx) }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-gold-700" size={28} />
      </div>
    );
  }

  if (error && !site) {
    return <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>;
  }

  const inputCls = 'w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500';

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/sites')}
          className="p-2 rounded-lg hover:bg-dark-100 text-dark-500"
          title="Voltar"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark-900 flex items-center gap-2">
            <Globe className="text-gold-700" /> {form?.nomeSite || 'Site de demonstração'}
          </h1>
          <p className="text-sm text-dark-500">
            Lead: {site?.lead?.nome} · {site?.ramo || site?.template}
          </p>
        </div>
        <button
          onClick={handleEnviarGitHub}
          disabled={ghEnviando}
          className="bg-dark-800 hover:bg-dark-700 text-white font-semibold rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
          title="Salvar o código do site no GitHub (backup)"
        >
          {ghEnviando ? <Loader2 className="animate-spin" size={18} /> : <GitBranch size={18} />} GitHub
        </button>
        <button
          onClick={handlePublicar}
          disabled={publicando}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
          title="Publicar o site de demonstração no Vercel"
        >
          {publicando ? <Loader2 className="animate-spin" size={18} /> : <Rocket size={18} />} Publicar no Vercel
        </button>
        <button
          onClick={handleRenderIA}
          disabled={rendering}
          className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
          title="Regenerar o conteúdo com IA"
        >
          {rendering ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />} Regenerar com IA
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gold-700 hover:bg-gold-800 text-white font-semibold rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
      )}

      {/* Banner de publicação */}
      {publicadoMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="text-green-600 mt-0.5" size={18} />
            <div>
              <p className="font-medium">{publicadoMsg}</p>
              {form.link && (
                <a href={form.link} target="_blank" rel="noreferrer" className="text-sm text-gold-700 hover:underline flex items-center gap-1 mt-1">
                  <Link2 size={14} /> {form.link}
                </a>
              )}
            </div>
          </div>
          <button onClick={() => setPublicadoMsg('')} className="text-green-500 hover:text-green-700 text-sm">✕</button>
        </div>
      )}

      {/* Banner GitHub */}
      {ghMsg && (
        <div className="bg-dark-50 border border-dark-200 text-dark-800 rounded-lg p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <GitBranch className="text-dark-700 mt-0.5" size={18} />
            <p className="text-sm font-medium">{ghMsg}</p>
          </div>
          <button onClick={() => setGhMsg('')} className="text-dark-400 hover:text-dark-600 text-sm">✕</button>
        </div>
      )}

      {/* Badge de status da geração */}
      {(usouIA || avisoIA) && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border ${
          usouIA
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          {usouIA ? <Sparkles className="text-green-600" size={16} /> : <CheckCircle2 className="text-amber-600" size={16} />}
          {usouIA ? 'Conteúdo gerado pela IA ✨ — personalize abaixo ou regenere.' : (avisoIA || 'Conteúdo editado manualmente.')}
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-2 border-b border-dark-200 pb-px">
        <button
          onClick={() => setAbas('geral')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${abas === 'geral' ? 'border-gold-600 text-gold-700' : 'border-transparent text-dark-500 hover:text-dark-700'}`}
        >
          ⚙️ Configurações
        </button>
        <button
          onClick={() => setAbas('conteudo')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${abas === 'conteudo' ? 'border-gold-600 text-gold-700' : 'border-transparent text-dark-500 hover:text-dark-700'}`}
        >
          ✏️ Editar conteúdo
        </button>
        <button
          onClick={() => setAbas('preview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${abas === 'preview' ? 'border-gold-600 text-gold-700' : 'border-transparent text-dark-500 hover:text-dark-700'}`}
        >
          👁️ Preview
        </button>
        <button
          onClick={() => setAbas('fechamento')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${abas === 'fechamento' ? 'border-gold-600 text-gold-700' : 'border-transparent text-dark-500 hover:text-dark-700'}`}
        >
          🤝 Fechamento
        </button>
      </div>

      {/* ============ ABA: Configurações ============ */}
      {abas === 'geral' && (
        <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-4">
          <h3 className="font-semibold text-dark-900">Configurações básicas</h3>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Nome do site</label>
            <input
              value={form.nomeSite}
              onChange={(e) => setForm((f) => ({ ...f, nomeSite: e.target.value }))}
              className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              {STATUS_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Cor principal</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.cor}
                  onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <span className="text-xs font-mono text-dark-500">{form.cor}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Tom</label>
              <select
                value={form.tom}
                onChange={(e) => setForm((f) => ({ ...f, tom: e.target.value }))}
                className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                <option value="moderno">Moderno</option>
                <option value="formal">Formal</option>
                <option value="divertido">Divertido</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Link de publicação</label>
            <input
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              placeholder="https://demo-joao.vercel.app"
              className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
            {form.link && (
              <a href={form.link} target="_blank" rel="noreferrer" className="text-xs text-gold-700 hover:underline flex items-center gap-1 mt-1">
                <ExternalLink size={14} /> Abrir site
              </a>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              rows={3}
              className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
              placeholder="Anotações sobre esta demonstração..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-violet-900 mb-1">Instruções para a IA</label>
            <textarea
              value={form.instrucoes}
              onChange={(e) => setForm((f) => ({ ...f, instrucoes: e.target.value }))}
              rows={3}
              className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Como a IA deve gerar este site (prioridade máxima)..."
            />
            <p className="text-xs text-violet-500 mt-1">Usadas ao regenerar o site com a IA.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-4 h-fit">
          <h3 className="font-semibold text-dark-900">Dados do lead</h3>
          <div className="text-sm space-y-2 text-dark-600">
            <p><strong>Nome:</strong> {site?.lead?.nome || '—'}</p>
            <p><strong>Telefone:</strong> {site?.lead?.telefone || '—'}</p>
            <p><strong>Serviço:</strong> {site?.lead?.servico || '—'}</p>
            <p><strong>Cidade:</strong> {site?.lead?.cidade || '—'}</p>
            <p><strong>Instagram:</strong> {site?.lead?.instagram || '—'}</p>
            <p><strong>Visitas:</strong> {site?.visitas?.length || 0}</p>
            <p><strong>Criado em:</strong> {site?.createdAt ? new Date(site.createdAt).toLocaleString('pt-BR') : '—'}</p>
          </div>
          <div className="pt-3 border-t border-dark-100 text-xs text-dark-500">
            ⚠️ Este é um site de <strong>demonstração</strong> para vender o produto final.
          </div>

          {/* Ações de venda (tracking + aprovação) */}
          <div className="pt-3 border-t border-dark-100 space-y-2">
            <h4 className="text-sm font-semibold text-dark-900">Ações de venda</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleMarcarVisto}
                disabled={marcandoVisita}
                className="flex-1 text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg px-3 py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Registrar que o lead viu o site (dispara alerta no CRM)"
              >
                {marcandoVisita ? <Loader2 className="animate-spin" size={15} /> : <Eye size={15} />} Marcar como visto
              </button>
              <button
                onClick={handleAprovar}
                disabled={aprovando || form?.status === 'aprovado'}
                className="flex-1 text-sm bg-green-100 hover:bg-green-200 text-green-800 rounded-lg px-3 py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Lead aprovou a demo → inicia fluxo de fechamento"
              >
                {aprovando ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                {form?.status === 'aprovado' ? 'Aprovado ✓' : 'Aprovar demo'}
              </button>
            </div>
            {trackingMsg && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">{trackingMsg}</p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ============ ABA: Editar conteúdo ============ */}
      {abas === 'conteudo' && (
        <div className="space-y-6">
          {/* Botão salvar conteúdo */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-dark-200 p-4">
            <div className="text-sm text-dark-600">
              <strong className="text-dark-900">Edição do conteúdo</strong> — personaliza os textos, serviços e depoimentos do site.
              <p className="text-xs text-dark-500 mt-1">Ao salvar, o site é re-renderizado com suas edições (sem usar a IA novamente).</p>
            </div>
            <button
              onClick={handleSalvarConteudo}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <PenLine size={18} />} Salvar e re-renderizar
            </button>
          </div>

          {/* Textos principais */}
          <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-4">
            <h3 className="font-semibold text-dark-900">Textos principais</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {CAMPOS_TEXTO.map((campo) => (
                <div key={campo.chave} className={campo.tipo === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-dark-700 mb-1">{campo.label}</label>
                  {campo.tipo === 'textarea' ? (
                    <textarea
                      value={conteudo?.[campo.chave] || ''}
                      onChange={(e) => updateCampo(campo.chave, e.target.value)}
                      rows={3}
                      className={inputCls}
                    />
                  ) : (
                    <input
                      value={conteudo?.[campo.chave] || ''}
                      onChange={(e) => updateCampo(campo.chave, e.target.value)}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Serviços */}
          <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-dark-900">Serviços / Produtos</h3>
              <button onClick={addServico} className="text-sm bg-dark-100 hover:bg-dark-200 text-dark-700 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {(conteudo?.servicos || []).length === 0 ? (
              <p className="text-sm text-dark-400">Nenhum serviço. Use "Regenerar com IA" ou adicione manualmente.</p>
            ) : (
              <div className="space-y-4">
                {conteudo.servicos.map((s, idx) => (
                  <div key={idx} className="border border-dark-200 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={s.icone || ''}
                        onChange={(e) => updateServico(idx, 'icone', e.target.value)}
                        className="w-14 border border-dark-300 rounded-lg px-2 py-1.5 text-sm text-center"
                        placeholder="😀"
                      />
                      <input
                        value={s.nome || ''}
                        onChange={(e) => updateServico(idx, 'nome', e.target.value)}
                        className={inputCls}
                        placeholder="Nome do serviço"
                      />
                      <input
                        value={s.preco || ''}
                        onChange={(e) => updateServico(idx, 'preco', e.target.value)}
                        className="w-32 border border-dark-300 rounded-lg px-2 py-1.5 text-sm"
                        placeholder="R$ 00"
                      />
                      <button onClick={() => removeServico(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Remover">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <input
                      value={s.desc || ''}
                      onChange={(e) => updateServico(idx, 'desc', e.target.value)}
                      className={inputCls}
                      placeholder="Descrição curta"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selos */}
          <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-dark-900">Selos de destaque</h3>
              <button onClick={addSelo} className="text-sm bg-dark-100 hover:bg-dark-200 text-dark-700 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(conteudo?.selos || []).map((selo, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-dark-50 rounded-lg px-2 py-1">
                  <input
                    value={selo}
                    onChange={(e) => updateSelo(idx, e.target.value)}
                    className="bg-transparent border-b border-dark-300 focus:border-gold-500 outline-none text-sm px-1 py-0.5 w-40"
                  />
                  <button onClick={() => removeSelo(idx)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Depoimentos */}
          <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-dark-900">Depoimentos</h3>
              <button onClick={addDepoimento} className="text-sm bg-dark-100 hover:bg-dark-200 text-dark-700 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {(conteudo?.depoimentos || []).length === 0 ? (
              <p className="text-sm text-dark-400">Nenhum depoimento.</p>
            ) : (
              <div className="space-y-3">
                {conteudo.depoimentos.map((d, idx) => (
                  <div key={idx} className="border border-dark-200 rounded-lg p-4 space-y-2">
                    <textarea
                      value={d.texto || ''}
                      onChange={(e) => updateDepoimento(idx, 'texto', e.target.value)}
                      rows={2}
                      className={inputCls}
                      placeholder="Texto do depoimento..."
                    />
                    <div className="flex items-center gap-2">
                      <input
                        value={d.autor || ''}
                        onChange={(e) => updateDepoimento(idx, 'autor', e.target.value)}
                        className="w-48 border border-dark-300 rounded-lg px-3 py-1.5 text-sm"
                        placeholder="Autor (ex: Maria S.)"
                      />
                      <button onClick={() => removeDepoimento(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ ABA: Preview ============ */}
      {abas === 'preview' && (
        <div className="bg-white rounded-xl border border-dark-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-100">
            <h3 className="font-semibold text-dark-900 flex items-center gap-2">
              <Eye className="text-blue-600" size={18} /> Pré-visualização do site
            </h3>
            <a
              href={`${api.defaults.baseURL}${previewUrl}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink size={14} /> Abrir em nova aba
            </a>
          </div>
          {previewUrl ? (
            <iframe
              src={`${api.defaults.baseURL}${previewUrl}`}
              title="Pré-visualização do site de demonstração"
              className="w-full h-[520px] bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          ) : (
            <div className="p-10 text-center text-dark-400 text-sm">
              Clique em "Regenerar com IA" para gerar o site e ver o preview.
            </div>
          )}
        </div>
      )}

      {/* ============ ABA: Fechamento ============ */}
      {abas === 'fechamento' && (
        <div className="space-y-6">
          {/* Status atual */}
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${form?.status === 'fechado' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-dark-200'}`}>
            <Handshake className={form?.status === 'fechado' ? 'text-emerald-600' : 'text-gold-700'} size={20} />
            <div className="text-sm">
              {form?.status === 'fechado' ? (
                <span className="text-emerald-800 font-medium">✅ Venda fechada! O site foi entregue como produto final.</span>
              ) : (
                <span className="text-dark-700 font-medium">
                  Etapa atual: <strong>{STATUS_OPCOES.find((o) => o.value === form?.status)?.label || form?.status}</strong>
                  {form?.status === 'aprovado' ? ' — preencha o briefing e gere a proposta!' : ' — após o lead aprovar, preencha o briefing.'}
                </span>
              )}
            </div>
          </div>

          {/* Briefing */}
          <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-dark-900 flex items-center gap-2">
                <ClipboardList className="text-gold-700" size={18} /> Briefing do site final
              </h3>
              <button
                onClick={handleSalvarBriefing}
                disabled={salvandoBriefing}
                className="text-sm bg-gold-700 hover:bg-gold-800 text-white font-medium rounded-lg px-3 py-1.5 flex items-center gap-1 disabled:opacity-50"
              >
                {salvandoBriefing ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Salvar briefing
              </button>
            </div>
            <p className="text-xs text-dark-500">
              Coleta os dados do site que o lead vai <strong>comprar</strong> (produto final). Usados na proposta e no contrato.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { chave: 'nome', label: 'Nome do negócio / site' },
                { chave: 'telefone', label: 'Telefone de contato' },
                { chave: 'instagram', label: 'Instagram' },
                { chave: 'email', label: 'E-mail' },
                { chave: 'endereco', label: 'Endereço' },
                { chave: 'horario', label: 'Horário de funcionamento' },
              ].map((campo) => (
                <div key={campo.chave}>
                  <label className="block text-sm font-medium text-dark-700 mb-1">{campo.label}</label>
                  <input
                    value={briefing?.[campo.chave] || ''}
                    onChange={(e) => setBriefing((b) => ({ ...b, [campo.chave]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-700 mb-1">Descrição do negócio</label>
                <textarea
                  value={briefing?.descricao || ''}
                  onChange={(e) => setBriefing((b) => ({ ...b, descricao: e.target.value }))}
                  rows={2}
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-700 mb-1">Serviços / seções do site</label>
                <textarea
                  value={briefing?.servicos || ''}
                  onChange={(e) => setBriefing((b) => ({ ...b, servicos: e.target.value }))}
                  rows={2}
                  placeholder="Ex: Serviços, Portfólio, Depoimentos, Contato..."
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-700 mb-1">Observações</label>
                <textarea
                  value={briefing?.observacoes || ''}
                  onChange={(e) => setBriefing((b) => ({ ...b, observacoes: e.target.value }))}
                  rows={2}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Proposta + Contrato */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Proposta */}
            <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-3 h-fit">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-dark-900 flex items-center gap-2">
                  <FileText className="text-blue-600" size={18} /> Proposta comercial
                </h3>
                <button
                  onClick={handleGerarProposta}
                  disabled={gerandoProposta}
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-3 py-1.5 flex items-center gap-1 disabled:opacity-50"
                >
                  {gerandoProposta ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} Gerar
                </button>
              </div>
              <p className="text-xs text-dark-500">Reutiliza o produto "Site Profissional" (R$ 1.490) do catálogo.</p>
              {propostaTexto ? (
                <div className="relative">
                  <pre className="whitespace-pre-wrap text-sm text-dark-700 bg-dark-50 rounded-lg p-3 max-h-72 overflow-y-auto">{propostaTexto}</pre>
                  <button
                    onClick={() => copyDoc('proposta', propostaTexto)}
                    className="absolute top-2 right-2 text-xs bg-white border border-dark-200 rounded-lg px-2 py-1 flex items-center gap-1 hover:bg-dark-50"
                  >
                    {copiedDoc === 'proposta' ? <CheckCircle2 size={13} /> : <Copy size={13} />} {copiedDoc === 'proposta' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-dark-400">Clique em "Gerar" para montar a proposta pronta para o WhatsApp.</p>
              )}
            </div>

            {/* Contrato */}
            <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-3 h-fit">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-dark-900 flex items-center gap-2">
                  <FileText className="text-emerald-600" size={18} /> Contrato
                </h3>
                <button
                  onClick={handleGerarContrato}
                  disabled={gerandoContrato}
                  className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg px-3 py-1.5 flex items-center gap-1 disabled:opacity-50"
                >
                  {gerandoContrato ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} Gerar
                </button>
              </div>
              <p className="text-xs text-dark-500">Contrato simples de prestação de serviço com escopo e valores.</p>
              {contratoTexto ? (
                <div className="relative">
                  <pre className="whitespace-pre-wrap text-sm text-dark-700 bg-dark-50 rounded-lg p-3 max-h-72 overflow-y-auto">{contratoTexto}</pre>
                  <button
                    onClick={() => copyDoc('contrato', contratoTexto)}
                    className="absolute top-2 right-2 text-xs bg-white border border-dark-200 rounded-lg px-2 py-1 flex items-center gap-1 hover:bg-dark-50"
                  >
                    {copiedDoc === 'contrato' ? <CheckCircle2 size={13} /> : <Copy size={13} />} {copiedDoc === 'contrato' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-dark-400">Clique em "Gerar" para montar o contrato para assinatura.</p>
              )}
            </div>
          </div>

          {/* Fechar venda */}
          <div className="bg-white rounded-xl border border-dark-200 p-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-dark-900 flex items-center gap-2">
                <Handshake className="text-emerald-600" size={18} /> Finalizar venda
              </h3>
              <p className="text-xs text-dark-500 mt-1">Após a aprovação, proposta e contrato, marque o site como fechado.</p>
            </div>
            <button
              onClick={handleFechar}
              disabled={fechando || form?.status === 'fechado'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-5 py-2.5 flex items-center gap-2 disabled:opacity-50"
            >
              {fechando ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              {form?.status === 'fechado' ? 'Fechado ✓' : 'Fechar venda'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
