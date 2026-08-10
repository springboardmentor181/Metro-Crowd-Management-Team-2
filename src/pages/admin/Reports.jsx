import { useState } from 'react';
import { FileText, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-toastify';
import Card, { CardHeader } from '@/components/common/Card';
import Table from '@/components/common/Table';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import { useApp } from '@/hooks/useApp';
import { useCityData } from '@/hooks/useCityData';

const TABS = ['All', 'Daily', 'Weekly', 'Monthly'];

function buildReports(city, data) {
  const now = Date.now();
  return [
    { id: 'RPT-D-1', type: 'Daily', title: 'Daily Operations Report', period: 'Today', generatedAt: now, status: 'Ready' },
    { id: 'RPT-D-2', type: 'Daily', title: 'Daily Operations Report', period: 'Yesterday', generatedAt: now - 86400000, status: 'Ready' },
    { id: 'RPT-W-1', type: 'Weekly', title: 'Weekly Ridership Summary', period: 'This week', generatedAt: now, status: 'Ready' },
    { id: 'RPT-W-2', type: 'Weekly', title: 'Weekly Ridership Summary', period: 'Last week', generatedAt: now - 7 * 86400000, status: 'Ready' },
    { id: 'RPT-M-1', type: 'Monthly', title: `${city.name} Network Report`, period: 'This month', generatedAt: now, status: 'Ready' },
    { id: 'RPT-M-2', type: 'Monthly', title: `${city.name} Network Report`, period: 'Last month', generatedAt: now - 30 * 86400000, status: 'Ready' },
  ];
}

export default function Reports() {
  const { city } = useApp();
  const data = useCityData();
  const [tab, setTab] = useState('All');
  if (!data) return null;

  const reports = buildReports(city, data);
  const filtered = tab === 'All' ? reports : reports.filter((r) => r.type === tab);
  const handleExport = (format, report) => toast.info(`Preparing ${format} export for "${report.title}"…`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Generated operations reports for {city.name}.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-ring ${
              tab === t ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title={`${tab} Reports`} subtitle={`${filtered.length} report${filtered.length === 1 ? '' : 's'}`} />
        <Table
          columns={[
            {
              key: 'title',
              header: 'Report',
              render: (r) => (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{r.title}</p>
                    <p className="text-xs text-slate-400">{r.period}</p>
                  </div>
                </div>
              ),
            },
            { key: 'type', header: 'Type', render: (r) => <Badge tone="info">{r.type}</Badge> },
            { key: 'status', header: 'Status', render: () => <Badge tone="success">Ready</Badge> },
            {
              key: 'actions',
              header: 'Export',
              render: (r) => (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" icon={Download} onClick={() => handleExport('PDF', r)}>PDF</Button>
                  <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => handleExport('Excel', r)}>Excel</Button>
                </div>
              ),
            },
          ]}
          data={filtered}
        />
      </Card>
    </div>
  );
}
