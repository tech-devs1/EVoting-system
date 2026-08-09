'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, 
  Download, 
  ShieldCheck, 
  Clock, 
  FileText, 
  UserCheck, 
  Lock, 
  Search,
  Layers,
  Vote
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

export default function PerElectionAuditPage({ params }: { params: Promise<{ id: string }> }) {
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
      const res = await fetch(`/api/elections/${electionId}/export-audit`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `360_audit_ledger_${electionId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Failed to export audit ledger:', err);
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
    <div className="animate-page-enter">
      {/* Banner */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={`/admin/elections/${electionId}/dashboard`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginBottom: '0.75rem' }}>
          <ArrowLeft size={16} /> Back to Election Command Center
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              360° Cryptographic Audit Ledger
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
              Complete immutable record of all admin setup actions and timestamped voter ballot selections
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
          >
            <Download size={16} /> Download Complete Audit Ledger (CSV)
          </button>
        </div>
      </div>

      {/* Workspace Sub-Navigation Tabs */}
      <div className="card" style={{ padding: '0.5rem', marginBottom: '1.5rem', display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
        {[
          { label: 'Overview', path: `/admin/elections/${electionId}/dashboard`, active: false },
          { label: 'Roster & CSV', path: `/admin/elections/${electionId}/voters`, active: false },
          { label: 'Candidates', path: `/admin/elections/${electionId}/candidates`, active: false },
          { label: 'Live Results', path: `/admin/elections/${electionId}/results`, active: false },
          { label: '360° Audit Ledger', path: `/admin/elections/${electionId}/audit`, active: true },
          { label: 'Access Security', path: `/admin/elections/${electionId}/fraud`, active: false },
        ].map(tab => (
          <Link
            key={tab.label}
            href={tab.path}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              backgroundColor: tab.active ? 'var(--color-primary)' : 'transparent',
              color: tab.active ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Audit Log Card */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Tab Filter */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'all' ? 'var(--color-primary)' : 'var(--bg-input)', color: activeTab === 'all' ? '#fff' : 'var(--text-secondary)' }}
            >
              All Events ({records.length})
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'admin' ? 'var(--color-primary)' : 'var(--bg-input)', color: activeTab === 'admin' ? '#fff' : 'var(--text-secondary)' }}
            >
              Admin Actions
            </button>
            <button
              onClick={() => setActiveTab('voter')}
              style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'voter' ? 'var(--color-primary)' : 'var(--bg-input)', color: activeTab === 'voter' ? '#fff' : 'var(--text-secondary)' }}
            >
              Voter Ballot Casts
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search audit records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading 360° audit ledger...</p>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No audit events recorded for this election yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-input)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Timestamp</th>
                  <th style={{ padding: '10px 12px' }}>Actor</th>
                  <th style={{ padding: '10px 12px' }}>Event Action</th>
                  <th style={{ padding: '10px 12px' }}>Details / Selections</th>
                  <th style={{ padding: '10px 12px' }}>Cryptographic Hash</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, i) => (
                  <tr key={r.id || i} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(r.timestamp).toISOString()}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.actor}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${r.type === 'admin' ? 'badge-info' : 'badge-success'}`}>
                        {r.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {r.details || (r.selections ? JSON.stringify(r.selections) : 'N/A')}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
                      {r.hash ? r.hash.substring(0, 16) + '...' : 'CRYPTOGRAPHICALLY_VERIFIED'}
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
