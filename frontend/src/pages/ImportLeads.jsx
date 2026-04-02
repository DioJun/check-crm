import { useState } from 'react';
import { Upload, ArrowRight, Check, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function ImportLeads() {
  const [step, setStep] = useState(1); // 1: upload, 2: mapping, 3: confirm, 4: success
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data from spreadsheet
  const [spreadsheetData, setSpreadsheetData] = useState(null);
  const [columns, setColumns] = useState([]);

  // Mapping state
  const [mapping, setMapping] = useState({
    nome: '',
    telefone: '',
    cidade: '',
    servico: '',
    origem: '',
  });

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
      setColumns(res.data.columns);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar arquivo');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!mapping.nome || !mapping.telefone) {
      setError('Você deve mapear pelo menos Nome e Telefone');
      return;
    }

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

  function handleReset() {
    setStep(1);
    setFile(null);
    setSpreadsheetData(null);
    setColumns([]);
    setMapping({ nome: '', telefone: '', cidade: '', servico: '', origem: '' });
    setError('');
    setSuccess('');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Importar Leads</h1>
        <p className="text-gray-500 mt-2">
          Importe leads de uma planilha Excel ou CSV
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
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Selecione seu arquivo
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Arraste ou clique para selecionar um arquivo Excel (.xlsx, .xls) ou CSV
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
      )}

      {/* Step 2: Mapping */}
      {step === 2 && (
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
    </div>
  );
}
