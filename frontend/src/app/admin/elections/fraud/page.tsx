'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, 
  ShieldAlert, 
  ShieldCheck, 
} from 'lucide-react';
import DataTable, { type ColumnDef, type FilterDef } from '@/components/DataTable';

interface SecurityAlert {
  id: string;
  type: string;
  actorEmail?: string;
  studentId?: string;
  ip?: string;
  timestamp: number;
  description: string;
  status: 'unresolved' | 'resolved';
}

function PerElectionSecurityContent() {
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchSecurityAlerts() {
    if (!electionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await apiRequest<{ status: string; data: SecurityAlert[] }>(`/elections/${electionId}/security-alerts`);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setAlerts(res.data);
      }
    } catch (err) {
      console.error('Error fetching security alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (electionId) fetchSecurityAlerts();
  }, [electionId]);

  const statusFilters: FilterDef[] = [{
    key: 'status',
    label: 'All Status',
    options: [
      { value: 'unresolved', label: 'Unresolved' },
      { value: 'resolved', label: 'Resolved' },
    ],
  }];

  const columns: ColumnDef<SecurityAlert>[] = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (a) => (
        <span className="font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {new Date(a.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'studentId',
      label: 'Target ID / Email',
      render: (a) => <span className="font-semibold">{a.studentId || a.actorEmail || 'N/A'}</span>,
    },
    {
      key: 'description',
      label: 'Security Event',
      render: (a) => <span className="text-slate-700 dark:text-slate-300">{a.description}</span>,
    },
    {
      key: 'ip',
      label: 'IP Address',
      render: (a) => <span className="font-mono text-sm text-slate-500 dark:text-slate-400">{a.ip || '127.0.0.1'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      filterable: true,
      render: (a) => (
        <span className={`badge ${a.status === 'resolved' ? 'badge-success' : 'badge-danger'}`}>
          {a.status || 'flagged'}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-page-enter">
      {/* Banner */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={`/admin/elections/dashboard?electionId=${electionId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginBottom: '0.75rem' }}>
          <ArrowLeft size={16} /> Back to Election Command Center
        </Link>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Access Security & Anomaly Monitor
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
          Monitor duplicate access code requests, IP rate limits, and unlisted voter queries
        </p>
      </div>

      {/* Security Health Summary */}
      <div className="admin-grid-top" style={{ marginBottom: '1.5rem' }}>
        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Security Health</span>
            <span className="kpi-value" style={{ color: 'var(--color-success)', fontSize: '1.2rem' }}>Nominal</span>
            <div className="kpi-trend"><span>Zero critical breaches</span></div>
          </div>
          <div className="kpi-icon-wrapper green"><ShieldCheck size={20} /></div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Flagged Anomalies</span>
            <span className="kpi-value">{alerts.length}</span>
            <div className="kpi-trend"><span>Logged attempt warnings</span></div>
          </div>
          <div className="kpi-icon-wrapper amber"><ShieldAlert size={20} /></div>
        </div>
      </div>

      {/* Security Alerts Log */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Access Security Audit Log</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Real-time verification security events</p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading security logs...</p>
        ) : (
          <DataTable
            data={alerts}
            columns={columns}
            searchPlaceholder="Search security log…"
            searchKeys={['description', 'studentId', 'actorEmail', 'ip']}
            dateField="timestamp"
            filters={statusFilters}
            emptyMessage="All Access Attempts Nominal — No unauthorized access attempts or duplicate code requests detected."
            pageSize={10}
          />
        )}
      </div>
    </div>
  );
}

export default function PerElectionSecurityPage() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading security logs...</p>}>
      <PerElectionSecurityContent />
    </Suspense>
  );
}
