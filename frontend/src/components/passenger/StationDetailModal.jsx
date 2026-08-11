import { Users, Clock, TrendingUp, Sparkles } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Badge from '@/components/common/Badge';
import { statusToTone } from '@/components/common/Badge';

export default function StationDetailModal({ station, isOpen, onClose }) {
  if (!station) return null;

  const suggestion =
    station.occupancy >= 70
      ? `Consider a nearby alternate station or travel after ${station.peakHours.split('–')[1]?.trim() || 'peak hours'}.`
      : 'Crowd levels are comfortable — good time to travel through this station.';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={station.name} subtitle={station.line} size="sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5" /> Current crowd
            </div>
            <p className="mt-1 font-display text-xl font-bold text-slate-900">{station.currentCrowd.toLocaleString('en-IN')}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" /> Waiting time
            </div>
            <p className="mt-1 font-display text-xl font-bold text-slate-900">{station.waitingTime} min</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5">
          <span className="text-sm text-slate-500">Occupancy status</span>
          <Badge tone={statusToTone(station.status)}>{station.statusLabel} · {station.occupancy}%</Badge>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5">
          <span className="flex items-center gap-1.5 text-sm text-slate-500">
            <TrendingUp className="h-4 w-4" /> Peak hours
          </span>
          <span className="text-sm font-medium text-slate-700">{station.peakHours}</span>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 p-4 text-white">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200">
            <Sparkles className="h-3.5 w-3.5" /> AI Suggestion
          </p>
          <p className="mt-1.5 text-sm">{suggestion}</p>
        </div>
      </div>
    </Modal>
  );
}
