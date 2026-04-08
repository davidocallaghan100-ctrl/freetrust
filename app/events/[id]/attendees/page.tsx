'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  TicketIcon,
  EllipsisVerticalIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

type TicketType = 'free' | 'paid' | 'vip';
type AttendeeStatus = 'confirmed' | 'pending' | 'cancelled' | 'checked-in';

interface Attendee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  ticketType: TicketType;
  ticketCode: string;
  status: AttendeeStatus;
  registeredAt: string;
  checkedInAt?: string;
  amountPaid?: number;
  trustScore: number;
  notes?: string;
}

const MOCK_EVENT = {
  id: '1',
  title: 'FreeTrust Community Summit 2025',
  date: '2025-03-15T10:00:00',
  location: 'London ExCeL Centre',
  totalCapacity: 500,
};

const MOCK_ATTENDEES: Attendee[] = [
  { id: 'a1', name: 'Alice Thornton', email: 'alice@example.com', phone: '+44 7700 900001', ticketType: 'vip', ticketCode: 'FT-VIP-001', status: 'checked-in', registeredAt: '2025-02-01T09:15:00', checkedInAt: '2025-03-15T09:45:00', amountPaid: 149, trustScore: 87, notes: 'Speaker guest' },
  { id: 'a2', name: 'Bob Marshfield', email: 'bob@example.com', ticketType: 'paid', ticketCode: 'FT-PAI-002', status: 'confirmed', registeredAt: '2025-02-03T14:22:00', amountPaid: 49, trustScore: 72 },
  { id: 'a3', name: 'Carla Nguyen', email: 'carla@example.com', phone: '+44 7700 900003', ticketType: 'free', ticketCode: 'FT-FRE-003', status: 'confirmed', registeredAt: '2025-02-05T11:00:00', trustScore: 65 },
  { id: 'a4', name: 'David Osei', email: 'david@example.com', ticketType: 'paid', ticketCode: 'FT-PAI-004', status: 'pending', registeredAt: '2025-02-07T16:30:00', amountPaid: 49, trustScore: 55 },
  { id: 'a5', name: 'Eva Kowalski', email: 'eva@example.com', phone: '+44 7700 900005', ticketType: 'vip', ticketCode: 'FT-VIP-005', status: 'confirmed', registeredAt: '2025-02-08T10:10:00', amountPaid: 149, trustScore: 91 },
  { id: 'a6', name: 'Frank Belmont', email: 'frank@example.com', ticketType: 'free', ticketCode: 'FT-FRE-006', status: 'cancelled', registeredAt: '2025-02-09T13:45:00', trustScore: 40 },
  { id: 'a7', name: 'Grace Liu', email: 'grace@example.com', ticketType: 'paid', ticketCode: 'FT-PAI-007', status: 'checked-in', registeredAt: '2025-02-10T08:00:00', checkedInAt: '2025-03-15T10:05:00', amountPaid: 49, trustScore: 78 },
  { id: 'a8', name: 'Henry Walsh', email: 'henry@example.com', phone: '+44 7700 900008', ticketType: 'free', ticketCode: 'FT-FRE-008', status: 'confirmed', registeredAt: '2025-02-11T15:20:00', trustScore: 62 },
  { id: 'a9', name: 'Iris Fontaine', email: 'iris@example.com', ticketType: 'vip', ticketCode: 'FT-VIP-009', status: 'checked-in', registeredAt: '2025-02-12T09:30:00', checkedInAt: '2025-03-15T09:58:00', amountPaid: 149, trustScore: 95 },
  { id: 'a10', name: 'James Okeke', email: 'james@example.com', ticketType: 'paid', ticketCode: 'FT-PAI-010', status: 'pending', registeredAt: '2025-02-13T12:00:00', amountPaid: 49, trustScore: 58 },
  { id: 'a11', name: 'Kate Morrison', email: 'kate@example.com', phone: '+44 7700 900011', ticketType: 'free', ticketCode: 'FT-FRE-011', status: 'confirmed', registeredAt: '2025-02-14T10:45:00', trustScore: 70 },
  { id: 'a12', name: 'Liam Chen', email: 'liam@example.com', ticketType: 'paid', ticketCode: 'FT-PAI-012', status: 'confirmed', registeredAt: '2025-02-15T14:00:00', amountPaid: 49, trustScore: 83 },
];

