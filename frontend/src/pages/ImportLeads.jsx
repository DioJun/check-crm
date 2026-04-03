import { useState } from 'react';
import { Upload, ArrowRight, Check, AlertCircle, MapPin, Link2 } from 'lucide-react';
import api from '../services/api';
import GoogleMapsScraper from '../components/Scraper/GoogleMapsScraper';

export default function ImportLeads() {
  const [step, setStep] = useState(1); // 1: upload, 2: mapping, 3: confirm, 4: success
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showScraper, setShowScraper] = useState(false);

  // Data from spreadsheet
  const [spreadsheetData, setSpreadsheetData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [isGoogleMaps, setIsGoogleMaps] = useState(false);

  // Mapping state
  const [mapping, setMapping] = useState({
    nome: '',
    telefone: '',
    cidade: '',
    servico: '',
    origem: '',
  });

  // Google Maps cities
  const [cities, setCities] = useState({});
  const [singleCity, setSingleCity] = useState('');
  const [whatsappStatus, setWhatsappStatus] = useState({});
  const [siteStatus, setSiteStatus] = useState({});
  const [duplicates, setDuplicates] = useState([]);
  const [sites, setSites] = useState({});
  const [telefones, setTelefones] = useState({});

  async function handleFileSelect(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];

    if (!validTypes.includes(selected.type)) {
      setError('Apenas arquivos Excel (.xlsx, .xls) e CSV (.csv) são permitidos');
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError('O arquivo não pode ser maior que 5MB');
      return;
    }

    setFile(selected);
    setError('');
  }

  async function handleUpload() {
    if (!file) {
      setError('Selecione um arquivo');
      return;
    }

    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/leads/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSpreadsheetData(res.data.data);
      setColumns(res.data.columns || []);
      setIsGoogleMaps(res.data.isGoogleMaps);

      // Verificar duplicatas
      try {
        const dupRes = await api.post('/leads/check-duplicates', {
          leads: res.data.data
        });
        setDuplicates(dupRes.data.duplicates || []);
      } catch {
        // Se a verificação falhar, continua mesmo assim
        setDuplicates([]);
      }

      // Pré-preencher telefones e sites extraídos
      const pre_telefones = {};
      const pre_sites = {};
      res.data.data.forEach((lead, idx) => {
        if (lead.telefone) {
          pre_telefones[idx] = lead.telefone;
        }
        if (lead.site) {
          pre_sites[idx] = lead.site;
        }
      });
      setTelefones(pre_telefones);
      setSites(pre_sites);

      if (res.data.isGoogleMaps) {
        setSingleCity('');
        setStep(2);
      } else {
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar arquivo');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (isGoogleMaps) {
      // Para Google Maps, não é obrigatório ter telefone
      return handleGoogleMapsImport();
    } else {
      if (!mapping.nome || !mapping.telefone) {
        setError('Você deve mapear pelo menos Nome e Telefone');
        return;
      }
      return handleNormalImport();
    }
  }

  async function handleNormalImport() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/leads/import-spreadsheet', {
        data: spreadsheetData,
        mapping: mapping
      });

      setSuccess(`${res.data.created || 0} leads importados com sucesso`);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao importar leads');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleMapsImport() {
    setLoading(true);
    setError('');
    try {
      // Aplicar a mesma cidade para todos os leads
      const citiesArray = spreadsheetData.map(() => singleCity);
      
      // Criar array de whatsapp para todos os leads (vistos até 10)
      const whatsappArray = spreadsheetData.map((_, idx) => whatsappStatus[idx] || false);
      
      // Criar array de site para todos os leads (vistos até 10)
      const siteArray = spreadsheetData.map((_, idx) => siteStatus[idx] || false);
      
      // Mesclar dados editados com dados extraídos
      const dataWithMetadata = spreadsheetData.map((lead, idx) => ({
        ...lead,
        // Usar valor editado ou manter o extraído
        telefone: telefones[idx] !== undefined ? telefones[idx] : (lead.telefone || ''),
        site: sites[idx] !== undefined ? sites[idx] : (lead.site || '')
      }));
      
      const res = await api.post('/leads/import-google-maps', {
        data: dataWithMetadata,
        cities: citiesArray,
        hasWhatsapp: whatsappArray,
        hasSite: siteArray
      });

      setSuccess(res.data.message || 'Leads importados com sucesso');
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao importar leads');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep(1);
    setFile(null);
    setSpreadsheetData(null);
    setColumns([]);
    setIsGoogleMaps(false);
    setMapping({ nome: '', telefone: '', cidade: '', servico: '', origem: '' });
    setSingleCity('');
    setWhatsappStatus({});
    setSiteStatus({});
    setDuplicates([]);
    setSites({});
    setTelefones({});
    setError('');
    setSuccess('');
  }

  async function handleScrapedData(scrapedData) {
    // Converter dados do scraper para o formato de lead
    setLoading(true);
    try {
      // Tentar salvar diretamente como um novo lead
      const leadData = {
        nome: scrapedData.nome,
        telefone: scrapedData.telefone,
        cidade: scrapedData.website ? new URL(scrapedData.website).hostname : '',
        servico: '',
        origem: 'Google Maps Scraper',
        avaliacoes: scrapedData.avaliacoes,
        temWhatsapp: !!scrapedData.telefone,
        temSite: !!scrapedData.website,
        site: scrapedData.website,
      };

      // Fazer POST direto para criar o lead
      const res = await api.post('/leads', leadData);
      
      if (res.data) {
        setSuccess(`✓ Lead "${scrapedData.nome}" importado com sucesso!`);
        setShowScraper(false);
        setError('');
        
        // Mostrar tela de sucesso por 3 segundos
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar lead: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Importar Leads</h1>
        <p className="text-gray-500 mt-2">
          Importe leads de uma planilha Excel, CSV ou diretamente do Google Maps
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                s <= step
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {s === 4 ? <Check className="w-5 h-5" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`w-12 h-1 mx-2 ${
                  s < step ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Erro</p>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Google Maps Scraper Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Google Maps Scraper
                  </h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Não quer fazer upload? Cole a URL de um negócio no Google Maps e extraímos os dados automaticamente!
                </p>
                <button
                  onClick={() => setShowScraper(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Link2 className="w-4 h-4" />
                  Usar Scraper
                </button>
              </div>
              <div className="text-4xl">📍</div>
            </div>
          </div>

          {/* OR Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="text-gray-500 font-medium">OU</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Upload Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Selecione seu arquivo
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                Suporta Excel (.xlsx, .xls), CSV ou Exportação do Google Maps
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="inline-block px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg cursor-pointer transition-colors"
              >
                Escolher arquivo
              </label>
              {file && (
                <p className="mt-4 text-sm text-green-600">
                  ✓ {file.name} selecionado
                </p>
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Processando...' : 'Próximo'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2A: Google Maps Mapping */}
      {step === 2 && isGoogleMaps && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Google Maps detectado!</p>
              <p className="text-sm text-blue-800 mt-1">
                {spreadsheetData?.length || 0} negócios encontrados.
              </p>
            </div>
          </div>

          {duplicates.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">{duplicates.length} duplicata(s) detectada(s)</p>
                <p className="text-sm text-yellow-800 mt-1">
                  {duplicates.map((d) => d.nome).join(', ')} já existem no sistema.
                </p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Qual é a cidade desses leads?
            </label>
            <input
              type="text"
              value={singleCity}
              onChange={(e) => setSingleCity(e.target.value)}
              placeholder="Ex: São Paulo, Rio de Janeiro, Joinville..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              Deixe em branco se quiser preencher depois
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Preview dos negócios a importar:</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              {spreadsheetData?.slice(0, 10).map((lead, idx) => (
                <div key={idx} className={`border rounded-lg p-3 ${duplicates.some(d => d.idx === idx) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{lead.nome}</p>
                      <p className="text-xs text-gray-600 mt-1">{lead.servico}</p>
                      {lead.avaliacao && (
                        <p className="text-xs text-yellow-600 mt-1">⭐ {lead.avaliacao} ({lead.reviews})</p>
                      )}
                      {duplicates.some(d => d.idx === idx) && (
                        <p className="text-xs text-red-600 mt-2 font-medium">⚠️ Duplicata detectada</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="tel"
                      placeholder="Telefone"
                      value={telefones[idx] || ''}
                      onChange={(e) => setTelefones({...telefones, [idx]: e.target.value})}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="url"
                      placeholder="Site (https://...)"
                      value={sites[idx] || ''}
                      onChange={(e) => setSites({...sites, [idx]: e.target.value})}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  {telefones[idx] && (
                    <p className="text-xs text-green-600 mb-2">✓ Telefone extraído</p>
                  )}
                  {sites[idx] && (
                    <p className="text-xs text-green-600 mb-2">✓ Site extraído</p>
                  )}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whatsappStatus[idx] || false}
                        onChange={(e) => setWhatsappStatus({...whatsappStatus, [idx]: e.target.checked})}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-600">WhatsApp</span>
                    </label>
                    {sites[idx] && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={siteStatus[idx] || false}
                          onChange={(e) => setSiteStatus({...siteStatus, [idx]: e.target.checked})}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-600">Confirmar Site</span>
                      </label>
                    )}
                  </div>
                </div>
              ))}
              {spreadsheetData && spreadsheetData.length > 10 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  ... e mais {spreadsheetData.length - 10} negócios
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2B: Normal Spreadsheet Mapping */}
      {step === 2 && !isGoogleMaps && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Mapear colunas da planilha
          </h2>

          <div className="space-y-6">
            {[
              { key: 'nome', label: 'Nome', required: true },
              { key: 'telefone', label: 'Telefone', required: true },
              { key: 'cidade', label: 'Cidade', required: false },
              { key: 'servico', label: 'Serviço', required: false },
              { key: 'origem', label: 'Origem', required: false }
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-600 ml-1">*</span>}
                </label>
                <select
                  value={mapping[field.key]}
                  onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione uma coluna...</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Preview dos dados:</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {columns.slice(0, 5).map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium text-gray-700">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spreadsheetData?.slice(0, 3).map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      {columns.slice(0, 5).map((col) => (
                        <td key={`${idx}-${col}`} className="px-3 py-2 text-gray-600">
                          {String(row[col] || '-').substring(0, 30)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Confirmar importação
          </h2>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-6">
            {isGoogleMaps ? (
              <>
                <p className="text-indigo-900">
                  Você está prestes a importar <strong>{spreadsheetData?.length || 0} negócios</strong> do Google Maps.
                </p>
                {singleCity && (
                  <p className="text-indigo-800 mt-3">
                    <strong>Cidade:</strong> {singleCity}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-indigo-900">
                  Você está prestes a importar <strong>{spreadsheetData?.length || 0} leads</strong> com o seguinte mapeamento:
                </p>
                <ul className="mt-4 space-y-2">
                  {Object.entries(mapping).map(([key, col]) => (
                    col && (
                      <li key={key} className="text-sm text-indigo-800">
                        <strong>{key}:</strong> {col}
                      </li>
                    )
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Importação concluída!
          </h2>
          <p className="text-gray-600 mb-8">{success}</p>

          <button
            onClick={handleReset}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Importar outro arquivo
          </button>
        </div>
      )}

      {/* Google Maps Scraper Modal */}
      {showScraper && (
        <GoogleMapsScraper
          onDataScraped={handleScrapedData}
          onClose={() => setShowScraper(false)}
        />
      )}
    </div>
  );
}
