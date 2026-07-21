import React, { useState, useEffect, useRef, memo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarCheck, BookOpen, Settings,
  Menu, X, Briefcase, GraduationCap, FileText, DollarSign,
  User as UserIcon, ShieldAlert, ChevronLeft, ChevronRight,
  ShieldCheck, TrendingUp, ChevronDown, Sparkles
} from 'lucide-react';

// ── NAV CONFIGURATION ──
const NAV_CONFIG = {
  owner: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/analytics', label: 'Analytics', icon: TrendingUp },
    { path: '/admin', label: 'Admin Console', icon: ShieldCheck },
    { path: '/students', label: 'Students', icon: Users },
    { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
    { path: '/assignments', label: 'Assignments', icon: BookOpen },
    { path: '/library', label: 'Library', icon: FileText },
    { path: '/finance', label: 'Finance', icon: DollarSign },
    { path: '/staff', label: 'Teachers', icon: Briefcase },
    { path: '/settings', label: 'Settings', icon: Settings },
  ],
  head_manager: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/analytics', label: 'Analytics', icon: TrendingUp },
    { path: '/admin', label: 'Admin Console', icon: ShieldCheck },
    { path: '/students', label: 'Students', icon: Users },
    { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
    { path: '/assignments', label: 'Assignments', icon: BookOpen },
    { path: '/library', label: 'Library', icon: FileText },
    { path: '/finance', label: 'Finance', icon: DollarSign },
    { path: '/staff', label: 'Teachers', icon: Briefcase },
  ],
  manager: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
    { path: '/students', label: 'Students', icon: GraduationCap },
    { path: '/assignments', label: 'Assignments', icon: BookOpen },
    { path: '/library', label: 'Library', icon: FileText },
    { path: '/staff', label: 'Teachers', icon: Briefcase },
  ],
  teacher: [
    { path: '/dashboard', label: 'Classroom', icon: LayoutDashboard },
    { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
    { path: '/students', label: 'Students', icon: Users },
    { path: '/assignments', label: 'Assignments', icon: BookOpen },
    { path: '/library', label: 'Library', icon: FileText },
    { path: '/settings', label: 'Settings', icon: Settings },
  ],
  parent: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
    { path: '/assignments', label: 'Assignments', icon: BookOpen },
    { path: '/finance', label: 'Billing', icon: DollarSign },
    { path: '/settings', label: 'Settings', icon: UserIcon },
  ],
  student: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/assignments', label: 'Assignments', icon: BookOpen },
    { path: '/library', label: 'Library', icon: FileText },
    { path: '/settings', label: 'Settings', icon: UserIcon },
  ],
};

const ROLE_LABELS = {
  owner: 'Owner',
  head_manager: 'Head Manager',
  manager: 'Manager',
  teacher: 'Teacher',
  parent: 'Parent',
  student: 'Student',
};

