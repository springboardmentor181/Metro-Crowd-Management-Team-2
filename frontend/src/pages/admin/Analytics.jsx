import Card, { CardHeader } from '@/components/common/Card';
import { FlowAreaChart, RidershipBarChart, TrendLineChart, DonutChart } from '@/components/charts/ChartKit';
import { useCityData } from '@/hooks/useCityData';

export default function Analytics() {
  const data = useCityData();
  if (!data) return null;

  const { hourlyFlow, weekly, monthly, stations, city } = data;

  const peakHour = hourlyFlow.reduce((max, h) => (h.entries > max.entries ? h : max));
  const lineDistribution = city.lines.map((line) => ({
    name: line.name,
    value: stations.filter((s) => s.line === line.name).reduce((sum, s) => sum + s.currentCrowd, 0),
    color: line.color,
  }));

  const stationComparison = [...stations]
    .sort((a, b) => b.occupancy - a.occupancy)
    .slice(0, 8)
    .map((s) => ({ station: s.name, occupancy: s.occupancy }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">Passenger flow, peak hours, and station comparisons.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Peak hour</p>
          <p className="font-display text-2xl font-bold text-slate-900">{peakHour.hour}</p>
        </Card>
        <Card delay={0.05}>
          <p className="text-sm text-slate-500">Busiest day</p>
          <p className="font-display text-2xl font-bold text-slate-900">
            {weekly.reduce((a, b) => (b.riders > a.riders ? b : a)).day}
          </p>
        </Card>
        <Card delay={0.1}>
          <p className="text-sm text-slate-500">Weekly average</p>
          <p className="font-display text-2xl font-bold text-slate-900">
            {Math.round(weekly.reduce((s, d) => s + d.riders, 0) / weekly.length).toLocaleString('en-IN')}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Passenger Flow" subtitle="Hourly entries vs. exits" />
          <FlowAreaChart data={hourlyFlow} xKey="hour" series={[
            { key: 'entries', label: 'Entries', color: '#2f5df0' },
            { key: 'exits', label: 'Exits', color: '#f98407' },
          ]} />
        </Card>
        <Card>
          <CardHeader title="Ridership by Line" subtitle="Share of today's crowd" />
          <DonutChart data={lineDistribution} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Station Comparison" subtitle="Top 8 by occupancy" />
          <RidershipBarChart data={stationComparison} xKey="station" yKey="occupancy" color="#7c5cff" />
        </Card>
        <Card>
          <CardHeader title="Monthly Ridership" subtitle="Riders in millions" />
          <TrendLineChart data={monthly} xKey="month" series={[{ key: 'riders', label: 'Riders (M)', color: '#f98407' }]} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Weekly Ridership" subtitle="Total riders per day" />
        <RidershipBarChart data={weekly} xKey="day" yKey="riders" />
      </Card>
    </div>
  );
}
