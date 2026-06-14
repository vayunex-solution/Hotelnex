import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  LayoutDashboard, BedDouble, History, LogOut, Hotel, 
  Clock, User, Users, CalendarRange, Menu, X 
} from 'lucide-react';

const NAV_LINKS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/rooms', icon: BedDouble, label: 'Rooms' },
  { to: '/bookings', icon: CalendarRange, label: 'Bookings' },
  { to: '/history', icon: History, label: 'Booking History' },
  { to: '/guests', icon: Users, label: 'Guests' },
];

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const [time, setTime] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDate = (date) =>
    date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const SidebarContent = () => (
    <>
      <div>
        {/* Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10 shrink-0">
            <Hotel className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight text-sm">Grand Vayunex</h1>
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Management</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          {NAV_LINKS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-3 mb-3">
          <div className="w-9 h-9 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-indigo-400 font-semibold text-sm shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Receptionist'}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'Staff'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 flex-col justify-between shrink-0">
        <SidebarContent />
      </aside>

      {/* ── MOBILE SIDEBAR OVERLAY ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between z-50 transition-transform duration-300 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button inside mobile sidebar */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:text-white z-10"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* ── MAIN CONTENT AREA ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3">
            {/* Hamburger — only on mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
            <Hotel className="w-5 h-5 text-slate-400 hidden sm:block" />
            <span className="font-semibold text-slate-200 text-sm truncate">Grand Vayunex Hotel</span>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            {/* Clock — hidden on very small screens */}
            <div className="hidden md:flex items-center gap-2 text-slate-400 border-r border-slate-800 pr-5 text-xs">
              <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="hidden lg:inline">{formatDate(time)}</span>
              <span className="font-semibold text-slate-200 ml-1">{formatTime(time)}</span>
            </div>

            {/* Profile info */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xs hidden sm:block">
                <span className="block font-semibold text-slate-300 truncate max-w-[100px]">{user?.name}</span>
                <span className="block text-[10px] text-slate-500 truncate max-w-[100px]">{user?.email}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
