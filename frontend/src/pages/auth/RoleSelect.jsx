import { motion } from 'framer-motion';
import { Users, ShieldCheck, MapPin, Sparkles, BarChart3, CalendarClock, FileBarChart, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { ROLES, ROUTES, APP_NAME } from '@/constants';

const OPTIONS = [
  {
    role: ROLES.PASSENGER,
    title: 'Passenger',
    icon: Users,
    gradient: 'from-brand-500 to-violet-600',
    features: [
      { icon: BarChart3, text: 'View crowd information' },
      { icon: MapPin, text: 'Plan your journey' },
      { icon: Sparkles, text: 'AI travel suggestions' },
      { icon: MapPin, text: 'Live metro map' },
    ],
  },
  {
    role: ROLES.ADMIN,
    title: 'Administrator',
    icon: ShieldCheck,
    gradient: 'from-slate-800 to-brand-700',
    features: [
      { icon: BarChart3, text: 'Monitor stations' },
      { icon: FileBarChart, text: 'View analytics' },
      { icon: Sparkles, text: 'AI crowd prediction' },
      { icon: CalendarClock, text: 'Train scheduling' },
    ],
  },
];

export default function RoleSelect() {
  const { user } = useAuth();
  const { setRole } = useApp();
  const navigate = useNavigate();

  const handleSelect = (role) => {
    setRole(role);
    navigate(ROUTES.SELECT_CITY);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-3xl"
      >
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-brand-600">Welcome, {user?.name?.split(' ')[0]}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 sm:text-4xl">Continue As</h1>
          <p className="mt-2 text-sm text-slate-500">Choose how you&apos;d like to use {APP_NAME}.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {OPTIONS.map((opt, i) => (
            <motion.button
              key={opt.role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
              whileHover={{ y: -6 }}
              onClick={() => handleSelect(opt.role)}
              className="group relative overflow-hidden rounded-3xl glass-panel p-7 text-left shadow-premium transition-shadow focus-ring"
            >
              <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${opt.gradient} opacity-20 blur-2xl transition-opacity group-hover:opacity-30`} />
              <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${opt.gradient} text-white shadow-lg`}>
                <opt.icon className="h-7 w-7" />
              </div>
              <h3 className="relative mt-5 font-display text-xl font-bold text-slate-900">{opt.title}</h3>
              <ul className="relative mt-4 space-y-2.5">
                {opt.features.map((f) => (
                  <li key={f.text} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
                      <Check className="h-3 w-3" />
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <div className="relative mt-6 flex items-center gap-1.5 text-sm font-semibold text-brand-600 group-hover:gap-2.5 transition-all">
                Continue as {opt.title} <span aria-hidden>→</span>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
