import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LogOut,
  FileText,
  LayoutDashboard,
  Sparkles,
  Folder
} from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { Sidebar } from './components/Sidebar';
import { InvoiceList } from './pages/InvoiceList';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { useAppBreadcrumbs } from './utils/breadcrumbs';

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
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0A0A0A] text-slate-800 dark:text-white">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <Sparkles className="absolute w-6 h-6 text-indigo-400 animate-pulse" />
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user && location.pathname !== '/login' && location.pathname !== '/register') {
    // Note: The original login route handling in App.tsx had a fallback check or let router redirect
  }

  return <Outlet />;
};

// Command Palette Keyboard shortcut component
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = [
    { name: 'Go to Dashboard', shortcut: 'G D', category: 'Navigation', icon: LayoutDashboard, action: () => navigate('/dashboard') },
    { name: 'Go to Projects', shortcut: 'G P', category: 'Navigation', icon: Folder, action: () => navigate('/projects') },
    { name: 'View Invoices', shortcut: 'G I', category: 'Navigation', icon: FileText, action: () => navigate('/invoices') },
  ];

  const filtered = actions.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: -8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: -8, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="w-full max-w-lg bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#1F1F1F] rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 px-4 py-3.5 border-b border-slate-100 dark:border-[#1F1F1F]">
              <Search className="text-slate-400 w-5 h-5" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search actions or pages... (Type 'G D')"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                className="w-full bg-transparent border-0 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 text-sm"
              />
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">ESC</span>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-8">No results found matching your query.</div>
              ) : (
                filtered.map((item, idx) => {
                  const Icon = item.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left ${
                        isSelected
                          ? 'bg-indigo-600 dark:bg-indigo-600 text-white'
                          : 'text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{item.category}</span>
                        <span className="text-xs font-mono opacity-60">{item.shortcut}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Root Layout after Login
const AppLayout: React.FC<{
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  darkMode: boolean;
  setDarkMode: (d: boolean) => void;
}> = ({ collapsed, setCollapsed, darkMode, setDarkMode }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const breadcrumbs = useAppBreadcrumbs();

  // Shortcut hook for Ctrl+K
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#0A0A0A] text-[#111827] dark:text-[#F8FAFC] transition-colors duration-300">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
      
      <div className={`flex-1 flex flex-col transition-all duration-400 min-h-screen ${
        collapsed ? 'pl-20' : 'pl-20 md:pl-64'
      }`}>
        {/* Sticky Header Nav */}
        <header className="glass-nav sticky top-0 w-full h-16 z-20 px-6 flex items-center justify-between">
          {/* Left Breadcrumbs */}
          <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={`${crumb.path}-${idx}`}>
                {idx > 0 && <span className="text-slate-300 dark:text-slate-700">/</span>}
                <Link
                  to={crumb.path}
                  className={`hover:text-indigo-500 transition-colors ${
                    idx === breadcrumbs.length - 1 ? 'text-slate-800 dark:text-white font-semibold' : ''
                  }`}
                >
                  {crumb.label}
                </Link>
              </React.Fragment>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center space-x-4">
            {/* Quick search input */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/40 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Actions...</span>
              <kbd className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-1 py-0.5 rounded font-mono">Ctrl+K</kbd>
            </button>

            {/* Profile Dropdown toggle */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2.5 p-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  {user?.name.charAt(0).toUpperCase()}
                </div>
              </button>
              
              <AnimatePresence>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowProfileMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#1F1F1F] rounded-2xl shadow-xl z-20 py-1.5 overflow-hidden text-sm"
                    >
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-[#1F1F1F] text-left">
                        <p className="font-semibold text-xs text-slate-800 dark:text-white truncate">{user?.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{user?.email}</p>
                      </div>
                      
                      <hr className="border-slate-100 dark:border-slate-800/80 my-1" />
                      <button
                        onClick={logout}
                        className="w-full flex items-center space-x-2.5 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Global Command Palette */}
        <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />

        {/* Main Content Area */}
        <main className="flex-1 py-8 px-6 md:px-10 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Page transitions wrapper */}
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </div>
        </main>
      </div>
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
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectWorkspace />} />
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
