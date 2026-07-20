import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  BarChart3,
  Folder,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  darkMode: boolean;
  setDarkMode: (d: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  darkMode,
  setDarkMode,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const coreNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: BarChart3 },
    { name: 'Projects', path: '/projects', icon: Folder },
  ];

  const renderNavLink = (item: { name: string; path: string; icon: React.ComponentType<{ size?: number; className?: string }> }) => {
    const Icon = item.icon;
    const isActive =
      location.pathname === item.path ||
      (item.path === '/projects' && location.pathname.startsWith('/projects/'));

    return (
      <NavLink
        key={item.name}
        to={item.path}
        className="relative flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all group overflow-hidden"
        title={collapsed ? item.name : ''}
      >
        {isActive && (
          <motion.div
            layoutId="activeNavBackground"
            className="absolute inset-0 bg-primary/10 dark:bg-primary/20 border-l-2 border-primary-hover z-0"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <Icon
          size={18}
          className={`flex-shrink-0 z-10 transition-colors duration-200 ${
            isActive
              ? 'text-primary'
              : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white'
          }`}
        />
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`z-10 transition-colors duration-200 ${
              isActive
                ? 'text-primary dark:text-white font-black'
                : 'text-slate-650 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white font-bold'
            }`}
          >
            {item.name}
          </motion.span>
        )}
      </NavLink>
    );
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-sidebar fixed left-0 top-0 h-screen z-30 flex flex-col justify-between py-6 px-4"
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-8 px-2 h-10">
          <AnimatePresence mode="wait">
            {!collapsed ? (
              <motion.div
                key="full-logo"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center space-x-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-secondary-magenta flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary/25">
                  A
                </div>
                <span className="font-bold text-lg tracking-tight text-slate-850 dark:text-white">
                  Amzur
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="collapsed-logo"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="w-10 h-10 rounded-lg bg-gradient-to-tr from-primary to-secondary-magenta flex items-center justify-center text-white font-bold text-xl mx-auto shadow-md shadow-primary/25"
              >
                A
              </motion.div>
            )}
          </AnimatePresence>

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {coreNavItems.map(renderNavLink)}
        </nav>
      </div>

      {/* Bottom Profile */}
      <div className="space-y-4">
        {/* Theme toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`flex items-center space-x-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Toggle Theme"
        >
          {darkMode ? <Sun size={18} className="text-amber-500 animate-pulse" /> : <Moon size={18} className="text-primary" />}
          {!collapsed && <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>}
        </button>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            title="Expand Sidebar"
          >
            <ChevronRight size={16} />
          </button>
        )}

        <hr className="border-slate-200 dark:border-slate-800/80" />

        {/* User Card */}
        {user && (
          <div
            className={`flex items-center justify-between ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {!collapsed && (
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary/20 to-secondary-magenta/20 flex items-center justify-center text-primary font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                    {user.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                    {user.role.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )}
            {collapsed && (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary/20 to-secondary-magenta/20 flex items-center justify-center text-primary font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}

            {!collapsed && (
              <button
                onClick={logout}
                className="p-2 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-600 dark:hover:bg-red-950/20 transition-colors"
                title="Log Out"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        )}
        
        {collapsed && (
          <button
            onClick={logout}
            className="flex items-center justify-center w-full py-2.5 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-600 dark:hover:bg-red-950/20 transition-colors"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </motion.aside>
  );
};
