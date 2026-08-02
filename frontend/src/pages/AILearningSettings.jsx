import { useState, useEffect, useCallback } from 'react';
import { Settings, Brain, MessageSquare, BookOpen, BarChart3, Users, Shield, RefreshCw, FileWarning, Save, RotateCcw } from 'lucide-react';

const API = 'http://localhost:3001/api/whatsapp/learning';

const CAMADAS = [
  {
    chave: 'memoriaLead',
    icon: Brain,
    cor: 'text-violet-600 bg-violet-100',
    titulo: 'Memória individual por lead',
    desc: 'Guarda o perfil comportamental de cada lead (tom, horário, objeções) e personaliza as sugestões da IA.',
  },
  {
    chave: 'feedbackLoop',
    icon: MessageSquare,
    cor: 'text-blue-600 bg-blue-100',
    titulo: 'Feedback loop do vendedor',
    desc: 'Registra suas edições nas sugestões da IA e ajusta automaticamente o tom/comprimento padrão.',
  },
  {
    chave: 'rag',
    icon: BookOpen,
    cor: 'text-amber-600 bg-amber-100',
    titulo: 'Base de conhecimento (RAG)',
    desc: 'A IA consulta catálogo, scripts, FAQ e políticas da sua base antes de responder.',
  },
  {
    chave: 'analytics',
    icon: BarChart3,
    cor: 'text-green-600 bg-green-100',
    titulo: 'Insights globais',
    desc: 'Analisa o que converte mais (curto/longo, pergunta final, palavras) e aplica nos prompts.',
  },
  {
    chave: 'entreVendedores',
    icon: Users,
    cor: 'text-pink-600 bg-pink-100',
    titulo: 'Aprendizado entre vendedores',
    desc: 'Compara performance entre vendedores e aplica o padrão do top performer para todos.',
  },
];