// ── EDGE OPTIMIZATION: Memoized Sidebar ──
// React.memo prevents this massive component from re-rendering when the user scrolls the main page.
const SidebarContent = memo(({
  isCollapsed,
  setIsCollapsed,
  currentMenu,
  roleLabel,
  pathname,
  navigate,
  setIsMobileMenuOpen
}) => (
  <div className="flex flex-col h-full bg-emerald-950 relative pointer-events-auto shadow-2xl z-50 transform-gpu">

    {/* SaaS Collapse Toggle */}
    <button
      onClick={() => setIsCollapsed(!isCollapsed)}
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="hidden md:flex absolute -right-3.5 top-8 h-7 w-7 bg-white border border-emerald-100 rounded-full items-center justify-center text-emerald-900 shadow-md hover:scale-110 transition-transform z-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
    >
      {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>

    {/* Brand Header */}
    <div className={`h-20 flex items-center shrink-0 border-b border-white/5 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'px-6'}`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-emerald-800 rounded-xl flex items-center justify-center text-gold-400 font-black shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-500/30 shrink-0">
          Q
        </div>
        {!isCollapsed && (
          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-200 tracking-tight whitespace-nowrap animate-in fade-in duration-300">
            Quranific
          </span>
        )}
      </div>
    </div>

    {/* Navigation Links */}
    <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto overflow-x-hidden relative z-10 custom-scrollbar [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-emerald-800/40 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-700/60 transition-colors">
      {!isCollapsed && (
        <p className="px-3 text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 whitespace-nowrap">
          {roleLabel} Portal
        </p>
      )}

      {currentMenu.map((item) => {
        const Icon = item.icon ?? DollarSign;
        const isActive = pathname === item.path || (pathname.startsWith(item.path + '/') && item.path !== '/');

        return (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center rounded-xl transition-all duration-300 group relative focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${isCollapsed ? 'justify-center py-3' : 'px-3 py-2.5 gap-3'} ${isActive ? 'bg-emerald-500/20 text-white shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] border border-emerald-500/40' : 'text-emerald-400/70 hover:bg-white/5 hover:text-emerald-100 border border-transparent'}`}
          >
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1.5 bg-gradient-to-b from-gold-300 to-gold-500 rounded-r-full shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
            )}

            <Icon
              size={isCollapsed ? 22 : 18}
              strokeWidth={isActive ? 2.5 : 2}
              className={`shrink-0 transition-all duration-300 ${isActive ? 'text-gold-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'group-hover:text-emerald-300 group-hover:scale-110'}`}
            />

            {!isCollapsed && (
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all ${isActive ? 'font-black' : 'font-medium'}`}>
                {item.label}
              </span>
            )}

            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-14 bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl whitespace-nowrap z-50 border border-white/10">
                {item.label}
              </div>
            )}
          </button>
        );
      })}
    </nav>

    {/* Footer */}
    <div className="p-4 border-t border-white/5 bg-emerald-950/80 backdrop-blur-xl shrink-0 flex items-center justify-center mt-auto">
      {isCollapsed ? (
        <ShieldCheck size={16} className="text-emerald-500/40" />
      ) : (
        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/40 uppercase tracking-widest">
          <ShieldCheck size={14} /> Protected Area
        </div>
      )}
    </div>
  </div>
));

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // ── Scroll Listener ──
  useEffect(() => {
    const mainContent = document.getElementById('main-scroll-area');
    if (!mainContent) return;
    const handleScroll = () => setIsScrolled(mainContent.scrollTop > 10);
    mainContent.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainContent.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Mobile Scroll-Bleed Lock ──
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  // ── Profile Dropdown Outside Click ──
  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  const userType = localStorage.getItem('user_type') || 'student';
  const username = localStorage.getItem('username') || 'User';
  const roleLabel = ROLE_LABELS[userType] ?? 'User';
  const currentMenu = NAV_CONFIG[userType] ?? NAV_CONFIG.student;

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    // UX FIX: Strict overflow-hidden to prevent global X-axis scrolling
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden selection:bg-emerald-500/30 w-full">

      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col border-r border-emerald-900/10 relative bg-emerald-950 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[width] shadow-[4px_0_24px_rgba(0,0,0,0.05)] ${isCollapsed ? 'w-[88px]' : 'w-[280px]'}`}>
        <SidebarContent
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          currentMenu={currentMenu}
          roleLabel={roleLabel}
          pathname={location.pathname}
          navigate={navigate}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity transform-gpu"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <div className={`fixed inset-y-0 left-0 w-[280px] max-w-[80vw] bg-emerald-950 z-50 transform-gpu transition-transform duration-300 ease-out md:hidden shadow-2xl border-r border-emerald-800 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button
          aria-label="Close mobile menu"
          onClick={() => setIsMobileMenuOpen(false)}
          className="absolute top-6 right-4 text-emerald-400 hover:text-white p-2 z-50 bg-white/5 rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <X size={20} />
        </button>
        <SidebarContent
          isCollapsed={false}
          setIsCollapsed={() => { }}
          currentMenu={currentMenu}
          roleLabel={roleLabel}
          pathname={location.pathname}
          navigate={navigate}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative min-w-0">

        {/* Top Header */}
        <header className={`h-20 flex items-center justify-between px-6 md:px-10 sticky top-0 z-30 transition-all duration-300 transform-gpu ${isScrolled ? 'bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm' : 'bg-transparent'}`}>
          <div className="flex items-center gap-4">
            <button
              aria-label="Open mobile menu"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-emerald-800 hover:bg-emerald-100 rounded-xl transition-colors shadow-sm bg-white/80 border border-emerald-200/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:flex flex-col">
              <span className="font-black text-slate-900 text-xl tracking-tight capitalize flex items-center gap-2">
                Welcome back, {username} <Sparkles size={18} className="text-gold-500" />
              </span>
              <span className="text-xs text-slate-500 font-bold tracking-wider uppercase mt-0.5">Secure Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-3 p-1.5 pr-3 bg-white/80 hover:bg-white border border-slate-200/80 hover:border-emerald-300 rounded-full shadow-sm hover:shadow-md transition-all group focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <div className="h-8 w-8 bg-emerald-600 rounded-full flex items-center justify-center text-white font-black text-xs shadow-inner">
                  {username.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-sm font-bold text-slate-800 leading-none capitalize group-hover:text-emerald-700 transition-colors">{username}</span>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu - UX FIX: origin-top-right for native feeling spring animation */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-3 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right duration-200 z-50">
                  <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                    <p className="text-sm font-black text-slate-900 truncate">{username}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => { navigate('/settings'); setIsProfileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <UserIcon size={16} /> My Profile
                    </button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button
                      onClick={() => { handleLogout(); setIsProfileMenuOpen(false); }}
                      className="w-full flex items-center px-3 py-2 text-sm font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Page Outlet - UX FIX: Explicit overflow-x-hidden injected here */}
        <main id="main-scroll-area" className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 scroll-smooth pb-24 z-10 transform-gpu will-change-scroll custom-main-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
          <Outlet />
        </main>

        {/* Global Footer */}
        <footer className="bg-transparent text-slate-400 py-4 px-6 text-center text-xs font-bold tracking-wide shrink-0 z-10 relative border-t border-slate-200/50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
            <span>© {new Date().getFullYear()} Quranific Academy.</span>
            <span className="flex items-center gap-1.5"><ShieldAlert size={12} className="text-emerald-400" /> Enterprise Secured</span>
          </div>
        </footer>

      </div>
    </div>
  );
}