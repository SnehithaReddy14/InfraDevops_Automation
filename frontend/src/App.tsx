import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { Sidebar } from './components/Sidebar';
import { AIAssistant } from './components/AIAssistant';
import { Dashboard } from './pages/Dashboard';
import { InvoiceList } from './pages/InvoiceList';
import { InvoiceUpload } from './pages/InvoiceUpload';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Analytics } from './pages/Analytics';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Protected Route Wrapper
const ProtectedRoute = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
      </div>
    );
  }

  return <Outlet />;
};

// Root Layout after Login
const AppLayout: React.FC<{
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  darkMode: boolean;
  setDarkMode: (d: boolean) => void;
}> = ({ collapsed, setCollapsed, darkMode, setDarkMode }) => {
  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
      <main
        className={`flex-1 transition-all duration-300 min-h-screen py-8 px-4 md:px-8 ${
          collapsed ? 'pl-24' : 'pl-24 md:pl-72'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <AIAssistant />
    </div>
  );
};

export const AppContent = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <Routes>
      {/* App Routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <AppLayout
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
            />
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/upload" element={<InvoiceUpload />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Redirect Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