export default function AILearningSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [report, setReport] = useState(null);
  const [topPattern, setTopPattern] = useState(null);
  const [vendedores, setVendedores] = useState([]);
  const [applying, setApplying] = useState(false);

  const notify = (text, type = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, t, v] = await Promise.all([
        fetch(`${API}/settings`).then((r) => r.json()),
        fetch('http://localhost:3001/api/whatsapp/feedback/report?days=30').then((r) => r.json()),
        fetch(`${API}/top-pattern`).then((r) => r.json()),
        fetch(`${API}/vendedores?days=30`).then((r) => r.json()),
      ]);
      if (s.success) setSettings(s.settings);
      if (r.success) setReport(r.report);
      if (t.success) setTopPattern(t.padrao);
      if (v.success) setVendedores(v.vendedores);
    } catch (err) {
      notify(`Erro ao carregar: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleCamada = (chave) => {
    setSettings((prev) => ({ ...prev, [chave]: !prev[chave] }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${API}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        notify('✅ Configurações das camadas salvas');
      } else {
        notify(data.error || 'Erro ao salvar', 'error');
      }
    } catch (err) {
      notify(`Erro: ${err.message}`, 'error');
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch(`${API}/settings/reset`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        notify('Configurações restauradas para o padrão');
      }
    } catch (err) {
      notify(`Erro: ${err.message}`, 'error');
    }
  };

  const handleApplyPattern = async () => {
    setApplying(true);
    try {
      const res = await fetch(`${API}/apply-pattern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });
      const data = await res.json();
      if (data.success) {
        notify(data.aplicado
          ? `✅ Padrão do top performer aplicado (${data.topPerformer?.vendedorId || '—'})`
          : data.mensagem || 'Análise concluída (sem padrão aplicável)', 'success');
        await loadAll();
      } else {
        notify(data.error || 'Erro', 'error');
      }
    } catch (err) {
      notify(`Erro: ${err.message}`, 'error');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Carregando configurações...</div>;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-gold-100 text-gold-700">
            <Settings className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Aprendizado da IA</h1>
            <p className="text-sm text-gray-500">Controle como a IA aprende com o uso do sistema. Tudo transparente.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">
            <RotateCcw className="w-4 h-4" /> Padrão
          </button>
          <button onClick={handleSave} className="inline-flex items-center gap-2 px-3 py-2 bg-gold-700 hover:bg-gold-500 text-white text-sm font-medium rounded-lg">
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm ${msgType === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      {/* Toggles das camadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CAMADAS.map((camada) => (
          <div key={camada.chave} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <span className={`p-2.5 rounded-lg ${camada.cor} flex-shrink-0`}>
              <camada.icon className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{camada.titulo}</p>
              <p className="text-xs text-gray-500 mt-0.5">{camada.desc}</p>
            </div>
            <button
              onClick={() => toggleCamada(camada.chave)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings?.[camada.chave] ? 'bg-green-500' : 'bg-gray-300'}`}
              title={settings?.[camada.chave] ? 'Ativo' : 'Desativado'}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings?.[camada.chave] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Privacidade */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Privacidade e controle</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Registrar conversas para aprendizado</p>
              <p className="text-xs text-gray-500">Se desativar, a IA não guarda novas sugestões/edições. Dados já salvos permanecem.</p>
            </div>
            <button
              onClick={() => toggleCamada('registrarConversas')}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings?.registrarConversas ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings?.registrarConversas ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Anonimizar dados em analytics globais</p>
              <p className="text-xs text-gray-500">Remove identificadores (nomes/telefones) das métricas agregadas.</p>
            </div>
            <button
              onClick={() => toggleCamada('anonimizarAnalytics')}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings?.anonimizarAnalytics ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings?.anonimizarAnalytics ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Relatório de performance */}
      {report && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileWarning className="w-5 h-5 text-gold-700" />
            <h3 className="font-semibold text-gray-900">Relatório da IA</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{report.taxaAceite ?? 0}%</p>
              <p className="text-xs text-gray-500">Aceitas sem edição</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{report.taxaEdicao ?? 0}%</p>
              <p className="text-xs text-gray-500">Editadas</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{report.taxaRespostaPositiva ?? 0}%</p>
              <p className="text-xs text-gray-500">Respostas positivas</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{report.totalSugestoes ?? 0}</p>
              <p className="text-xs text-gray-500">Sugestões (30d)</p>
            </div>
          </div>
          {report.descricaoPadroes && report.padroesDetectados?.length > 0 && (
            <p className="mt-3 text-sm text-gray-600">
              <strong>Padrões:</strong> {report.descricaoPadroes}
            </p>
          )}
        </div>
      )}

      {/* Top performer + aplicar padrão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Performance por vendedor</h3>
            <button
              onClick={handleApplyPattern}
              disabled={applying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${applying ? 'animate-spin' : ''}`} />
              {applying ? 'Aplicando...' : 'Aplicar padrão do top'}
            </button>
          </div>
          {vendedores.length === 0 ? (
            <p className="text-sm text-gray-400">Sem dados de vendedores ainda.</p>
          ) : (
            <div className="space-y-2">
              {vendedores.map((v) => (
                <div key={v.vendedorId} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700">{v.vendedorId}</span>
                  <span className="text-gray-500">
                    {v.total} sug · conv {v.taxaConversao}%
                    {v.taxaConversao >= 80 && ' 🏆'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Padrão do top performer</h3>
          {topPattern ? (
            <div className="space-y-1.5 text-sm">
              <p className="text-gray-700">Referência: <strong>{topPattern.topPerformerId}</strong></p>
              <p className="text-gray-600">Estilo: <strong className="capitalize">{topPattern.estilo}</strong></p>
              <p className="text-gray-600">Pergunta final: <strong>{topPattern.taxaPerguntaFinal}%</strong></p>
              <p className="text-gray-600">Tom: <strong className="capitalize">{topPattern.tom}</strong></p>
              {topPattern.palavrasChave?.length > 0 && (
                <p className="text-gray-600">Palavras: <span className="text-gray-500">{topPattern.palavrasChave.slice(0, 6).join(', ')}</span></p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sem padrão registrado ainda. Clique em "Aplicar padrão do top".</p>
          )}
        </div>
      </div>
    </div>
  );
}
