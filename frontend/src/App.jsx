import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import ImportLeads from './pages/ImportLeads';
import Pipeline from './pages/Pipeline';
import WhatsAppAssistant from './pages/WhatsAppAssistant';

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/leads" element={<Layout><Leads /></Layout>} />
          <Route path="/leads/:id" element={<Layout><LeadDetail /></Layout>} />
          <Route path="/import-leads" element={<Layout><ImportLeads /></Layout>} />
          <Route path="/pipeline" element={<Layout><Pipeline /></Layout>} />
          <Route path="/whatsapp" element={<Layout><WhatsAppAssistant /></Layout>} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
