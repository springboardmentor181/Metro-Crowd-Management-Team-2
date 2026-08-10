import { useMemo, useState } from 'react';
import { MapPin, Check } from 'lucide-react';
import Modal from '@/components/common/Modal';
import SearchBar from '@/components/common/SearchBar';
import Badge, { statusToTone } from '@/components/common/Badge';
import { generateCityData } from '@/data/cityDataGenerator';
import { useApp } from '@/hooks/useApp';

/**
 * Lets an already-verified administrator switch which station within their
 * assigned city they're managing. Administrators cannot change city from
 * here — that requires signing out and re-verifying via the Continue As
 * Administrator flow, so this only ever lists stations for the current city.
 */
export default function StationPickerModal({ isOpen, onClose }) {
  const { city, cityId, station, setStation } = useApp();
  const [query, setQuery] = useState('');

  const stations = useMemo(() => (cityId ? generateCityData(cityId)?.stations || [] : []), [cityId]);
  const filtered = useMemo(
    () => stations.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.line.toLowerCase().includes(query.toLowerCase())),
    [stations, query]
  );

  const handleSelect = (s) => {
    setStation({ id: s.id, name: s.name, line: s.line });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Switch Metro Station"
      subtitle={city ? `Choose a station within ${city.name}` : undefined}
    >
      <div className="mb-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search stations…" />
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {filtered.map((s) => {
          const isSelected = station?.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handleSelect(s)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-ring ${
                isSelected ? 'border-brand-400 bg-brand-50' : 'border-slate-100 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-brand-700 text-white">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{s.name}</span>
                <span className="block truncate text-xs" style={{ color: s.lineColor }}>{s.line}</span>
              </span>
              <Badge tone={statusToTone(s.status)}>{s.statusLabel}</Badge>
              {isSelected && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}

        {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No station matches &quot;{query}&quot;.</p>}
      </div>
    </Modal>
  );
}
