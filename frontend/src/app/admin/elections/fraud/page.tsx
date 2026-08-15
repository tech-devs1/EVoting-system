'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Search, 
  Lock 
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredAlerts = alerts.filter(a => 
    a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.studentId && a.studentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (a.actorEmail && a.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Access Security Audit Log</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Real-time verification security events</p>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search security log..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--bg-input)' }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading security logs...</p>
        ) : filteredAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={36} style={{ color: 'var(--color-success)' }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontWeight: 600 }}>All Access Attempts Nominal</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', margin: 0 }}>No unauthorized access attempts or duplicate code requests detected for this election.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-input)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Timestamp</th>
                  <th style={{ padding: '10px 12px' }}>Target ID / Email</th>
                  <th style={{ padding: '10px 12px' }}>Security Event Description</th>
                  <th style={{ padding: '10px 12px' }}>IP Address</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((a, i) => (
                  <tr key={a.id || i} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{a.studentId || a.actorEmail || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{a.description}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.ip || '127.0.0.1'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${a.status === 'resolved' ? 'badge-success' : 'badge-danger'}`}>
                        {a.status || 'flagged'}
                      </span>
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

export default function PerElectionSecurityPage() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading security logs...</p>}>
      <PerElectionSecurityContent />
    </Suspense>
  );
}
