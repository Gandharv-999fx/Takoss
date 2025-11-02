import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import {
  Sparkles,
  Plus,
  LogOut,
  Moon,
  Sun,
  Settings,
  Menu,
  X,
  Folder,
  Key,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Layout Component - Main application layout with navigation
 */
export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { user, logout, theme, toggleTheme, sidebarOpen, toggleSidebar } = useStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header / Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Menu Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition lg:hidden"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link to="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center transform rotate-3 hover:rotate-6 transition-transform">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Takoss</h1>
                  <p className="text-xs text-slate-500">AI Application Builder</p>
                </div>
              </Link>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* New Project Button - Desktop */}
              <Link
                to="/new"
                className="hidden md:flex items-center gap-2 btn-primary px-4 py-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                New Project
              </Link>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                title="Toggle theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              {/* Settings */}
              <button
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />

              {/* User Info */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-medium">{user?.name || user?.email}</p>
                  <p className="text-xs text-slate-500">Developer</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile User Menu */}
              <button
                onClick={handleLogout}
                className="sm:hidden p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Sidebar - Optional */}
        {sidebarOpen && (
          <aside className="w-64 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
            <nav className="p-4 space-y-2">
              <Link
                to="/"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <Folder className="w-5 h-5 text-indigo-600" />
                <span className="font-medium">Projects</span>
              </Link>

              <Link
                to="/new"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <Plus className="w-5 h-5 text-purple-600" />
                <span className="font-medium">New Project</span>
              </Link>

              <Link
                to="/api-keys"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <Key className="w-5 h-5 text-green-600" />
                <span className="font-medium">API Keys</span>
              </Link>

              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="px-4 py-2 text-xs text-slate-500 uppercase font-semibold">
                  Quick Actions
                </div>
                <button className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition text-sm">
                  Documentation
                </button>
                <button className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition text-sm">
                  Support
                </button>
              </div>
            </nav>
          </aside>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Floating Action Button - Mobile */}
      <Link
        to="/new"
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform z-40"
      >
        <Plus className="w-6 h-6 text-white" />
      </Link>
    </div>
  );
}
