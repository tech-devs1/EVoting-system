'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { 
  ArrowLeft, 
  Download, 
  Clock, 
  FileText, 
  UserCheck, 
  Search,
  Activity,
  User,
  ShieldCheck,
  Eye,
  X,
  Globe,
  Terminal,
  ShieldAlert
} from 'lucide-react';
import DataTable, { type ColumnDef, type FilterDef } from '@/components/DataTable';

interface AuditRecord {
  id: string;
  type: 'admin' | 'voter';
  actor: string;
  role?: string;
  action: string;
  ip?: string;
  tenantId?: string;
  timestamp: number;
  details?: string;
  selections?: Record<string, string>;
  hash?: string;
  fullRecord?: any;
}

function ElectionSystemAuditContent() {
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);

  async function fetchAuditData() {
    if (!electionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await apiRequest<{ status: string; data: AuditRecord[] }>(`/elections/${electionId}/audit-records`);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error('Error loading audit records:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (electionId) fetchAuditData();
  }, [electionId]);

  const handleExportCSV = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/elections/${electionId}/export-audit`, { headers });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `election_system_audit_${electionId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Failed to export audit log:', err);
    }
  };

  const typeFilters: FilterDef[] = [{
    key: 'type',
    label: 'All Types',
    options: [
      { value: 'admin', label: 'Admin Activities' },
      { value: 'voter', label: 'Voter Ballots' },
    ],
  }];

  const columns: ColumnDef<AuditRecord>[] = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (r) => (
        <span className="font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {new Date(r.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (r) => <span className="font-bold text-slate-900 dark:text-white">{r.actor}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      filterable: true,
      render: (r) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
          r.type === 'admin'
            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30'
            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
        }`}>
          {r.type === 'admin' ? <Activity size={12} /> : <User size={12} />}
          {r.type === 'admin' ? 'Admin' : 'Voter'}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Activity / Details',
      render: (r) => (
        <span className="text-slate-700 dark:text-slate-300 font-medium">
          {r.details || (r.selections ? `Casted vote: ${JSON.stringify(r.selections)}` : 'Ballot Cast')}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Details',
      render: (r) => (
        <button
          onClick={() => setSelectedRecord(r)}
          className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1"
        >
          <Eye size={12} /> View
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Header */}
      <div>
        <Link href={`/admin/elections/dashboard?electionId=${electionId}`} className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Election Command Center
        </Link>
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Election System Audit
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Official system logs detailing admin activities, voter actions, and precise vote cast timestamps.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md shadow-blue-500/20 flex items-center gap-1.5"
          >
            <Download size={16} /> Export Audit Log (CSV)
          </button>
        </div>
      </div>

      {/* Audit Log Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
        {loading ? (
          <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading system audit log...</p>
        ) : (
          <DataTable
            data={records}
            columns={columns}
            searchPlaceholder="Search by actor, action, or details…"
            searchKeys={['actor', 'action', 'details']}
            dateField="timestamp"
            filters={typeFilters}
            emptyMessage="No matching activities recorded for this election yet."
            pageSize={15}
          />
        )}
      </div>

      {/* Log Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Terminal size={18} className="text-blue-600" /> Audit Log Event Details
              </h3>
              <button onClick={() => setSelectedRecord(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Log Record ID</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedRecord.id}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
                  <span className="block font-bold text-slate-400 uppercase text-[10px] mb-1">Actor Email / ID</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">{selectedRecord.actor}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
                  <span className="block font-bold text-slate-400 uppercase text-[10px] mb-1">Actor Role</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 uppercase">{selectedRecord.role || selectedRecord.type}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
                  <span className="block font-bold text-slate-400 uppercase text-[10px] mb-1">Action Code</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{selectedRecord.action}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
                  <span className="block font-bold text-slate-400 uppercase text-[10px] mb-1">IP Address</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedRecord.ip || '127.0.0.1'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
                <span className="block font-bold text-slate-400 uppercase text-[10px] mb-1">Event Timestamp</span>
                <span className="font-bold text-slate-900 dark:text-white">{new Date(selectedRecord.timestamp).toString()}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-40 border border-slate-800">
                <span className="block font-bold text-blue-400 text-[10px] uppercase mb-1">Event Payload / Description</span>
                {selectedRecord.details || JSON.stringify(selectedRecord.fullRecord, null, 2)}
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => setSelectedRecord(null)}
                className="w-full py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-md shadow-blue-500/20"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ElectionSystemAuditPage() {
  return (
    <Suspense fallback={<p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading system audit log...</p>}>
      <ElectionSystemAuditContent />
    </Suspense>
  );
}
