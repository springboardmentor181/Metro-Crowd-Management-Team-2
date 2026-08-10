import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Check, ArrowRight, MapPinned } from 'lucide-react';
import SearchBar from '@/components/common/SearchBar';
import Button from '@/components/common/Button';
import Badge, { statusToTone } from '@/components/common/Badge';
import AdminOTPModal from '@/components/auth/AdminOTPModal';
import { generateCityData } from '@/data/cityDataGenerator';
import { getCityById } from '@/data/cities';
import { useApp } from '@/hooks/useApp';
import { ROLES, ROUTES } from '@/constants';

/**
 * Second step of the Administrator "Continue As" flow — pick the specific
 * metro station within the city chosen on the previous screen. Only after
 * a station is picked does the employee-verification popup (Employee
 * Role, ID, phone + OTP) appear; role/city/station are committed to
 * AppContext only once that verification succeeds.
 */
export default function AdminSelectStation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setRole, setCityId, setStation, setEmployeeId, setEmployeeRole } = useApp();

  const cityId = location.state?.cityId;
  const city = cityId ? getCityById(cityId) : null;
  const stations = useMemo(() => (cityId ? generateCityData(cityId)?.stations || [] : []), [cityId]);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const filtered = useMemo(
    () => stations.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.line.toLowerCase().includes(query.toLowerCase())),
    [stations, query]
  );

  if (!cityId || !city) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-gradient px-4 text-center">
        <p className="text-sm text-slate-500">Please select a metro city first.</p>
        <Button onClick={() => navigate(ROUTES.ADMIN_SELECT_CITY)}>Select Metro City</Button>
      </div>
    );
  }

  const selectedStation = stations.find((s) => s.id === selected);

  const handleVerified = (_verifiedCityId, employeeId, employeeRole) => {
    setRole(ROLES.ADMIN);
    setCityId(cityId);
    setStation({ id: selectedStation.id, name: selectedStation.name, line: selectedStation.line });
    setEmployeeId(employeeId);
    setEmployeeRole(employeeRole);
    toast.success(`Welcome, verified for ${selectedStation.name}.`);
    navigate(ROUTES.ADMIN.DASHBOARD);
  };

  return (
    <div className="min-h-screen bg-app-gradient px-4 py-12">
      <button
        onClick={() => navigate(ROUTES.ADMIN_SELECT_CITY)}
        className="absolute left-4 top-4 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white/60 focus-ring sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-brand-600">Administrator Setup — Step 2 of 3</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 sm:text-4xl">Select Metro Station</h1>
          <p className="mt-2 text-sm text-slate-500">
            Choose the station you&apos;ll be managing on <span className="font-semibold text-slate-700">{city.name}</span>.
          </p>
        </div>

        <div className="mx-auto mb-8 max-w-md">
          <SearchBar value={query} onChange={setQuery} placeholder="Search Metro Station…" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((station, i) => {
            const isSelected = selected === station.id;
            return (
              <motion.button
                key={station.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.02 }}
                whileHover={{ y: -4 }}
                onClick={() => setSelected(station.id)}
                className={`relative overflow-hidden rounded-2xl glass-panel p-5 text-left transition-shadow focus-ring ${
                  isSelected ? 'ring-2 ring-brand-500 shadow-premium' : 'hover:shadow-premium'
                }`}
              >
                {isSelected && (
                  <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-brand-700 text-white shadow-md">
                  <MapPin className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-slate-900">{station.name}</h3>
                <p className="mt-0.5 text-xs" style={{ color: station.lineColor }}>{station.line}</p>
                <div className="mt-3">
                  <Badge tone={statusToTone(station.status)}>{station.statusLabel}</Badge>
                </div>
              </motion.button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-slate-400">
            <MapPinned className="h-8 w-8" />
            <p>No metro station matches &quot;{query}&quot;.</p>
          </div>
        )}

        <div className="sticky bottom-6 z-10 mt-10 flex justify-center">
          <Button size="lg" icon={ArrowRight} iconPosition="right" disabled={!selected} onClick={() => setVerifyOpen(true)} className="shadow-2xl">
            Continue
          </Button>
        </div>
      </motion.div>

      <AdminOTPModal
        isOpen={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        onVerified={handleVerified}
        title="Employee Verification"
        subtitle={selectedStation ? `Confirm your assignment to ${selectedStation.name}` : 'Confirm your assignment'}
      />
    </div>
  );
}
