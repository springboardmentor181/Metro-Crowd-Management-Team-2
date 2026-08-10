import { useMemo, useState } from 'react';
import { Eye, Wrench, MessageSquareWarning } from 'lucide-react';
import { toast } from 'react-toastify';
import Card, { CardHeader } from '@/components/common/Card';
import SearchBar from '@/components/common/SearchBar';
import Table from '@/components/common/Table';
import Badge, { statusToTone } from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Pagination from '@/components/common/Pagination';
import { useCityData } from '@/hooks/useCityData';
import { formatNumber } from '@/utils/formatters';

const PAGE_SIZE = 8;

export default function StationManagement() {
  const data = useCityData();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.stations.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  }, [data, query]);

  if (!data) return null;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Station Management</h1>
          <p className="text-sm text-slate-500">Monitor and manage every station on the network.</p>
        </div>
        <SearchBar
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search station…"
          className="sm:w-72"
        />
      </div>

      <Card>
        <CardHeader title="All Stations" subtitle={`${filtered.length} of ${data.stations.length} shown`} />
        <Table
          columns={[
            { key: 'name', header: 'Station' },
            { key: 'line', header: 'Line' },
            { key: 'occupancy', header: 'Occupancy', render: (r) => `${r.occupancy}%` },
            { key: 'currentCrowd', header: 'Passengers', render: (r) => formatNumber(r.currentCrowd) },
            { key: 'waitingTime', header: 'Waiting', render: (r) => `${r.waitingTime} min` },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={statusToTone(r.status)}>{r.statusLabel}</Badge> },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" icon={Eye} onClick={() => toast.info(`Opening detail view for ${r.name}`)}>
                    View
                  </Button>
                  <Button size="sm" variant="secondary" icon={Wrench} onClick={() => toast.info(`${r.name} flagged for maintenance review`)} />
                  <Button size="sm" variant="secondary" icon={MessageSquareWarning} onClick={() => toast.warning(`Alert broadcast for ${r.name}`)} />
                </div>
              ),
            },
          ]}
          data={paged}
        />
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </Card>
    </div>
  );
}
