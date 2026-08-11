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
    <div className="animate-page-enter">
      {/* Banner Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={`/admin/elections/${electionId}/dashboard`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginBottom: '0.75rem' }}>
          <ArrowLeft size={16} /> Back to Election Command Center
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Election System Audit
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
              Official system logs detailing admin activities, voter actions, and precise vote cast timestamps.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
          >
            <Download size={16} /> Export Audit Log (CSV)
          </button>
        </div>
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
              All Activities ({records.length})
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'admin' ? 'var(--color-primary)' : 'var(--bg-input)', color: activeTab === 'admin' ? '#fff' : 'var(--text-secondary)' }}
            >
              Admin Activities
            </button>
            <button
              onClick={() => setActiveTab('voter')}
              style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'voter' ? 'var(--color-primary)' : 'var(--bg-input)', color: activeTab === 'voter' ? '#fff' : 'var(--text-secondary)' }}
            >
              Voter Ballots & Timestamps
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading system audit log...</p>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No matching activities recorded for this election yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-input)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Timestamp</th>
                  <th style={{ padding: '10px 12px' }}>Actor</th>
                  <th style={{ padding: '10px 12px' }}>Type</th>
                  <th style={{ padding: '10px 12px' }}>Activity / Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, i) => (
                  <tr key={r.id || i} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.actor}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${r.type === 'admin' ? 'badge-info' : 'badge-success'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {r.type === 'admin' ? <Activity size={12} /> : <User size={12} />}
                        {r.type === 'admin' ? 'Admin Activity' : 'Voter Cast'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>
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
