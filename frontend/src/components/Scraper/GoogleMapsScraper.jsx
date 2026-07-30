import { useState, useMemo } from 'react';
import { Loader, AlertCircle, CheckCircle, X, Search, MapPin, Star, Building2, Filter, SlidersHorizontal } from 'lucide-react';
import api from '../../services/api';

export default function GoogleMapsScraper({ onDataScraped, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [mode, setMode] = useState('search');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [selectedResults, setSelectedResults] = useState(new Set());
  const [searchedTerm, setSearchedTerm] = useState('');
  
  // Filtros inteligentes
  const [filters, setFilters] = useState({
    minScore: 0,
    onlyWithPhone: false,
    onlyWithAddress: false,
    autoSelectQuality: 'MEDIA', // 'TUDO', 'MEDIA', 'ALTA'
    city: '',
    sortBy: 'quality', // 'quality' | 'name'
  });
  const [showFilters, setShowFilters] = useState(false);

  // Filtrar resultados inteligentemente
  const filteredResults = useMemo(() => {
    let filtered = [...results];
    
    // Filtro por pontuação mínima
    if (filters.minScore > 0) {
      filtered = filtered.filter(r => (r.quality_score || 0) >= filters.minScore);
    }
    
    // Filtro só com telefone
    if (filters.onlyWithPhone) {
      filtered = filtered.filter(r => r.telefone);
    }
    
    // Filtro só com endereço
    if (filters.onlyWithAddress) {
      filtered = filtered.filter(r => r.endereco && r.endereco.length > 5);
    }
    
    // Filtro por cidade (detectada do endereço)
    if (filters.city) {
      const cityLower = filters.city.toLowerCase();
      filtered = filtered.filter(r => 
        (r.endereco && r.endereco.toLowerCase().includes(cityLower)) ||
        (r.cidade && r.cidade.toLowerCase().includes(cityLower))
      );
    }
    
    // Ordenação
    filtered.sort((a, b) => {
      if (filters.sortBy === 'name') {
        return (a.nome || '').localeCompare(b.nome || '');
      }
      return (b.quality_score || 0) - (a.quality_score || 0);
    });
    
    return filtered;
  }, [results, filters]);

  // Auto-selecionar baseado na qualidade
  const autoSelectByQuality = (threshold) => {
    const newSelected = new Set();
    filteredResults.forEach((r, i) => {
      const score = r.quality_score || 0;
      if (threshold === 'ALTA' && score >= 80) newSelected.add(i);
      else if (threshold === 'MEDIA' && score >= 50) newSelected.add(i);
      else if (threshold === 'TUDO') newSelected.add(i);
    });
    setSelectedResults(newSelected);
  };

  // Detectar cidades únicas dos resultados
  const detectedCities = useMemo(() => {
    const cities = new Set();
    results.forEach(r => {
      if (r.endereco) {
        // Tentar extrair cidade do endereço (padrão: "bairro, Cidade - UF")
        const match = r.endereco.match(/([A-ZÁÉÍÓÚÃÕÇ][a-záéíóúãõç]+)\s*[–-]\s*([A-Z]{2})/);
        if (match) cities.add(match[1]);
        // Ou padrão: "Cidade, Estado"
        const match2 = r.endereco.match(/([A-ZÁÉÍÓÚÃÕÇ][a-záéíóúãõç]+),\s*([A-Z]{2})\b/);
        if (match2) cities.add(match2[1]);
      }
      if (r.cidade) cities.add(r.cidade);
    });
    return Array.from(cities).sort();
  }, [results]);

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
    setShowFilters(false);

    (async () => {
      try {
        const response = await api.post('/scraper/search', { searchTerm });
        
        if (response.data.success) {
          const data = response.data.data || [];
          
          if (data.length === 0) {
            setError('Nenhum resultado encontrado. Tente outro termo.');
          } else {
            setResults(data);
            setSearchedTerm(searchTerm);
            // Auto-selecionar após carregar
            setTimeout(() => autoSelectByQuality('MEDIA'), 100);
          }
        } else {
          setError(response.data.error || 'Erro ao buscar');
        }
      } catch (err) {
        console.error('Erro na busca:', err);
        const errorData = err.response?.data;
        
        if (err.response?.status === 503) {
          setError('BUSCA_INDISPONÍVEL');
          setMode('url');
        } else {
          setError('Erro ao buscar: ' + (errorData?.error || err.message || 'Tente novamente'));
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

  // Se tem resultados, mostrar lista com filtros
  if (results.length > 0) {
    const totalAlta = results.filter(r => r.quality_level === 'ALTA').length;
    const totalMedia = results.filter(r => r.quality_level === 'MÉDIA').length;
    const totalBaixa = results.filter(r => r.quality_level === 'BAIXA').length;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Resultados</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                "{searchedTerm}" — {filteredResults.length} de {results.length} resultados
                {totalAlta > 0 && <span className="ml-2 text-green-700">⭐{totalAlta}</span>}
                {totalMedia > 0 && <span className="ml-2 text-yellow-700">●{totalMedia}</span>}
                {totalBaixa > 0 && <span className="ml-2 text-red-700">○{totalBaixa}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-gold-100 text-gold-700' : 'text-gray-500 hover:bg-gray-100'}`}
                title="Filtros inteligentes"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Painel de Filtros Inteligentes */}
          {showFilters && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Filter className="w-4 h-4" /> Filtros Inteligentes
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Pontuação mínima */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Pontuação mínima: {filters.minScore}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={filters.minScore}
                    onChange={(e) => setFilters({...filters, minScore: Number(e.target.value)})}
                    className="w-full accent-gold-700"
                  />
                </div>

                {/* Auto-seleção */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Auto-selecionar
                  </label>
                  <select
                    value={filters.autoSelectQuality}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilters({...filters, autoSelectQuality: val});
                      autoSelectByQuality(val);
                    }}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-gold-500"
                  >
                    <option value="TUDO">Todos</option>
                    <option value="MEDIA">Média+ (≥50%)</option>
                    <option value="ALTA">Alta (≥80%)</option>
                  </select>
                </div>

                {/* Só com telefone */}
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.onlyWithPhone}
                    onChange={(e) => setFilters({...filters, onlyWithPhone: e.target.checked})}
                    className="rounded border-gray-300 text-gold-700"
                  />
                  Só com telefone
                </label>

                {/* Só com endereço */}
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.onlyWithAddress}
                    onChange={(e) => setFilters({...filters, onlyWithAddress: e.target.checked})}
                    className="rounded border-gray-300 text-gold-700"
                  />
                  Só com endereço
                </label>

                {/* Filtro por cidade */}
                {detectedCities.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cidade</label>
                    <select
                      value={filters.city}
                      onChange={(e) => setFilters({...filters, city: e.target.value})}
                      className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-gold-500"
                    >
                      <option value="">Todas</option>
                      {detectedCities.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Ordenar por */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ordenar por</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-gold-500"
                  >
                    <option value="quality">Qualidade</option>
                    <option value="name">Nome</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Barra de seleção */}
          <div className="mb-3 flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedResults.size === filteredResults.length && filteredResults.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-gold-700 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700">Selecionar todos</span>
            </label>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{selectedResults.size} de {filteredResults.length} selec.</span>
              <button
                onClick={() => autoSelectByQuality(filters.autoSelectQuality)}
                className="text-gold-700 hover:underline font-medium"
              >
                ✨ Auto-selecionar
              </button>
            </div>
          </div>

          {/* Lista de resultados filtrados */}
          <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
            {filteredResults.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                Nenhum resultado corresponde aos filtros atuais.
              </div>
            ) : (
              filteredResults.map((result, index) => {
                const realIndex = results.indexOf(result);
                return (
                  <div
                    key={index}
                    onClick={() => toggleResult(realIndex)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedResults.has(realIndex)
                        ? 'border-gold-700 bg-gold-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedResults.has(realIndex)}
                        onChange={() => toggleResult(realIndex)}
                        className="w-4 h-4 rounded border-gray-300 text-gold-700 mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">
                            {result.nome || 'Sem nome'}
                          </h3>
                          {result.quality_score !== undefined && (
                            <div className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                              result.quality_level === 'ALTA' ? 'bg-green-100 text-green-800' :
                              result.quality_level === 'MÉDIA' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {result.quality_level}
                            </div>
                          )}
                        </div>

                        {result.issues?.length > 0 && (
                          <div className="mt-0.5 text-xs text-amber-700">⚠️ {result.issues.join(', ')}</div>
                        )}

                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs">
                          {result.telefone && <span className="text-green-700">📞 {result.telefone}</span>}
                          {result.endereco && <span className="text-gray-500 line-clamp-1 max-w-[200px]">{result.endereco}</span>}
                          {result.avaliacoes && <span className="text-yellow-600">⭐ {result.avaliacoes}</span>}
                          {result.website && <span className="text-cyan-600">🌐</span>}
                          {result.cep && <span className="text-blue-600">📮 {result.cep}</span>}
                        </div>

                        {result.data_enriched && (
                          <div className="mt-0.5 text-xs text-blue-500">✓ Dados validados com OpenStreetMap</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={() => { setResults([]); setSelectedResults(new Set()); setSearchedTerm(''); setError(''); }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Nova Busca
            </button>
            <button
              onClick={handleAddLeads}
              disabled={selectedResults.size === 0}
              className="flex-1 px-4 py-2 bg-gold-700 text-dark-900 font-medium rounded-lg hover:bg-gold-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Adicionar {selectedResults.size > 0 ? `(${selectedResults.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form inicial para busca (modo Desktop)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Buscar no Google Maps</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => { setMode('search'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'search' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🔍 Buscar por termo
          </button>
          <button
            onClick={() => { setMode('url'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🔗 Colar URL
          </button>
        </div>

        {error && error !== 'BUSCA_INDISPONÍVEL' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'search' ? (
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                O que você procura?
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setError(''); }}
                placeholder="Ex: mecânicos em joinville"
                disabled={loading}
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-gold-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <p className="font-semibold mb-2 flex items-center gap-1">
                <Search className="w-4 h-4" />
                Exemplos:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Encanadores em São Paulo', 'Eletricistas Curitiba', 'Pizzarias Rio de Janeiro', 'Restaurantes BH'].map(ex => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setSearchTerm(ex)}
                    className="px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !searchTerm.trim()}
              className="w-full py-2.5 px-4 bg-gold-700 text-dark-900 font-semibold rounded-lg hover:bg-gold-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Buscando...</>
              ) : (
                <><Search className="w-4 h-4" /> Buscar Agora</>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center">
              💡 Resultados mais completos com filtros automáticos
            </p>
          </form>
        ) : (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cole a URL do Google Maps:
              </label>
              <input
                type="text"
                value={mapsUrl}
                onChange={(e) => { setMapsUrl(e.target.value); setError(''); }}
                placeholder="https://maps.google.com/maps/place/..."
                disabled={loading}
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-gold-500 focus:border-transparent disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Cole a URL de um lugar específico do Google Maps
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !mapsUrl.trim()}
              className="w-full py-2.5 px-4 bg-gold-700 text-dark-900 font-semibold rounded-lg hover:bg-gold-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Processando...</>
              ) : (
                <><MapPin className="w-4 h-4" /> Extrair Dados</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
