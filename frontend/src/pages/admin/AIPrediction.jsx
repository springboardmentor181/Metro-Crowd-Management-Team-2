import { Sparkles, TrendingUp, Gauge, Target } from 'lucide-react';
import Card, { CardHeader } from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import { ForecastLineChart } from '@/components/charts/ChartKit';
import ProgressBar from '@/components/charts/ProgressBar';
import { useCityData } from '@/hooks/useCityData';

export default function AIPrediction() {
  const data = useCityData();
  if (!data) return null;

  const { aiPrediction, riskStations } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">AI Crowd Prediction</h1>
          <p className="text-sm text-slate-500">Model-driven forecasts for the network over the next few hours.</p>
        </div>
        <Badge tone="info" dot>Model confidence {aiPrediction.confidence}%</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-danger to-rose-700 text-white">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Predicted peak station</p>
              <p className="font-display text-base font-bold text-slate-900">{aiPrediction.peakStation}</p>
            </div>
          </div>
        </Card>
        <Card delay={0.05}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Suggested frequency</p>
              <p className="font-display text-base font-bold text-slate-900">Every {aiPrediction.suggestedFrequency}</p>
            </div>
          </div>
        </Card>
        <Card delay={0.1}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Congestion trend</p>
              <p className="font-display text-base font-bold capitalize text-slate-900">{aiPrediction.congestionTrend}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Future Crowd Forecast"
          subtitle="Predicted entries per hour"
          action={
            <span className="flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-600">
              <Sparkles className="h-3 w-3" /> Model v3.1
            </span>
          }
        />
        <ForecastLineChart data={aiPrediction.futureCrowd} xKey="hour" height={320} />
      </Card>

      <Card>
        <CardHeader title="Congestion Prediction by Station" subtitle="Next-hour projected occupancy" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {riskStations.map((s) => (
            <ProgressBar
              key={s.id}
              label={s.name}
              value={Math.min(100, Math.round(s.occupancy * 1.05))}
              tone={s.occupancy >= 80 ? 'danger' : s.occupancy >= 55 ? 'warning' : 'success'}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