const statusConfig: Record<AttendeeStatus, { label: string; color: string; icon: React.ElementType }> = {
  'confirmed': { label: 'Confirmed', color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
  'pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon },
  'cancelled': { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircleIcon },
  'checked-in': { label: 'Checked In', color: 'bg-blue-100 text-blue-700', icon: CheckCircleSolid },
};

const ticketConfig: Record<TicketType, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-gray-100 text-gray-600' },
  paid: { label: 'Standard', color: 'bg-purple-100 text-purple-700' },
  vip: { label: 'VIP', color: 'bg-amber-100 text-amber-700' },
};

function TrustBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500';
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${color}`}>
      <ShieldCheckIcon className="w-3.5 h-3.5" />
      {score}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function AttendeesPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [attendees, setAttendees] = useState<Attendee[]>(MOCK_ATTENDEES);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendeeStatus | 'all'>('all');
  const [ticketFilter, setTicketFilter] = useState<TicketType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'registered' | 'trust'>('registered');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let list = [...attendees];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.ticketCode.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (ticketFilter !== 'all') list = list.filter(a => a.ticketType === ticketFilter);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'registered') cmp = new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime();
      else cmp = a.trustScore - b.trustScore;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [attendees, search, statusFilter, ticketFilter, sortBy, sortDir]);

  const stats = useMemo(() => {
    const confirmed = attendees.filter(a => a.status === 'confirmed' || a.status === 'checked-in').length;
    const checkedIn = attendees.filter(a => a.status === 'checked-in').length;
    const revenue = attendees.filter(a => a.status !== 'cancelled').reduce((s, a) => s + (a.amountPaid ?? 0), 0);
    const pending = attendees.filter(a => a.status === 'pending').length;
    return { confirmed, checkedIn, revenue, pending, total: attendees.length };
  }, [attendees]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(a => a.id)));
    }
  };

  const updateStatus = (id: string, status: AttendeeStatus) => {
    setAttendees(prev =>
      prev.map(a => a.id === id ? {
        ...a,
        status,
        checkedInAt: status === 'checked-in' ? new Date().toISOString() : a.checkedInAt,
      } : a)
    );
    setOpenMenuId(null);
  };

  const bulkAction = (action: 'confirm' | 'cancel') => {
    const status: AttendeeStatus = action === 'confirm' ? 'confirmed' : 'cancelled';
    setAttendees(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, status } : a));
    setSelectedIds(new Set());
  };

  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Phone', 'Ticket Type', 'Ticket Code', 'Status', 'Registered', 'Amount Paid', 'Trust Score'],
      ...filtered.map(a => [
        a.name, a.email, a.phone ?? '', ticketConfig[a.ticketType].label,
        a.ticketCode, statusConfig[a.status].label,
        format(parseISO(a.registeredAt), 'dd/MM/yyyy HH:mm'),
        a.amountPaid ? `£${a.amountPaid}` : 'Free',
        a.trustScore,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendees-event-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(`/events/${eventId}`)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">Attendees</h1>
              <p className="text-xs text-gray-500 truncate">{MOCK_EVENT.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <Link
              href={`/events/${eventId}/attendees/invite`}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <UsersIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Invite</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={UsersIcon} label="Total Registered" value={stats.total} sub={`of ${MOCK_EVENT.totalCapacity} capacity`} color="bg-indigo-50 text-indigo-600" />
          <StatCard icon={CheckCircleIcon} label="Confirmed" value={stats.confirmed} sub={`${stats.pending} pending`} color="bg-green-50 text-green-600" />
          <StatCard icon={CheckCircleSolid} label="Checked In" value={stats.checkedIn} sub={`${Math.round((stats.checkedIn / stats.total) * 100)}% attendance`} color="bg-blue-50 text-blue-600" />
          <StatCard icon={CurrencyDollarIcon} label="Revenue" value={`£${stats.revenue}`} sub="from paid tickets" color="bg-amber-50 text-amber-600" />
        </div>

        {/* Capacity bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Capacity</span>
            <span className="text-gray-500">{stats.total} / {MOCK_EVENT.totalCapacity}</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${Math.min((stats.total / MOCK_EVENT.totalCapacity) * 100, 100)}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{stats.checkedIn} checked in</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{stats.confirmed - stats.checkedIn} confirmed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{stats.pending} pending</span>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, email or ticket code…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border rounded-lg transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              <FunnelIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {(statusFilter !== 'all' || ticketFilter !== 'all') && (
                <span className="w-2 h-2 bg-indigo-500 rounded-full" />
              )}
            </button>
          </div>

          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="checked-in">Checked In</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ticket Type</label>
                <select
                  value={ticketFilter}
                  onChange={e => setTicketFilter(e.target.value as typeof ticketFilter)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Tickets</option>
                  <option value="free">Free</option>
                  <option value="paid">Standard</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="registered">Date Registered</option>
                  <option value="name">Name</option>
                  <option value="trust">Trust Score</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Order</label>
                <select
                  value={sortDir}
                  onChange={e => setSortDir(e.target.value as typeof sortDir)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
              <button
                onClick={() => { setStatusFilter('all'); setTicketFilter('all'); setSortBy('registered'); setSortDir('desc'); }}
                className="col-span-2 sm:col-span-4 text-xs text-indigo-600 hover:underline text-left"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-700">{selectedIds.size} selected</span>
            <div className="flex gap-2">
              <button
                onClick={() => bulkAction('confirm')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
              >
                <CheckIcon className="w-3.5 h-3.5" /> Confirm All
              </button>
              <button
                onClick={() => bulkAction('cancel')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
              >
                <XMarkIcon className="w-3.5 h-3.5" /> Cancel All
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 px-2"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{filtered.length} attendee{filtered.length !== 1 ? 's' : ''}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={toggleAll}
              className="rounded border-gray-300 text-indigo-600"
            />
            <span>Select all</span>
          </div>
        </div>

        {/* Attendee list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <UsersIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No attendees found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
          )}

          {filtered.map(attendee => {
            const sc = statusConfig[attendee.status];
            const tc = ticketConfig[attendee.ticketType];
            const isSelected = selectedIds.has(attendee.id);
            const isExpanded = expandedId === attendee.id;
            const StatusIcon = sc.icon;

            return (
              <div
                key={attendee.id}
                className={`bg-white rounded-xl border transition-all ${isSelected ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'}`}
              >
                <div className="p-4 flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(attendee.id)}
                    className="mt-1 rounded border-gray-300 text-indigo-600 shrink-0"
                  />

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {attendee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{attendee.name}</span>
                          <TrustBadge score={attendee.trustScore} />
                        </div>
                        <p className="text-xs text-gray-500 truncate">{attendee.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                        <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tc.color}`}>
                          {tc.label}
                        </span>

                        {/* Menu */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === attendee.id ? null : attendee.id)}
                            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
                          </button>
                          {openMenuId === attendee.id && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 min-w-44">
                              {attendee.status !== 'checked-in' && (
                                <button
                                  onClick={() => updateStatus(attendee.id, 'checked-in')}
                                  className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                                >
                                  <CheckCircleSolid className="w-4 h-4" /> Check In
                                </button>
                              )}
                              {attendee.status !== 'confirmed' && (
                                <button
                                  onClick={() => updateStatus(attendee.id, 'confirmed')}
                                  className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                                >
                                  <CheckCircleIcon className="w-4 h-4" /> Confirm
                                </button>
                              )}
                              {attendee.status !== 'pending' && (
                                <button
                                  onClick={() => updateStatus(attendee.id, 'pending')}
                                  className="w-full text-left px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50 flex items-center gap-2"
                                >
                                  <ClockIcon className="w-4 h-4" /> Mark Pending
                                </button>
                              )}
                              {attendee.status !== 'cancelled' && (
                                <button
                                  onClick={() => updateStatus(attendee.id, 'cancelled')}
                                  className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <XCircleIcon className="w-4 h-4" /> Cancel
                                </button>
                              )}
                              <hr className="my-1 border-gray-100" />
                              <button
                                onClick={() => { setExpandedId(isExpanded ? null : attendee.id); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                View Details
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile badges */}
                    <div className="flex items-center gap-2 mt-1 sm:hidden flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {sc.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tc.color}`}>
                        {tc.label}
                      </span>
                    </div>

                    {/* Bottom row */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <TicketIcon className="w-3 h-3" />
                          {attendee.ticketCode}
                        </span>
                        <span>Registered {format(parseISO(attendee.registeredAt), 'd MMM yyyy')}</span>
                        {attendee.amountPaid && (
                          <span className="font-medium text-gray-600">£{attendee.amountPaid}</span>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : attendee.id)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                      >
                        {isExpanded ? 'Less' : 'More'}
                        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 rounded-b-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Contact</p>
                        <div className="space-y-1">
                          <a href={`mailto:${attendee.email}`} className="flex items-center gap-2 text-gray-700 hover:text-indigo-600">
                            <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                            {attendee.email}
                          </a>
                          {attendee.phone && (
                            <a href={`tel:${attendee.phone}`} className="flex items-center gap-2 text-gray-700 hover:text-indigo-600">
                              <PhoneIcon className="w-4 h-4 text-gray-400" />
                              {attendee.phone}
                            </a>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Registration</p>
                        <div className="space-y-1 text-gray-700">
                          <p>Registered: {format(parseISO(attendee.registeredAt), 'd MMM yyyy, HH:mm')}</p>
                          {attendee.checkedInAt && (
                            <p className="text-blue-600">Checked in: {format(parseISO(attendee.checkedInAt), 'd MMM yyyy, HH:mm')}</p>
                          )}
                          <p>Ticket: <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tc.color}`}>{tc.label}</span></p>
                          {attendee.amountPaid && <p>Paid: £{attendee.amountPaid}</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Trust & Notes</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <ShieldCheckIcon className="w-4 h-4 text-indigo-500" />
                            <span className="text-gray-700">Trust Score: <strong>{attendee.trustScore}</strong></span>
                          </div>
                          {attendee.notes && (
                            <p className="text-gray-600 text-xs bg-white rounded-lg px-2 py-1 border border-gray-200">{attendee.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                      {attendee.status !== 'checked-in' && (
                        <button
                          onClick={() => updateStatus(attendee.id, 'checked-in')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          <CheckCircleSolid className="w-3.5 h-3.5" /> Check In
                        </button>
                      )}
                      {attendee.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(attendee.id, 'confirmed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          <CheckIcon className="w-3.5 h-3.5" /> Confirm
                        </button>
                      )}
                      {attendee.status !== 'cancelled' && (
                        <button
                          onClick={() => updateStatus(attendee.id, 'cancelled')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                      <a
                        href={`mailto:${attendee.email}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <EnvelopeIcon className="w-3.5 h-3.5" /> Email
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center pb-6">
          <p className="text-xs text-gray-400">
            Showing {filtered.length} of {attendees.length} attendees
          </p>
        </div>
      </div>

      {/* Click outside to close menu */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  );
}

