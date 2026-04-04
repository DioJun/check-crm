import { useState } from 'react';
import { Loader, AlertCircle, CheckCircle, X, Search, MapPin, Star, Building2 } from 'lucide-react';
import api from '../../services/api';

export default function GoogleMapsScraper({ onDataScraped, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [mode, setMode] = useState('search'); // 'search' atau 'url'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [selectedResults, setSelectedResults] = useState(new Set());
  const [searchedTerm, setSearchedTerm] = useState('');

  function handleSearch(e) {
    e.preventDefault();
    
    if (!searchTerm.trim()) {
      setError('Digite um termo de pesquisa (ex: "mecânicos em joinville")');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setSelectedResults(new Set());

    (async () => {
      try {
        console.log('Enviando busca para:', searchTerm);
        const response = await api.post('/scraper/search', { searchTerm });
        
        console.log('Resposta:', response.data);

        if (response.data.success) {
          const data = response.data.data || [];
          
          if (data.length === 0) {
            setError('Nenhum resultado encontrado. Tente outro termo.');
          } else {
            setResults(data);
            setSearchedTerm(searchTerm);
          }
        } else {
          setError(response.data.error || 'Erro ao buscar');
        }
      } catch (err) {
        console.error('Erro na busca:', err);
        const errorData = err.response?.data;
        
        // Se for erro 503 (serviço temporariamente indisponível), mostrar alternativa
        if (err.response?.status === 503) {
          setError('BUSCA_INDISPONÍVEL');
          setMode('url'); // Mudar para modo URL
        } else {
          setError('Erro ao buscar: ' + (errorData?.error || err.message || 'Tente novamente em alguns segundos'));
        }
      } finally {
        setLoading(false);
      }
    })();
  }

  function handleUrlSubmit(e) {
    e.preventDefault();
    
    if (!mapsUrl.trim()) {
      setError('Cole uma URL do Google Maps');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setSelectedResults(new Set());

    (async () => {
      try {
        console.log('Enviando URL para:', mapsUrl);
        const response = await api.post('/scraper/google-maps', { url: mapsUrl });
        
        console.log('Resposta:', response.data);

        if (response.data.success) {
          const data = response.data.data || [];
          
          if (data.length === 0) {
            setError('Nenhum resultado encontrado nesta URL. Tente outra.');
          } else {
            setResults(data);
            setSearchedTerm(mapsUrl);
          }
        } else {
          setError(response.data.error || 'Erro ao processar URL');
        }
      } catch (err) {
        console.error('Erro ao processar URL:', err);
        setError('Erro ao processar URL: ' + (err.response?.data?.error || err.message || 'Tente novamente'));
      } finally {
        setLoading(false);
      }
    })();
  }

  function toggleResult(index) {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedResults(newSelected);
  }

  function handleSelectAll() {
    if (selectedResults.size === results.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(results.map((_, i) => i)));
    }
  }

  function handleAddLeads() {
    const selectedLeads = results.filter((_, i) => selectedResults.has(i));
    
    if (selectedLeads.length === 0) {
      setError('Selecione pelo menos um resultado');
      return;
    }

    // Adicionar cada lead selecionado
    selectedLeads.forEach(lead => {
      if (onDataScraped) {
        onDataScraped(lead);
      }
    });

    // Reset
    setSearchTerm('');
    setResults([]);
    setSelectedResults(new Set());
    setSearchedTerm('');
    setError('');
  }

  // Se tem resultados, mostrar lista
  if (results.length > 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Resultados da Busca</h2>
              <p className="text-sm text-gray-600 mt-1">"{searchedTerm}" - {results.length} resultados encontrados</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Opção para selecionar todos */}
          <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedResults.size === results.length && results.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectedResults.size === results.length && results.length > 0
                  ? 'Desselecionar Todos'
                  : 'Selecionar Todos'}
              </span>
            </label>
            <span className="text-xs text-gray-500">
              {selectedResults.size} de {results.length} selecionados
            </span>
          </div>

          {/* Lista de resultados */}
          <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
            {results.map((result, index) => (
              <div
                key={index}
                onClick={() => toggleResult(index)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedResults.has(index)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedResults.has(index)}
                    onChange={() => toggleResult(index)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 mt-1 cursor-pointer"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 line-clamp-1">
                      {result.nome || 'Sem nome'}
                    </h3>
                    
                    {result.endereco && (
                      <div className="flex items-start gap-2 mt-1 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{result.endereco}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {result.avaliacoes && (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-gray-700">{result.avaliacoes}</span>
                        </div>
                      )}
                      
                      {result.telefone && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          ✓ WhatsApp
                        </span>
                      )}
                      
                      {result.website && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          ✓ Site
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Botões de ação */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setResults([]);
                setSelectedResults(new Set());
                setSearchedTerm('');
                setError('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Nova Busca
            </button>
            <button
              onClick={handleAddLeads}
              disabled={selectedResults.size === 0}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Adicionar {selectedResults.size > 0 ? `(${selectedResults.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form inicial para busca
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Buscar no Google Maps</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error === 'BUSCA_INDISPONÍVEL' ? (
          <>
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900">Busca por termo indisponível</p>
                  <p className="text-sm text-amber-800 mt-1">A busca automática está tendo limitações técnicas, mas você pode usar URLs do Google Maps!</p>
                </div>
              </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Como usar com URLs (funciona perfeitamente!):
              </p>
              <ol className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-blue-200 text-blue-900 text-xs font-bold rounded-full">1</span>
                  <span>Abra <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">maps.google.com</a> em nova aba</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-blue-200 text-blue-900 text-xs font-bold rounded-full">2</span>
                  <span>Faça a busca (ex: "Eletricistas em Curitiba") ou clique num resultado</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-blue-200 text-blue-900 text-xs font-bold rounded-full">3</span>
                  <span><strong>Copie a URL inteira</strong> da barra de endereços (Ctrl+C na barra)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-blue-200 text-blue-900 text-xs font-bold rounded-full">4</span>
                  <span>Cole no campo abaixo (Ctrl+V)</span>
                </li>
              </ol>
              <p className="text-xs text-blue-700 mt-3 bg-blue-100 p-2 rounded">
                ✓ Exemplo de URL: <code className="text-blue-900">https://maps.google.com/maps/search/eletricistas</code>
              </p>
            </div>

            {/* Campo para colar URL */}
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cole a URL do Google Maps:
                </label>
                <input
                  type="text"
                  value={mapsUrl}
                  onChange={(e) => {
                    setMapsUrl(e.target.value);
                    setError('');
                  }}
                  placeholder="Colar aqui: https://maps.google.com/maps/search/..."
                  disabled={loading}
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !mapsUrl.trim()}
                className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Processando URL...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    Extrair Dados
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-4">
              ou <button type="button" onClick={() => { setError(''); setMode('search'); }} className="text-indigo-600 hover:underline font-semibold">tente novamente por termo</button>
            </p>
          </>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  O que você procura?
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setError('');
                  }}
                  placeholder="Ex: mecânicos em joinville"
                  disabled={loading}
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>

              {/* Exemplos */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <p className="font-semibold mb-2 flex items-center gap-1">
                  <Search className="w-4 h-4" />
                  Exemplos de busca:
                </p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Encanadores em São Paulo</li>
                  <li>Eletricistas em Curitiba</li>
                  <li>Pizzarias no Rio de Janeiro</li>
                  <li>Restaurantes em Belo Horizonte</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading || !searchTerm.trim()}
                className="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Buscar Negócios
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-4">
              💡 Dica: Quanto mais específica a busca, melhores os resultados
            </p>
          </>
        )}
      </div>
    </div>
  );
}
