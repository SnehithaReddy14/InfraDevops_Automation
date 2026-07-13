import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  UploadCloud,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  MessageSquareCode,
  History
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

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Invoices', path: '/invoices', icon: FileText },
    { name: 'Upload Invoice', path: '/upload', icon: UploadCloud },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Audit Logs', path: '/audit-logs', icon: History },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`glass-sidebar fixed left-0 top-0 h-screen z-30 transition-all duration-300 flex flex-col justify-between py-6 px-4 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-8 px-2">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary/20">
                A
              </div>
              <span className="font-bold text-lg tracking-tight text-slate-800 dark:text-white">
                Antigravity <span className="text-primary font-medium text-xs">SaaS</span>
              </span>
            </div>
          )}
          {collapsed && (
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl mx-auto shadow-md">
              A
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? item.name : ''}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile and Settings */}
      <div className="space-y-4">
        {/* Dark Mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Toggle Theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <hr className="border-slate-200 dark:border-slate-800" />

        {/* User Card */}
        {user && (
          <div
            className={`flex items-center justify-between ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {!collapsed && (
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                    {user.name}
                  </span>
                  <span className="text-xs text-slate-500 truncate dark:text-slate-400">
                    {user.role.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )}
            {collapsed && (
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}

            {!collapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 dark:hover:bg-red-950/20 transition-colors"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}
        
        {collapsed && (
          <button
            onClick={logout}
            className="flex items-center justify-center w-full py-2 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 dark:hover:bg-red-950/20 transition-colors"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
};
