/**
 * EXEMPLO: Como integrar Google Maps Scraper no ImportLeads
 * 
 * Copie e adapte este código na página ImportLeads.jsx
 */

import { useState } from 'react';
import GoogleMapsScraper from '../components/Scraper/GoogleMapsScraper';

// Adicione esses estados ao seu componente ImportLeads:

export default function ImportLeadsExample() {
  const [showScraper, setShowScraper] = useState(false);
  const [spreadsheetData, setSpreadsheetData] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * Callback quando dados são scrapeados
   */
  function handleScrapedData(scrapedData) {
    console.log('📍 Dados scrapeados:', scrapedData);

    // Criar novo lead com dados do scraper
    const newLead = {
      id: Math.random().toString(36).substr(2, 9), // ID temporário
      nome: scrapedData.nome || '',
      telefone: scrapedData.telefone || '',
      cidade: scrapedData.endereco?.split(',')[0] || '', // Primeira parte do endereço
      servico: '', // Usuário pode preencher depois
      origem: 'Google Maps',
      site: scrapedData.website || '',
      avaliacoes: scrapedData.avaliacoes || null,
      endereco: scrapedData.endereco || '',
      temWhatsapp: !!scrapedData.telefone, // Se tem telefone, marca como potencial WhatsApp
      temSite: !!scrapedData.website,
    };

    // Adicionar à lista de dados
    setSpreadsheetData(prev => [...prev, newLead]);

    // Fechar modal
    setShowScraper(false);

    // Mostrar notificação de sucesso
    alert(`✅ Lead "${newLead.nome}" adicionado com sucesso pelo scraper!`);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex gap-3">
        {/* Botão para abrir o scraper */}
        <button
          onClick={() => setShowScraper(true)}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          📍 Google Maps Scraper
        </button>

        {/* Outro botão para upload normal */}
        <button
          className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          📁 Upload Planilha
        </button>
      </div>

      {/* Modal do scraper */}
      {showScraper && (
        <GoogleMapsScraper
          onDataScraped={handleScrapedData}
          onClose={() => setShowScraper(false)}
        />
      )}

      {/* Mostrar leads adicionados */}
      {spreadsheetData.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Leads Adicionados ({spreadsheetData.length})
          </h2>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    Telefone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    Cidade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    Origem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {spreadsheetData.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {lead.nome}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {lead.telefone || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {lead.cidade || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                        {lead.origem}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => {
                          setSpreadsheetData(prev =>
                            prev.filter(l => l.id !== lead.id)
                          );
                        }}
                        className="text-red-600 hover:text-red-700 font-medium text-xs"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botão para salvar todos */}
          <div className="mt-6 flex gap-3">
            <button
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Todos os Leads'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ROTEIRO DE INTEGRAÇÃO PASSO A PASSO:
 * 
 * 1. Copie o arquivo GoogleMapsScraper.jsx para:
 *    frontend/src/components/Scraper/GoogleMapsScraper.jsx
 * 
 * 2. Adapte seu ImportLeads.jsx:
 *    - Importe: import GoogleMapsScraper from '../components/Scraper/GoogleMapsScraper'
 *    - Adicione estado: const [showScraper, setShowScraper] = useState(false)
 *    - Crie função handleScrapedData (veja acima)
 *    - Adicione botão e modal (veja JSX acima)
 * 
 * 3. No backend (já feito):
 *    - Arquivo: backend/src/services/scraper.service.js
 *    - Arquivo: backend/src/controllers/scraper.controller.js
 *    - Arquivo: backend/src/routes/scraper.routes.js
 *    - Integrado em: backend/src/app.js
 * 
 * 4. Teste localmente:
 *    - npm run dev (frontend)
 *    - npm run dev (backend em outra aba)
 *    - Acesse http://localhost:5173/import-leads
 *    - Clique em "Google Maps Scraper"
 *    - Cole URL: https://maps.google.com/maps/place/algum+lugar
 * 
 * 5. Despise (opcional):
 *    - Deploy frontend e backend normalmente
 *    - Módulo já incluído!
 */
