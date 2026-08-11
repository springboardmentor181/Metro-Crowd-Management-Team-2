import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, ChevronDown, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import SearchBar from '@/components/common/SearchBar';
import ChangeCityModal from '@/components/modals/ChangeCityModal';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { getInitials } from '@/utils/formatters';
import { ROUTES } from '@/constants';

export default function AdminNavbar({ onOpenMobileMenu }) {
  const { user, logout } = useAuth();
  const { city, resetSelection } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [changeCityOpen, setChangeCityOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    resetSelection();
    navigate(ROUTES.LOGIN);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl px-4 lg:px-6">
        <button onClick={onOpenMobileMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>

        <button
          onClick={() => setChangeCityOpen(true)}
          className="hidden items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 focus-ring sm:flex"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {city?.name}
        </button>

        <div className="hidden flex-1 max-w-md md:block">
          <SearchBar value={query} onChange={setQuery} placeholder="Search stations, trains, reports…" />
        </div>
        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setChangeCityOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-brand-600 focus-ring sm:hidden"
            aria-label="Change city"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 hover:bg-slate-50 focus-ring"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-brand-700 text-xs font-bold text-white">
                {getInitials(user?.name)}
              </div>
              <span className="hidden text-sm font-medium text-slate-700 sm:block">{user?.name?.split(' ')[0] || 'Admin'}</span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-xl border border-slate-200 bg-white shadow-lg animate-fade-in">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
                  <p className="truncate text-xs text-slate-400">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500">
                    <ShieldCheck className="h-4 w-4" /> Administrator
                  </div>
                  <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10">
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <ChangeCityModal isOpen={changeCityOpen} onClose={() => setChangeCityOpen(false)} />
    </>
  );
}
