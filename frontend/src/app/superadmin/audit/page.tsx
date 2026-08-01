'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { Activity, Download, RefreshCw, Building2, Globe, Shield, ChevronDown } from 'lucide-react';

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
  VOTER_LOGIN:  { label: 'Voter Login',  color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  ADMIN_LOGIN:  { label: 'Admin Login',  color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  CSV_UPLOAD:   { label: 'CSV Upload',   color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  VOTE_CAST:    { label: 'Vote Cast',    color: '#0891B2', bg: 'rgba(8,145,178,0.1)' },
  DEPT_CREATED: { label: 'Dept Created', color: '#D97706', bg: 'rgba(217,119,6,0.1)' },
  DEFAULT:      { label: 'Action',       color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
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
  const map: Record<string, string> = { admin: '#7C3AED', voter: '#2563EB', superadmin: '#D97706' };
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
    <div className="animate-page-enter">
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, margin: 0 }}>System Audit Trail</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-sm)' }}>
            Live activity logs across all departments — auto-refreshes every 15s
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={fetchLogs}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {selectedTab !== 'all' && (
            <button
              onClick={() => downloadPDF(selectedTab)}
              disabled={downloading}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
            >
              <Download size={14} /> {downloading ? 'Generating...' : `${currentDeptName} PDF`}
            </button>
          )}
          <button
            onClick={() => downloadPDF()}
            disabled={downloading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)' }}
          >
            <Download size={14} /> {downloading ? 'Generating...' : 'Download Global PDF'}
          </button>
        </div>
      </header>

      {/* Department Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-6)', flexWrap: 'wrap', overflowX: 'auto' }}>
        {/* Global Tab */}
        <button
          onClick={() => setSelectedTab('all')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: 'var(--radius-lg)',
            border: selectedTab === 'all' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
            background: selectedTab === 'all' ? 'var(--color-primary)' : 'var(--bg-secondary)',
            color: selectedTab === 'all' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)',
            transition: 'all 0.15s ease'
          }}
        >
          <Globe size={14} /> All Departments
        </button>

        {/* Per-department tabs */}
        {departments.map(dept => (
          <button
            key={dept.id}
            onClick={() => setSelectedTab(dept.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: 'var(--radius-lg)',
              border: selectedTab === dept.id ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
              background: selectedTab === dept.id ? 'var(--color-primary)' : 'var(--bg-secondary)',
              color: selectedTab === dept.id ? 'white' : 'var(--text-primary)',
              cursor: 'pointer', fontWeight: 500, fontSize: 'var(--text-sm)',
              transition: 'all 0.15s ease'
            }}
          >
            {dept.id === 'compssa' ? <Shield size={14} /> : <Building2 size={14} />}
            {dept.name}
          </button>
        ))}
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {Object.entries(ACTION_CONFIG).filter(([k]) => k !== 'DEFAULT').map(([key, cfg]) => {
          const count = logs.filter(l => l.action === key).length;
          return (
            <div key={key} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{cfg.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Activity size={32} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
            <p>Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Activity size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>No Activity Yet</h3>
            <p style={{ fontSize: 'var(--text-sm)' }}>Audit entries will appear here as users interact with the platform.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id} style={{ borderBottom: idx < logs.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '11px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {new Date(log.timestamp).toLocaleString('en-GB', { hour12: false })}
                    </td>
                    <td style={{ padding: '11px 16px' }}><ActionBadge action={log.action} /></td>
                    <td style={{ padding: '11px 16px', fontWeight: 500, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.actorEmail}>
                      {log.actorEmail}
                    </td>
                    <td style={{ padding: '11px 16px' }}><RoleBadge role={log.actorRole} /></td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {log.tenantName || log.tenantId}
                    </td>
                    <td style={{ padding: '11px 16px', color: 'var(--text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.description}>
                      {log.description}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        color: log.status === 'success' ? '#059669' : '#DC2626',
                        background: log.status === 'success' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)'
                      }}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {logs.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Showing {logs.length} most recent entries for <strong>{currentDeptName}</strong></span>
            <span>Auto-refreshing every 15 seconds</span>
          </div>
        )}
      </div>
    </div>
  );
}
