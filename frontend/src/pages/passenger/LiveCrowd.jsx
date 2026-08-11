import { useMemo, useState } from 'react';
import { Users, Clock } from 'lucide-react';
import Card, { CardHeader } from '@/components/common/Card';
import SearchBar from '@/components/common/SearchBar';
import Badge, { statusToTone } from '@/components/common/Badge';
import StationDetailModal from '@/components/passenger/StationDetailModal';
import { useCityData } from '@/hooks/useCityData';

export default function LiveCrowd() {
  const data = useCityData();
  const [query, setQuery] = useState('');
  const [activeStation, setActiveStation] = useState(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.stations.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  }, [data, query]);

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Live Crowd Status</h1>
          <p className="text-sm text-slate-500">Real-time occupancy across every station.</p>
        </div>
        <SearchBar value={query} onChange={setQuery} placeholder="Search station…" className="sm:w-72" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((station) => (
          <button key={station.id} onClick={() => setActiveStation(station)} className="text-left">
            <Card hover animate={false} className="h-full">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-base font-bold text-slate-900">{station.name}</p>
                  <p className="text-xs text-slate-400">{station.line}</p>
                </div>
                <Badge tone={statusToTone(station.status)}>{station.statusLabel}</Badge>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Occupancy</span>
                  <span>{station.occupancy}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${station.occupancy}%`, background: station.statusColor }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {station.currentCrowd.toLocaleString('en-IN')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {station.waitingTime} min wait
                </span>
              </div>
            </Card>
          </button>
        ))}
      </div>

      <StationDetailModal station={activeStation} isOpen={Boolean(activeStation)} onClose={() => setActiveStation(null)} />
    </div>
  );
}
