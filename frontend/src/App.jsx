import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import ImportLeads from './pages/ImportLeads';
import Pipeline from './pages/Pipeline';
import WhatsAppAssistant from './pages/WhatsAppAssistant';
import AIKnowledge from './pages/AIKnowledge';
import AIAnalytics from './pages/AIAnalytics';
import AILearningSettings from './pages/AILearningSettings';
import SiteCreator from './pages/SiteCreator';
import SiteGallery from './pages/SiteGallery';
import SiteEditor from './pages/SiteEditor';
import SiteSettings from './pages/SiteSettings';

/**
 * O WhatsAppAssistant fica SEMPRE montado (fora das rotas) para que o
 * <webview> do WhatsApp Web NUNCA seja destruído ao navegar. Ele é apenas
 * ocultado via CSS quando a rota atual não é /whatsapp.
 */
function AppShell() {
  const location = useLocation();
  const isWhatsApp = location.pathname.startsWith('/whatsapp');
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/import-leads" element={<ImportLeads />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/ai/knowledge" element={<AIKnowledge />} />
        <Route path="/ai/analytics" element={<AIAnalytics />} />
        <Route path="/ai/settings" element={<AILearningSettings />} />
        <Route path="/sites" element={<SiteGallery />} />
        <Route path="/sites/novo" element={<SiteCreator />} />
        <Route path="/sites/config" element={<SiteSettings />} />
        <Route path="/sites/:id/editar" element={<SiteEditor />} />
      </Routes>
      {/* WhatsApp persistente — nunca desmonta, só oculta fora de /whatsapp */}
      <WhatsAppAssistant active={isWhatsApp} />
    </Layout>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </HashRouter>
  );
}
