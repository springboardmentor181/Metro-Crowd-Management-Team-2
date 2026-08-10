import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X, Sparkles } from 'lucide-react';
import { useCityData } from '@/hooks/useCityData';

const SHOW_AFTER_MS = 14000;
const AUTO_DISMISS_MS = 8000;

/**
 * Periodically surfaces a high-crowd station as an animated toast-style
 * alert (per spec: no dedicated notifications page — alerts are ephemeral
 * popups). Picks from the current city's riskiest stations.
 */
export default function HighCrowdAlert() {
  const cityData = useCityData();
  const [station, setStation] = useState(null);

  const trigger = useCallback(() => {
    if (!cityData) return;
    const candidates = cityData.riskStations.filter((s) => s.occupancy >= 85);
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setStation(pick);
  }, [cityData]);

  useEffect(() => {
    if (!cityData) return;
    const showTimer = setTimeout(trigger, SHOW_AFTER_MS);
    return () => clearTimeout(showTimer);
  }, [cityData, trigger]);

  useEffect(() => {
    if (!station) return;
    const dismissTimer = setTimeout(() => setStation(null), AUTO_DISMISS_MS);
    return () => clearTimeout(dismissTimer);
  }, [station]);

  if (!cityData) return null;

  const alternate = cityData.stations.find((s) => s.line === station?.line && s.id !== station?.id && s.occupancy < 50);

  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-5 z-[90] w-full max-w-sm">
      <AnimatePresence>
        {station && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="pointer-events-auto overflow-hidden rounded-2xl border border-danger/20 bg-white shadow-2xl"
          >
            <div className="flex items-center gap-2 bg-gradient-to-r from-danger to-rose-500 px-4 py-2.5 text-white">
              <AlertTriangle className="h-4 w-4 animate-pulse" />
              <p className="text-sm font-semibold">High Crowd Alert</p>
              <button onClick={() => setStation(null)} className="ml-auto rounded p-0.5 hover:bg-white/20" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4">
              <p className="font-display text-base font-bold text-slate-900">{station.name}</p>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Current occupancy</p>
                  <p className="font-semibold text-danger">{station.occupancy}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Expected waiting</p>
                  <p className="font-semibold text-slate-700">{station.waitingTime} min</p>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-brand-50 p-2.5 text-xs text-brand-700">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  AI Recommendation:{' '}
                  {alternate ? (
                    <>Use <span className="font-semibold">{alternate.name}</span> instead</>
                  ) : (
                    'Travel after 30 minutes to avoid peak crowd'
                  )}
                  .
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
