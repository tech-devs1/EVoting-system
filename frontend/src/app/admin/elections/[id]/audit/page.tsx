'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
  ShieldCheck
} from 'lucide-react';

interface AuditRecord {
  id: string;
  type: 'admin' | 'voter';
  actor: string;
  action: string;
  timestamp: number;
  details?: string;
  selections?: Record<string, string>;
  hash?: string;
}

export default function ElectionSystemAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const electionId = resolvedParams.id;

  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'admin' | 'voter'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  async function fetchAuditData() {
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

  // Export CSV Action
  const handleExportCSV = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/elections/${electionId}/export-audit`, {
        headers
      });
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

  const filteredRecords = records.filter(r => {
    const matchesTab = activeTab === 'all' || r.type === activeTab;
    const matchesSearch = r.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.details && r.details.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Header */}
      <div>
        <Link href={`/admin/elections/${electionId}/dashboard`} className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
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
        <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
          {/* Tab Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              All Activities ({records.length})
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'admin' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Admin Activities
            </button>
            <button
              onClick={() => setActiveTab('voter')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'voter' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Voter Ballots & Timestamps
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading system audit log...</p>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">
            No matching activities recorded for this election yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700/60">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Activity / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredRecords.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{r.actor}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        r.type === 'admin'
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
                      }`}>
                        {r.type === 'admin' ? <Activity size={12} /> : <User size={12} />}
                        {r.type === 'admin' ? 'Admin Activity' : 'Voter Cast'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                      {r.details || (r.selections ? `Casted vote on ballot: ${JSON.stringify(r.selections)}` : 'Ballot Cast')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
