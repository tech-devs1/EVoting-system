'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, 
  Send, 
  Download, 
  Trophy, 
  Vote, 
  Users, 
  RefreshCw, 
  CheckCircle2, 
  BarChart3 
} from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  votes: number;
  noVotes?: number;
  isIndependent?: boolean;
  photoUrl?: string;
}

interface Election {
  id: string;
  title: string;
  status: string;
  totalVoters?: number;
  totalVotesCast?: number;
}

export default function PerElectionResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const electionId = resolvedParams.id;

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function fetchResultsData() {
    try {
      setLoading(true);
      const res = await apiRequest<{
        status: string;
        data: {
          election: Election;
          candidates: Candidate[];
          totalVotes: number;
        };
      }>(`/elections/${electionId}/results`);

      if (res.status === 'success' && res.data) {
        setElection(res.data.election);
        setCandidates(res.data.candidates);
      }
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (electionId) fetchResultsData();
  }, [electionId]);

  // Broadcast Results Action
  const handleBroadcastResults = async () => {
    setBroadcastLoading(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ status: string; message: string }>(`/elections/${electionId}/broadcast-results`, 'POST');
      if (res.status === 'success') {
        setMessage({ type: 'success', text: res.message || 'Election results broadcasted successfully to all roster voters via email!' });
        fetchResultsData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to broadcast results.' });
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Group Candidates by Position
  const positionsMap: Record<string, Candidate[]> = {};
  candidates.forEach(c => {
    const pos = c.position || 'General';
    if (!positionsMap[pos]) positionsMap[pos] = [];
    positionsMap[pos].push(c);
  });

  const totalVotesCast = election?.totalVotesCast || 0;
  const totalVoters = election?.totalVoters || 0;
  const turnout = totalVoters > 0 ? Math.min(100, Math.round((totalVotesCast / totalVoters) * 100)) : 0;

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
              Live Results & Tallies
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
              Real-time candidate vote tallies and certified results broadcast
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleBroadcastResults}
              disabled={broadcastLoading}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
            >
              <Send size={16} /> {broadcastLoading ? 'Broadcasting...' : '1-Click Broadcast Results to Voters'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          color: message.type === 'success' ? '#166534' : '#dc2626',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Summary KPI Bar */}
      <div className="admin-grid-top" style={{ marginBottom: '1.5rem' }}>
        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Ballots Cast</span>
            <span className="kpi-value">{totalVotesCast}</span>
            <div className="kpi-trend up"><span>{turnout}% Live Turnout</span></div>
          </div>
          <div className="kpi-icon-wrapper blue"><Vote size={20} /></div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Total Roster</span>
            <span className="kpi-value">{totalVoters}</span>
            <div className="kpi-trend"><span>Eligible voters</span></div>
          </div>
          <div className="kpi-icon-wrapper green"><Users size={20} /></div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Contested Positions</span>
            <span className="kpi-value">{Object.keys(positionsMap).length}</span>
            <div className="kpi-trend"><span>Ballot categories</span></div>
          </div>
          <div className="kpi-icon-wrapper purple"><BarChart3 size={20} /></div>
        </div>
      </div>

      {/* Position-by-Position Tally Breakdown */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading live vote tallies...</p>
      ) : Object.keys(positionsMap).length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No candidate vote records available yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(positionsMap).map(([positionTitle, candidateList]) => {
            // Sort by highest votes first
            const sortedCandidates = [...candidateList].sort((a, b) => (b.votes || 0) - (a.votes || 0));
            const highestVotes = sortedCandidates[0]?.votes || 0;

            return (
              <div key={positionTitle} className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  <Trophy size={18} style={{ color: '#f59e0b' }} />
                  {positionTitle}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {sortedCandidates.map((cand, idx) => {
                    const votes = cand.votes || 0;
                    const positionTotal = candidateList.reduce((sum, c) => sum + (c.votes || 0), 0);
                    const pct = positionTotal > 0 ? Math.round((votes / positionTotal) * 100) : 0;
                    const isLeader = idx === 0 && votes > 0;

                    return (
                      <div key={cand.id} style={{ backgroundColor: 'var(--bg-input)', borderRadius: '12px', padding: '1rem', border: isLeader ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, overflow: 'hidden' }}>
                              {cand.photoUrl ? (
                                <img src={cand.photoUrl} alt={cand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                cand.name.substring(0, 2).toUpperCase()
                              )}
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{cand.name}</span>
                                {isLeader && (
                                  <span className="badge badge-warning" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                    🏆 LEADER
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{votes} votes</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>{pct}% of position</span>
                          </div>
                        </div>

                        {/* Animated Vote Progress Bar */}
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: isLeader ? '#f59e0b' : 'var(--color-primary)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
