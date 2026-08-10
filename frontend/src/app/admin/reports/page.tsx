'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import {
  FileText,
  Download,
  Users,
  Vote,
  CheckCircle2,
  Search,
  ArrowLeft,
  Trophy,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface Election {
  id: string;
  title: string;
  status: string;
  category?: string;
}

interface Voter {
  id: string;
  studentId: string;
  name: string;
  email: string;
  programme?: string;
  level?: string;
  isRegistered: boolean;
  hasVoted: boolean;
  verificationCode?: string;
}

interface PositionWinners {
  position: string;
  candidates: {
    name: string;
    votes: number;
    percentage: string;
  }[];
  winner: {
    name: string;
    votes: number;
    percentage: string;
  } | null;
}

export default function AdminReportsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [loadingElections, setLoadingElections] = useState(true);

  // Report Stats
  const [stats, setStats] = useState<any>(null);
  const [winners, setWinners] = useState<PositionWinners[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'voted' | 'pending'>('all');

  // Fetch elections list
  useEffect(() => {
    async function loadElections() {
      try {
        setLoadingElections(true);
        const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
        if (res.status === 'success' && Array.isArray(res.data)) {
          setElections(res.data);
          if (res.data.length > 0) {
            // Find first active, or completed, or just the first election
            const activeOrCompleted = res.data.find(e => e.status === 'active' || e.status === 'completed');
            setSelectedElectionId(activeOrCompleted ? activeOrCompleted.id : res.data[0].id);
          }
        }
      } catch (err: any) {
        console.error('Error fetching elections:', err);
        setError('Failed to fetch elections list.');
      } finally {
        setLoadingElections(false);
      }
    }
    loadElections();
  }, []);

  // Fetch report data when election changes
  useEffect(() => {
    if (!selectedElectionId) return;

    async function fetchReport() {
      try {
        setLoadingReport(true);
        setError(null);
        setWinners([]);
        setVoters([]);

        // 1. Fetch Summary Statistics & Voters list
        const reportRes = await apiRequest<{
          status: string;
          data: {
            summary: any;
            activeElectionTitle: string;
            voters: Voter[];
          }
        }>(`/admin/report?nocache=true`);

        if (reportRes.status === 'success' && reportRes.data) {
          setStats(reportRes.data.summary);
          setVoters(reportRes.data.voters);
        }

        // 2. Fetch specific election candidates/winners data
        const candidatesRes = await apiRequest<{
          status: string;
          data: {
            election: any;
            statistics: any;
            candidates: {
              name: string;
              position: string;
              votes: number;
              percentage: string;
              isIndependent?: boolean;
              noVotes?: number;
            }[];
          }
        }>(`/elections/${selectedElectionId}/report`);

        if (candidatesRes.status === 'success' && candidatesRes.data && Array.isArray(candidatesRes.data.candidates)) {
          // Group candidates by position to determine winners
          const candidates = candidatesRes.data.candidates;
          const posMap: Record<string, typeof candidates> = {};
          candidates.forEach(c => {
            const pos = c.position || 'General';
            if (!posMap[pos]) posMap[pos] = [];
            posMap[pos].push(c);
          });

          const posWinnersList: PositionWinners[] = Object.entries(posMap).map(([position, list]) => {
            // Sort list by highest votes
            const sortedList = [...list].sort((a, b) => b.votes - a.votes);
            const winnerCand = sortedList[0] || null;

            return {
              position,
              candidates: sortedList.map(c => ({
                name: c.name,
                votes: c.votes,
                percentage: c.percentage
              })),
              winner: winnerCand ? {
                name: winnerCand.name,
                votes: winnerCand.votes,
                percentage: winnerCand.percentage
              } : null
            };
          });

          setWinners(posWinnersList);
        }
      } catch (err: any) {
        console.error('Error loading election report:', err);
        setError('Failed to load comprehensive report. Try uploading a roster or casting some test ballots first.');
      } finally {
        setLoadingReport(false);
      }
    }

    fetchReport();
  }, [selectedElectionId]);

  // Handle PDF Download
  const handleDownloadPDF = async () => {
    if (!selectedElectionId) return;
    try {
      const res = await fetch(`/api/elections/${selectedElectionId}/report/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `election_report_${selectedElectionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Failed to export PDF report:', err);
    }
  };

  // Filter Voters list
  const filteredVoters = voters.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'voted') return matchesSearch && v.hasVoted;
    if (statusFilter === 'pending') return matchesSearch && !v.hasVoted;
    return matchesSearch;
  });

  return (
    <div className="animate-page-enter">
      {/* Banner */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginBottom: '0.75rem' }}>
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Election Report Center
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
              Draft and download high-fidelity certified reports, including position-by-position standings & complete voter rosters
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {loadingElections ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading elections...</span>
            ) : (
              <select
                value={selectedElectionId}
                onChange={(e) => setSelectedElectionId(e.target.value)}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
              >
                {elections.map(el => (
                  <option key={el.id} value={el.id}>{el.title} ({el.status.toUpperCase()})</option>
                ))}
              </select>
            )}

            <button
              onClick={handleDownloadPDF}
              disabled={loadingReport || !selectedElectionId}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
            >
              <Download size={16} /> Download Report PDF
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {loadingReport ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <RefreshCw className="animate-spin" style={{ margin: '0 auto 1rem auto' }} size={32} />
          <p>Compiling comprehensive election audit report draft...</p>
        </div>
      ) : (
        <>
          {/* Winners & Standings Box at the Top of Report */}
          {winners.length > 0 && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Trophy size={18} style={{ color: '#F59E0B' }} />
                Current Standings & Provisional Winners
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {winners.map((pw, i) => (
                  <div key={i} style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>{pw.position}</span>
                    <h4 style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {pw.winner ? pw.winner.name : 'No Candidates'}
                    </h4>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                      <span>Winner Votes:</span>
                      <strong>{pw.winner ? `${pw.winner.votes} (${pw.winner.percentage}%)` : '—'}</strong>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>All Position Standings:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {pw.candidates.map((cand, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{idx + 1}. {cand.name}</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cand.votes}v ({cand.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3 Key Summary Stats */}
          {stats && (
            <div className="admin-grid-top" style={{ marginBottom: '1.5rem' }}>
              <div className="card kpi-card" style={{ borderLeft: `4px solid ${stats.field1_totalVoters.isSuccessful ? '#166534' : '#DC2626'}` }}>
                <div className="kpi-details">
                  <span className="kpi-label">{stats.field1_totalVoters.label}</span>
                  <span className="kpi-value">{stats.field1_totalVoters.count}</span>
                  <div className="kpi-trend" style={{ color: stats.field1_totalVoters.isSuccessful ? '#166534' : '#DC2626' }}>
                    <span>Status: {stats.field1_totalVoters.mark} Roster Uploaded</span>
                  </div>
                </div>
                <div className="kpi-icon-wrapper blue"><Users size={20} /></div>
              </div>

              <div className="card kpi-card" style={{ borderLeft: `4px solid ${stats.field2_registeredVoters.isSuccessful ? '#166534' : '#DC2626'}` }}>
                <div className="kpi-details">
                  <span className="kpi-label">{stats.field2_registeredVoters.label}</span>
                  <span className="kpi-value">{stats.field2_registeredVoters.count}</span>
                  <div className="kpi-trend" style={{ color: stats.field2_registeredVoters.isSuccessful ? '#166534' : '#DC2626' }}>
                    <span>Status: {stats.field2_registeredVoters.mark} Members Registered</span>
                  </div>
                </div>
                <div className="kpi-icon-wrapper purple"><CheckCircle2 size={20} /></div>
              </div>

              <div className="card kpi-card" style={{ borderLeft: `4px solid ${stats.field3_successfullyVoted.isSuccessful ? '#166534' : '#DC2626'}` }}>
                <div className="kpi-details">
                  <span className="kpi-label">{stats.field3_successfullyVoted.label}</span>
                  <span className="kpi-value">{stats.field3_successfullyVoted.count}</span>
                  <div className="kpi-trend" style={{ color: stats.field3_successfullyVoted.isSuccessful ? '#166534' : '#DC2626' }}>
                    <span>Status: {stats.field3_successfullyVoted.mark} Ballots Successfully Cast</span>
                  </div>
                </div>
                <div className="kpi-icon-wrapper green"><Vote size={20} /></div>
              </div>
            </div>
          )}

          {/* Voter Roster & Voting Verification Audit Log */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Voter Audit & Status Directory</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Search and trace individual voters registration and ledger verification hashes</p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search voter name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    onClick={() => setStatusFilter('all')}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: statusFilter === 'all' ? 'var(--color-primary)' : 'var(--bg-input)', color: statusFilter === 'all' ? '#fff' : 'var(--text-secondary)' }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setStatusFilter('voted')}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: statusFilter === 'voted' ? 'var(--color-primary)' : 'var(--bg-input)', color: statusFilter === 'voted' ? '#fff' : 'var(--text-secondary)' }}
                  >
                    Voted
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: statusFilter === 'pending' ? 'var(--color-primary)' : 'var(--bg-input)', color: statusFilter === 'pending' ? '#fff' : 'var(--text-secondary)' }}
                  >
                    Pending
                  </button>
                </div>
              </div>
            </div>

            {filteredVoters.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No voter status records match your query.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-input)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Student ID</th>
                      <th style={{ padding: '10px 12px' }}>Full Name</th>
                      <th style={{ padding: '10px 12px' }}>Email</th>
                      <th style={{ padding: '10px 12px' }}>Registration Status</th>
                      <th style={{ padding: '10px 12px' }}>Voting Status</th>
                      <th style={{ padding: '10px 12px' }}>Verification Audit Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVoters.map((v, i) => (
                      <tr key={v.id || i} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{v.studentId}</td>
                        <td style={{ padding: '10px 12px' }}>{v.name}</td>
                        <td style={{ padding: '10px 12px' }}>{v.email || 'N/A'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge ${v.isRegistered ? 'badge-success' : 'badge-warning'}`}>
                            {v.isRegistered ? 'Registered' : 'Not Registered'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge ${v.hasVoted ? 'badge-success' : 'badge-secondary'}`}>
                            {v.hasVoted ? 'Ballot Cast' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--color-primary)', fontSize: '0.8rem' }}>
                          {v.verificationCode || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
