import { useState } from 'react';
import { Loader, AlertCircle, CheckCircle, Copy, Link as LinkIcon, X } from 'lucide-react';
import api from '../../services/api';

export default function GoogleMapsScraper({ onDataScraped, onClose }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);
  const [editedData, setEditedData] = useState(null);

  async function handleValidateUrl(e) {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Cole a URL do Google Maps');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await api.post('/scraper/validate-url', { url });

      if (!response.data.valid) {
        setError('URL não parece ser do Google Maps. Use um link válido (ex: maps.google.com)');
        setLoading(false);
        return;
      }

      // Fazer o scrape
      await scrapeUrl();
    } catch (err) {
      setError('Erro ao validar URL: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  }

  async function scrapeUrl() {
    try {
      const response = await api.post('/scraper/google-maps', { url });

      if (response.data.success) {
        setScrapedData(response.data.data);
        setEditedData(response.data.data);
        setSuccess(true);
        setError('');
        setUrl('');
      } else {
        setError(response.data.error || 'Erro ao fazer scrape');
      }
    } catch (err) {
      setError('Erro ao fazer scrape: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }

  function handleEditField(field, value) {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  }

  function handleUseData() {
    if (onDataScraped) {
      onDataScraped(editedData);
    }
    // Reset
    setScrapedData(null);
    setEditedData(null);
    setSuccess(false);
  }

  function handleReset() {
    setScrapedData(null);
    setEditedData(null);
    setSuccess(false);
    setUrl('');
    setError('');
  }

  // Se já tem dados scrapeados, mostrar form de edição
  if (scrapedData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Dados do Google Maps</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Confiança dos dados */}
          <div className={`mb-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
            scrapedData.confianca === 'alta' 
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              {scrapedData.confianca === 'alta'
                ? '✓ Dados extraídos com alta confiabilidade'
                : '⚠️ Confiabilidade média. Revise os dados'}
            </span>
          </div>

          {/* Campos editáveis */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nome do Negócio *
              </label>
              <input
                type="text"
                value={editedData?.nome || ''}
                onChange={(e) => handleEditField('nome', e.target.value)}
                placeholder="Ex: Padaria do João"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Telefone
              </label>
              <input
                type="tel"
                value={editedData?.telefone || ''}
                onChange={(e) => handleEditField('telefone', e.target.value)}
                placeholder="Ex: +5547999226015"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Endereço
              </label>
              <input
                type="text"
                value={editedData?.endereco || ''}
                onChange={(e) => handleEditField('endereco', e.target.value)}
                placeholder="Ex: Rua das Flores, 123"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Avaliação (Google)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={editedData?.avaliacoes || ''}
                onChange={(e) => handleEditField('avaliacoes', e.target.value)}
                placeholder="Ex: 4.5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Site
              </label>
              <input
                type="url"
                value={editedData?.website || ''}
                onChange={(e) => handleEditField('website', e.target.value)}
                placeholder="Ex: https://exemplo.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* URL Original */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">URL do Google Maps</p>
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a
                  href={editedData?.url_original}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline truncate flex-1"
                >
                  {editedData?.url_original.slice(0, 50)}...
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(editedData?.url_original)}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Copiar URL"
                >
                  <Copy className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={handleUseData}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Usar Dados
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form inicial para colar URL
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Google Maps Scraper</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleValidateUrl} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cole a URL do Google Maps
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
              placeholder="https://maps.google.com/maps/place/..."
              disabled={loading}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
            />
          </div>

          {/* Dicas */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <p className="font-semibold mb-1">Como encontrar:</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Abra a localização no Google Maps</li>
              <li>Copie o link compartilhar ou a URL do navegador</li>
              <li>Cole aqui e envie</li>
            </ol>
          </div>

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Extraindo dados...
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4" />
                Fazer Scrape
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
