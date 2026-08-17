import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { usePlatformAuth }  from '../context/PlatformAuthContext.jsx';
import { usePlatformTheme } from '../context/PlatformThemeContext.jsx';
import {
  LayoutDashboard, Building2, LogOut, Shield,
  Menu, X, Bell, Search, Sun, Moon
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/platform/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/platform/tenants',   icon: Building2,        label: 'Tenants'   },
];

const PlatformLayout = ({ children }) => {
  const { superAdmin, logout }   = usePlatformAuth();
  const { isDark, toggleTheme }  = usePlatformTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Theme token maps ────────────────────────────────────────────────────────
  const t = isDark ? {
    bg:          'bg-[#0a0a12]',
    sidebar:     'bg-[#0e0e1a] border-violet-900/20',
    header:      'bg-[#0e0e1a]/90 border-violet-900/20',
    text:        'text-slate-100',
    textMuted:   'text-slate-400',
    textSubtle:  'text-slate-500',
    border:      'border-violet-900/30',
    navActive:   'bg-violet-600/20 text-violet-300 border border-violet-500/30',
    navHover:    'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
    input:       'bg-slate-800/60 border-slate-700/50 text-slate-300 placeholder:text-slate-600 focus:border-violet-500/50',
    btn:         'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-white',
    avatarBg:    'bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-300',
    avatarText:  'text-slate-200',
    avatarSub:   'text-violet-400',
    userCard:    'border-violet-900/30',
    toggleIcon:  <Sun  className="w-4 h-4 text-amber-400" />,
    toggleTip:   'Switch to Light Mode',
    overlay:     'bg-black/60 backdrop-blur-sm',
    main:        'bg-[#0a0a12]',
    logoutText:  'text-red-400 hover:text-red-300 hover:bg-red-500/10',
  } : {
    bg:          'bg-slate-50',
    sidebar:     'bg-white border-slate-200',
    header:      'bg-white/90 border-slate-200',
    text:        'text-slate-800',
    textMuted:   'text-slate-500',
    textSubtle:  'text-slate-400',
    border:      'border-slate-200',
    navActive:   'bg-violet-50 text-violet-700 border border-violet-200',
    navHover:    'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
    input:       'bg-slate-100 border-slate-300 text-slate-700 placeholder:text-slate-400 focus:border-violet-400',
    btn:         'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50',
    avatarBg:    'bg-violet-100 border-violet-200 text-violet-600',
    avatarText:  'text-slate-700',
    avatarSub:   'text-violet-500',
    userCard:    'border-slate-200',
    toggleIcon:  <Moon className="w-4 h-4 text-indigo-500" />,
    toggleTip:   'Switch to Dark Mode',
    overlay:     'bg-black/30 backdrop-blur-sm',
    main:        'bg-slate-50',
    logoutText:  'text-red-500 hover:text-red-600 hover:bg-red-50',
  };

  // ── Sidebar Content ─────────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`px-6 py-5 border-b ${t.border} flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
            PropertyNex
          </h1>
          <p className="text-violet-500 text-[10px] font-bold uppercase tracking-widest">
            Platform Admin
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive ? t.navActive : t.navHover
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User Card */}
      <div className={`px-3 py-4 border-t ${t.userCard}`}>
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-sm shrink-0 ${t.avatarBg}`}>
            {superAdmin?.name?.charAt(0)?.toUpperCase() || 'S'}
          </div>
          <div className="min-w-0">
            <p className={`text-xs font-semibold truncate ${t.avatarText}`}>
              {superAdmin?.name || 'Super Admin'}
            </p>
            <p className={`text-[10px] truncate ${t.avatarSub}`}>
              {superAdmin?.email}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${t.logoutText}`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} flex transition-colors duration-300`}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex w-60 border-r flex-col shrink-0 transition-colors duration-300 ${t.sidebar}`}>
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className={`fixed inset-0 z-40 lg:hidden ${t.overlay}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-64 border-r flex flex-col z-50 transition-all duration-300 lg:hidden ${t.sidebar} ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className={`absolute top-4 right-4 w-8 h-8 border rounded-lg flex items-center justify-center transition-colors ${t.btn}`}
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className={`h-14 backdrop-blur-sm border-b px-4 md:px-6 flex items-center justify-between shrink-0 gap-4 transition-colors duration-300 ${t.header}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden w-9 h-9 border rounded-lg flex items-center justify-center transition-colors ${t.btn}`}
            >
              <Menu className="w-4 h-4" />
            </button>
            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-2 text-xs">
              <Shield className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-violet-500 font-medium">Platform</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="hidden md:flex items-center">
              <div className="relative">
                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${t.textSubtle}`} />
                <input
                  type="text"
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`pl-8 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400/30 w-44 transition-all duration-200 focus:w-56 ${t.input}`}
                />
              </div>
            </div>

            {/* Theme Toggle */}
            <button
              id="platform-theme-toggle"
              onClick={toggleTheme}
              title={t.toggleTip}
              className={`w-9 h-9 border rounded-lg flex items-center justify-center transition-all duration-200 ${t.btn}`}
            >
              {t.toggleIcon}
            </button>

            {/* Notifications */}
            <button className={`relative w-9 h-9 border rounded-lg flex items-center justify-center transition-colors ${t.btn}`}>
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-violet-500 rounded-full" />
            </button>

            {/* Admin avatar */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${t.avatarBg}`}>
                {superAdmin?.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${t.textMuted}`}>
                {superAdmin?.name?.split(' ')[0] || 'Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 overflow-auto transition-colors duration-300 ${t.main}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default PlatformLayout;
