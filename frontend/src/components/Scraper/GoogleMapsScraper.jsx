import { useState } from 'react';
import { Loader, AlertCircle, CheckCircle, X, Search, MapPin, Star, Building2 } from 'lucide-react';
import api from '../../services/api';

export default function GoogleMapsScraper({ onDataScraped, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [selectedResults, setSelectedResults] = useState(new Set());
  const [searchedTerm, setSearchedTerm] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    
    if (!searchTerm.trim()) {
      setError('Digite um termo de pesquisa (ex: "mecânicos em joinville")');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setSelectedResults(new Set());

    try {
      const response = await api.post('/scraper/search', { searchTerm });

      if (response.data.success) {
        setResults(response.data.data || []);
        setSearchedTerm(searchTerm);
        
        if (!response.data.data || response.data.data.length === 0) {
          setError('Nenhum resultado encontrado. Tente um termo diferente.');
        }
      } else {
        setError(response.data.error || 'Erro ao buscar');
      }
    } catch (err) {
      console.error('Erro:', err);
      setError('Erro ao buscar: ' + (err.response?.data?.error || err.message));
      // Se Puppeteer não estiver instalado, usar dados de teste
      if (err.response?.status === 500 && err.response?.data?.tip?.includes('Puppeteer')) {
        setResults(getMockResults(searchTerm));
        setSearchedTerm(searchTerm);
      }
    } finally {
      setLoading(false);
    }
  }

  function getMockResults(term) {
    return [
      { 
        nome: 'Oficina ' + (term.includes('mecânicos') ? 'Mecanizada' : 'Centro'), 
        endereco: 'Rua Principal, 123 - Joinville', 
        avaliacoes: '4.5',
        telefone: '+5547999226015',
        website: 'https://exemplo.com'
      },
      { 
        nome: 'Serviços Automotivos ' + (term.includes('mecânicos') ? 'Express' : 'Rápidos'), 
        endereco: 'Avenida Brasil, 456 - Joinville', 
        avaliacoes: '4.2',
        telefone: null,
        website: null
      },
      { 
        nome: 'Manutenção ' + (term.includes('mecânicos') ? 'Especializada' : 'Geral'), 
        endereco: 'Rua do Comércio, 789 - Joinville', 
        avaliacoes: '4.8',
        telefone: null,
        website: null
      }
    ];
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
      </div>
    </div>
  );
}
