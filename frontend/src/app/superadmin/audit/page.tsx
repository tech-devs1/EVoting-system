'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { Activity, Download, RefreshCw, Building2, Globe, Shield, ChevronDown } from 'lucide-react';
import DataTable, { type ColumnDef, type FilterDef } from '@/components/DataTable';

interface AuditEntry {
  id: string;
  tenantId: string;
  tenantName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  description: string;
  status: string;
  ip: string;
  timestamp: number;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  VOTER_LOGIN:               { label: 'Voter Login',        color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  ADMIN_LOGIN:               { label: 'Admin Login',        color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  CSV_UPLOAD:                { label: 'CSV Upload',         color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  VOTE_CAST:                 { label: 'Vote Cast',          color: '#0891B2', bg: 'rgba(8,145,178,0.1)' },
  DEPT_CREATED:              { label: 'Dept Created',       color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
  PASSWORD_CHANGE:           { label: 'Admin Pwd Change',   color: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
  PASSWORD_CHANGED:          { label: 'Voter Pwd Change',   color: '#E11D48', bg: 'rgba(225,29,72,0.1)' },
  PASSWORD_RESET:            { label: 'Password Reset',     color: '#EA580C', bg: 'rgba(234,88,12,0.1)' },
  PASSWORD_RESET_REQUESTED:  { label: 'Reset Requested',   color: '#CA8A04', bg: 'rgba(202,138,4,0.1)' },
  DEFAULT:                   { label: 'Action',             color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] || ACTION_CONFIG.DEFAULT;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      borderRadius: '12px', fontSize: '11px', fontWeight: 600,
      color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap'
    }}>
      {cfg.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = { admin: '#2563EB', voter: '#10B981', superadmin: '#EF4444' };
  const color = map[role] || '#6B7280';
  return (
    <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color, background: color + '18', textTransform: 'uppercase' }}>
      {role}
    </span>
  );
}

export default function SuperAdminAudit() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch department list
  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await apiRequest<{ status: string; data: Department[] }>('/superadmin/departments');
        if (res.status === 'success') setDepartments(res.data);
      } catch {}
    }
    loadDepts();
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const query = selectedTab === 'all' ? '' : `?tenantId=${selectedTab}`;
      const res = await apiRequest<{ status: string; data: AuditEntry[] }>(`/superadmin/audit${query}`);
      if (res.status === 'success') setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTab]);

  // Fetch on tab change + poll every 15s
  useEffect(() => {
    fetchLogs();
    intervalRef.current = setInterval(fetchLogs, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLogs]);

  const downloadPDF = async (tenantId?: string) => {
    setDownloading(true);
    try {
      const headers = await getAuthHeaders();
      const url = tenantId ? `/api/superadmin/audit/pdf/${tenantId}` : `/api/superadmin/audit/pdf`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error('Failed to generate PDF');
      const blob = await resp.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const deptName = tenantId ? (departments.find(d => d.id === tenantId)?.name || tenantId) : 'Global';
      link.download = `${deptName}_Audit_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('PDF download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const currentDeptName = selectedTab === 'all'
    ? 'All Departments'
    : (departments.find(d => d.id === selectedTab)?.name || selectedTab);

  return (
    <div className="animate-page-enter flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight m-0 text-slate-900 dark:text-white">System Audit Trail</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 m-0">
            Live activity logs across all departments — auto-refreshes every 15s
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button
            onClick={fetchLogs}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {selectedTab !== 'all' && (
            <button
              onClick={() => downloadPDF(selectedTab)}
              disabled={downloading}
              className="px-4 py-2 border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} /> {downloading ? 'Generating...' : `${currentDeptName} PDF`}
            </button>
          )}
          <button
            onClick={() => downloadPDF()}
            disabled={downloading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={14} /> {downloading ? 'Generating...' : 'Download Global PDF'}
          </button>
        </div>
      </header>

      {/* Department Tabs */}
      <div className="flex gap-2 mb-2 flex-wrap overflow-x-auto">
        {/* Global Tab */}
        <button
          onClick={() => setSelectedTab('all')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            selectedTab === 'all'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe size={14} /> All Departments
        </button>

        {/* Per-department tabs */}
        {departments.map(dept => (
          <button
            key={dept.id}
            onClick={() => setSelectedTab(dept.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              selectedTab === dept.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {dept.id === 'compssa' ? <Shield size={14} /> : <Building2 size={14} />}
            {dept.name}
          </button>
        ))}
      </div>

      {/* Summary strip */}
      <div className="flex gap-3 mb-2 flex-wrap">
        {Object.entries(ACTION_CONFIG).filter(([k]) => k !== 'DEFAULT').map(([key, cfg]) => {
          const count = logs.filter(l => l.action === key).length;
          return (
            <div key={key} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 flex items-center gap-3 min-w-[130px] shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider leading-none mb-1">{cfg.label}</div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <Activity className="opacity-30 mx-auto mb-3 animate-spin" size={32} />
            <p className="text-sm font-medium">Loading audit logs...</p>
          </div>
        ) : (
          <div className="p-5">
            <DataTable
              data={logs}
              columns={[
                {
                  key: 'timestamp',
                  label: 'Timestamp',
                  render: (log: AuditEntry) => (
                    <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs font-medium">
                      {new Date(log.timestamp).toLocaleString('en-GB', { hour12: false })}
                    </span>
                  ),
                },
                {
                  key: 'action',
                  label: 'Action',
                  render: (log: AuditEntry) => <ActionBadge action={log.action} />,
                },
                {
                  key: 'actorEmail',
                  label: 'Actor',
                  render: (log: AuditEntry) => (
                    <span className="font-semibold text-slate-900 dark:text-slate-100 max-w-[180px] truncate" title={log.actorEmail}>
                      {log.actorEmail}
                    </span>
                  ),
                },
                {
                  key: 'actorRole',
                  label: 'Role',
                  render: (log: AuditEntry) => <RoleBadge role={log.actorRole} />,
                },
                {
                  key: 'tenantName',
                  label: 'Department',
                  render: (log: AuditEntry) => (
                    <span className="text-slate-500 dark:text-slate-400 text-xs">{log.tenantName || log.tenantId}</span>
                  ),
                },
                {
                  key: 'description',
                  label: 'Description',
                  render: (log: AuditEntry) => (
                    <span className="text-slate-500 dark:text-slate-400 max-w-[250px] truncate inline-block" title={log.description}>
                      {log.description}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (log: AuditEntry) => (
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      log.status === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                    }`}>
                      {log.status}
                    </span>
                  ),
                },
              ]}
              searchPlaceholder="Search by actor, action, or description…"
              searchKeys={['actorEmail', 'action', 'description', 'tenantName']}
              dateField="timestamp"
              filters={[{
                key: 'actorRole',
                label: 'All Roles',
                options: [
                  { value: 'admin', label: 'Admin' },
                  { value: 'voter', label: 'Voter' },
                  { value: 'superadmin', label: 'Superadmin' },
                ],
              }, {
                key: 'status',
                label: 'All Status',
                options: [
                  { value: 'success', label: 'Success' },
                  { value: 'error', label: 'Error' },
                ],
              }]}
              emptyMessage="No activity yet — audit entries will appear here as users interact with the platform."
              pageSize={15}
            />
            {logs.length > 0 && (
              <div className="mt-3 text-xs text-slate-400 dark:text-slate-500 flex justify-between items-center">
                <span>Entries for <strong>{currentDeptName}</strong></span>
                <span>Auto-refreshing every 15 seconds</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
