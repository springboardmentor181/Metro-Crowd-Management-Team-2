import { Building2, Route as RouteIcon, Users, TrendingUp, Clock, TrainFront, BrainCircuit } from 'lucide-react';
import Card, { CardHeader } from '@/components/common/Card';
import CountUp from '@/components/common/CountUp';
import Badge, { statusToTone } from '@/components/common/Badge';
import Table from '@/components/common/Table';
import { FlowAreaChart, RidershipBarChart } from '@/components/charts/ChartKit';
import { useCityData } from '@/hooks/useCityData';
import { useApp } from '@/hooks/useApp';
import { formatNumber } from '@/utils/formatters';

export default function AdminDashboard() {
  const { city } = useApp();
  const data = useCityData();
  if (!data) return null;

  const { stations, trains, hourlyFlow, weekly, riskStations, aiPrediction } = data;
  const runningTrains = trains.filter((t) => t.status === 'Running').length;
  const peakCrowd = Math.max(...stations.map((s) => s.occupancy));
  const avgWaiting = Math.round(stations.reduce((s, st) => s + st.waitingTime, 0) / stations.length);
  const passengersToday = hourlyFlow.reduce((s, h) => s + h.entries, 0);

  const stats = [
    { label: 'Total Stations', value: city.stations, icon: Building2, tone: 'from-brand-500 to-brand-700' },
    { label: 'Operational Lines', value: city.linesCount, icon: RouteIcon, tone: 'from-violet-500 to-violet-700' },
    { label: 'Passengers Today', value: passengersToday, icon: Users, tone: 'from-signal-500 to-signal-700', format: formatNumber },
    { label: 'Peak Crowd', value: peakCrowd, suffix: '%', icon: TrendingUp, tone: 'from-danger to-rose-700' },
    { label: 'Avg. Waiting', value: avgWaiting, suffix: ' min', icon: Clock, tone: 'from-amber-500 to-orange-600' },
    { label: 'Running Trains', value: runningTrains, suffix: ` / ${trains.length}`, icon: TrainFront, tone: 'from-emerald-500 to-emerald-700' },
    { label: 'AI Prediction Accuracy', value: aiPrediction.confidence, suffix: '%', icon: BrainCircuit, tone: 'from-slate-700 to-brand-800' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Operations Control Center</h1>
        <p className="text-sm text-slate-500">Live overview of the {city.name} network.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Card key={s.label} hover delay={i * 0.04}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">{s.label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-slate-900">
                  <CountUp value={s.value} formatter={(v) => `${s.format ? s.format(Math.round(v)) : Math.round(v)}${s.suffix || ''}`} />
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.tone} text-white`}>
                <s.icon className="h-4.5 w-4.5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Passenger Flow" subtitle="Entries vs. exits, today" />
          <FlowAreaChart
            data={hourlyFlow}
            xKey="hour"
            series={[
              { key: 'entries', label: 'Entries', color: '#2f5df0' },
              { key: 'exits', label: 'Exits', color: '#f98407' },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Weekly Ridership" />
          <RidershipBarChart data={weekly} xKey="day" yKey="riders" color="#7c5cff" height={280} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Station Monitoring" subtitle="Top stations by risk level" />
        <Table
          columns={[
            { key: 'name', header: 'Station' },
            { key: 'currentCrowd', header: 'Passengers', render: (r) => formatNumber(r.currentCrowd) },
            { key: 'occupancy', header: 'Crowd', render: (r) => `${r.occupancy}%` },
            { key: 'waitingTime', header: 'Waiting', render: (r) => `${r.waitingTime} min` },
            { key: 'risk', header: 'Risk', render: (r) => <Badge tone={statusToTone(r.risk)}>{r.risk}</Badge> },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={statusToTone(r.status)}>{r.statusLabel}</Badge> },
          ]}
          data={riskStations}
        />
      </Card>
    </div>
  );
}
