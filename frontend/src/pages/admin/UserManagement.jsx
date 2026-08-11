import { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import Card, { CardHeader } from '@/components/common/Card';
import SearchBar from '@/components/common/SearchBar';
import Table from '@/components/common/Table';
import Badge, { statusToTone } from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Pagination from '@/components/common/Pagination';
import { useCityData } from '@/hooks/useCityData';
import { getInitials } from '@/utils/formatters';

const ROLE_FILTERS = ['All', 'Passenger', 'Operator', 'Administrator'];
const PAGE_SIZE = 6;

export default function UserManagement() {
  const data = useCityData();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.users.filter((u) => {
      const matchesQuery = u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase());
      const matchesRole = roleFilter === 'All' || u.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [data, query, roleFilter]);

  if (!data) return null;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500">Passengers, operators, and administrators on this network.</p>
        </div>
        <Button icon={UserPlus} onClick={() => toast.info('Invite flow would open here.')}>
          Invite user
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={query}
          onChange={(v) => { setQuery(v); setPage(1); }}
          placeholder="Search by name or email…"
          className="sm:w-80"
        />
        <div className="flex gap-2 overflow-x-auto">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => { setRoleFilter(r); setPage(1); }}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors focus-ring ${
                roleFilter === r ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader title="All Users" subtitle={`${filtered.length} of ${data.users.length} shown`} />
        <Table
          columns={[
            {
              key: 'name',
              header: 'User',
              render: (u) => (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 text-xs font-bold text-white">
                    {getInitials(u.name)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
              ),
            },
            { key: 'role', header: 'Role', render: (u) => <Badge tone="info">{u.role}</Badge> },
            { key: 'status', header: 'Status', render: (u) => <Badge tone={statusToTone(u.status)}>{u.status}</Badge> },
            {
              key: 'actions',
              header: 'Actions',
              render: (u) => (
                <Button size="sm" variant="secondary" onClick={() => toast.info(`Opening ${u.name}'s account…`)}>
                  Manage
                </Button>
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
