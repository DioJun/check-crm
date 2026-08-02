import { useEffect, useState } from 'react';
import { Globe, Rocket, Loader2, Save, ExternalLink, Key, Users, GitBranch } from 'lucide-react';
import api from '../services/api';

export default function SiteSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configurado, setConfigurado] = useState(false);
  const [form, setForm] = useState({ token: '', teamId: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // GitHub
  const [ghSaving, setGhSaving] = useState(false);
  const [ghConfigurado, setGhConfigurado] = useState(false);
  const [ghForm, setGhForm] = useState({ token: '', owner: '' });
  const [ghSaved, setGhSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [res, ghRes] = await Promise.all([
          api.get('/sites/deploy/config'),
          api.get('/sites/github/config'),
        ]);
        setConfigurado(res.data?.configurado);
        setForm((f) => ({ ...f, teamId: res.data?.teamId || '' }));
        setGhConfigurado(ghRes.data?.configurado);
        setGhForm((f) => ({ ...f, owner: ghRes.data?.owner || '' }));
      } catch (err) {
        setError('Erro ao carregar config: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await api.put('/sites/deploy/config', {
        token: form.token || undefined,
        teamId: form.teamId || undefined,
      });
      setConfigurado(res.data?.configurado);
      setForm((f) => ({ ...f, token: '' }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }

  async function handleGhSave() {
    setGhSaving(true);
    setError('');
    setGhSaved(false);
    try {
      const res = await api.put('/sites/github/config', {
        token: ghForm.token || undefined,
        owner: ghForm.owner || undefined,
      });
      setGhConfigurado(res.data?.configurado);
      setGhForm((f) => ({ ...f, token: '' }));
      setGhSaved(true);
      setTimeout(() => setGhSaved(false), 3000);
    } catch (err) {
      setError('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setGhSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-gold-700" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 flex items-center gap-2">
          <Globe className="text-gold-700" /> Configurações dos Sites
        </h1>
        <p className="text-sm text-dark-500">
          Conecte o Vercel para publicar os sites de demonstração com link público.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
      )}

      {/* Status atual */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${configurado ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <span className={`w-3 h-3 rounded-full ${configurado ? 'bg-green-500' : 'bg-amber-500'}`} />
        <div className="text-sm">
          {configurado ? (
            <span className="text-green-800 font-medium">✅ Vercel configurado — pronto para publicar sites.</span>
          ) : (
            <span className="text-amber-800 font-medium">⚠️ Vercel não configurado — o botão "Publicar" pedirá o token.</span>
          )}
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-4">
        <h3 className="font-semibold text-dark-900 flex items-center gap-2">
          <Key className="text-gold-700" size={18} /> Token de acesso do Vercel
        </h3>

        <div>
          <label className="block text-sm font-medium text-dark-700 mb-1">Token (Access Token)</label>
          <input
            type="password"
            value={form.token}
            onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
            placeholder="Crie em vercel.com/account/tokens"
            className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <p className="text-xs text-dark-500 mt-1">
            Deixe em branco para manter o token já salvo. O token nunca é exibido novamente.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-700 mb-1 flex items-center gap-1">
            <Users size={14} /> Team ID (opcional)
          </label>
          <input
            value={form.teamId}
            onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
            placeholder="Somente se for conta de time (Team)"
            className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gold-700 hover:bg-gold-800 text-white font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar configuração
        </button>

        {saved && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
            ✅ Configuração salva com sucesso!
          </div>
        )}
      </div>

      {/* GitHub */}
      <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-4">
        <h3 className="font-semibold text-dark-900 flex items-center gap-2">
          <GitBranch className="text-dark-800" size={18} /> GitHub (backup do código)
        </h3>

        <div className={`rounded-xl border p-4 flex items-center gap-3 ${ghConfigurado ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <span className={`w-3 h-3 rounded-full ${ghConfigurado ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className={`text-sm font-medium ${ghConfigurado ? 'text-green-800' : 'text-amber-800'}`}>
            {ghConfigurado ? '✅ GitHub configurado — o código do site pode ser salvo como backup.' : '⚠️ GitHub não configurado — o botão "GitHub" no editor pedirá o token.'}
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-700 mb-1">Token (Personal Access Token)</label>
          <input
            type="password"
            value={ghForm.token}
            onChange={(e) => setGhForm((f) => ({ ...f, token: e.target.value }))}
            placeholder="Crie em github.com/settings/tokens (escopo repo)"
            className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-700 mb-1">Owner (nome de usuário, opcional)</label>
          <input
            value={ghForm.owner}
            onChange={(e) => setGhForm((f) => ({ ...f, owner: e.target.value }))}
            placeholder="Deixe em branco para detectar automaticamente"
            className="w-full border border-dark-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
        </div>

        <button
          onClick={handleGhSave}
          disabled={ghSaving}
          className="bg-dark-800 hover:bg-dark-700 text-white font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2 disabled:opacity-50"
        >
          {ghSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar GitHub
        </button>

        {ghSaved && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
            ✅ Configuração do GitHub salva!
          </div>
        )}
      </div>

      {/* Como funciona */}
      <div className="bg-white rounded-xl border border-dark-200 p-6 space-y-3">
        <h3 className="font-semibold text-dark-900 flex items-center gap-2">
          <Rocket className="text-gold-700" size={18} /> Como publicar um site
        </h3>
        <ol className="text-sm text-dark-600 space-y-2 list-decimal list-inside">
          <li>No editor do site, clique em <strong>Publicar no Vercel</strong>.</li>
          <li>O sistema envia o HTML gerado para a Vercel (deploy direto, sem git).</li>
          <li>Recebe um link público <span className="font-mono text-xs bg-dark-50 rounded px-1">https://demo-<b>seunegocio</b>.vercel.app</span>.</li>
          <li>O link é salvo no site e aparece na galeria.</li>
        </ol>
        <a
          href="https://vercel.com/account/tokens"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-gold-700 hover:underline"
        >
          <ExternalLink size={14} /> Criar token na Vercel
        </a>
      </div>
    </div>
  );
}
