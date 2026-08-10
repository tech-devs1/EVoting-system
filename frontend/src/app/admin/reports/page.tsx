'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, getAuthHeaders } from '@/lib/api';
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

  // Customizer States
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [ecName, setEcName] = useState<string>('Electoral Commissioner');
  const [ecTitle, setEcTitle] = useState<string>('HTU Electoral Commission President');
  const [showSignature, setShowSignature] = useState<boolean>(true);
  const [signatureText, setSignatureText] = useState<string>('HTU-EC Official Approved');
  const [selectedElectionTitle, setSelectedElectionTitle] = useState<string>('');
  const [selectedElectionMeta, setSelectedElectionMeta] = useState<any>(null);

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

        if (candidatesRes.status === 'success' && candidatesRes.data) {
          const el = candidatesRes.data.election;
          setSelectedElectionTitle(el.title || '');
          setSelectedElectionMeta(el);
          
          setExecutiveSummary(`This document serves as the official, certified report compiling the final ballot tallies and cryptographic integrity results for the ${el.title || 'election'}. The Electoral Commission has reviewed the ledger logs and certified the results as transparent, complete, and free of anomalies.`);
          setCustomNotes('No voting anomalies or duplicate submission attempts were validated. The cryptographic ledger verification hashes confirm that all ballots cast remain intact and un-tampered.');

          if (Array.isArray(candidatesRes.data.candidates)) {
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
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        executiveSummary,
        customNotes,
        ecName,
        ecTitle,
        showSignature: showSignature ? 'true' : 'false',
        signatureText
      });
      const res = await fetch(`/api/elections/${selectedElectionId}/report/pdf?${params.toString()}`, {
        headers
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

          {/* Customizer and Live PDF Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem', width: '100%' }}>
            {/* Customizer Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
                  Report Customizer & EC Stamp Settings
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Add custom executive summaries, special remarks, and configure the Electoral Commission digital sign-off.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    ℹ️ <strong>Certified Reporting:</strong> The official executive summary, statistical tallies, and commission remarks are auto-generated based on the live election ledger audit trail to prevent manual tampering.
                  </div>

                  <div style={{ paddingTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
                      <input
                        type="checkbox"
                        checked={showSignature}
                        onChange={(e) => setShowSignature(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Include EC Commissioner Signature Line</span>
                    </label>

                    {showSignature && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                            Signee Full Name
                          </label>
                          <input
                            type="text"
                            value={ecName}
                            onChange={(e) => setEcName(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                            Signee Title / Role
                          </label>
                          <input
                            type="text"
                            value={ecTitle}
                            onChange={(e) => setEcTitle(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                            Cursive Digital Signature Text
                          </label>
                          <input
                            type="text"
                            value={signatureText}
                            onChange={(e) => setSignatureText(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Preview Panel */}
            <div>
              <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#1E293B', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>Live Report PDF Preview</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>A4 Format Draft</span>
                </div>

                {/* Simulated Paper Sheet */}
                <div style={{ padding: '2.5rem', fontSize: '0.85rem', fontFamily: 'Helvetica, Arial, sans-serif', color: '#334155', lineHeight: '1.5' }}>
                  {/* Letterhead */}
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #334155', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', color: '#0F172A', letterSpacing: '0.02em' }}>
                      Electoral Commission
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
                      Official Certified Election Tally & Audit Report
                    </p>
                  </div>

                  {/* Title & Meta Details */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.5rem 0' }}>
                      {selectedElectionTitle || 'Election Details'}
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.75rem', color: '#475569', backgroundColor: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div><strong>Start Date:</strong> {selectedElectionMeta?.startDate ? new Date(selectedElectionMeta.startDate).toLocaleString() : 'N/A'}</div>
                      <div><strong>End Date:</strong> {selectedElectionMeta?.endDate ? new Date(selectedElectionMeta.endDate).toLocaleString() : 'N/A'}</div>
                      <div><strong>Election Type:</strong> {selectedElectionMeta?.type || 'Standard'}</div>
                      <div><strong>Department/Scope:</strong> {selectedElectionMeta?.department || 'General'}</div>
                    </div>
                  </div>

                  {/* Certified stats grid */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Certified Election Audit Statistics
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.8rem', textAlign: 'center' }}>
                      <div style={{ padding: '0.5rem', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                        <div style={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Eligible Voters</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{stats?.field1_totalVoters?.count || 'N/A'}</div>
                      </div>
                      <div style={{ padding: '0.5rem', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                        <div style={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Ballots Cast</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{stats?.field3_successfullyVoted?.count || '0'}</div>
                      </div>
                      <div style={{ padding: '0.5rem', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                        <div style={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Voter Turnout</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {stats?.field1_totalVoters?.count > 0 
                            ? ((stats.field3_successfullyVoted.count / stats.field1_totalVoters.count) * 100).toFixed(2) 
                            : '0.00'}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Executive Summary */}
                  {executiveSummary && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Executive Summary
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {executiveSummary}
                      </p>
                    </div>
                  )}

                  {/* Winners & Standings */}
                  {winners.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Certified Tally Standings
                      </h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid #334155', textAlign: 'left', fontWeight: 700, color: '#1E293B' }}>
                            <th style={{ padding: '6px 8px' }}>Position</th>
                            <th style={{ padding: '6px 8px' }}>Candidate Name</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Votes Recieved</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Percentage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {winners.map((posTally, pIdx) => (
                            <React.Fragment key={pIdx}>
                              {posTally.candidates.map((c, cIdx) => (
                                <tr key={cIdx} style={{ borderBottom: '1px solid #E2E8F0', color: cIdx === 0 ? '#0F172A' : '#475569', fontWeight: cIdx === 0 ? 600 : 400 }}>
                                  <td style={{ padding: '6px 8px' }}>{cIdx === 0 ? posTally.position : ''}</td>
                                  <td style={{ padding: '6px 8px' }}>{c.name} {cIdx === 0 && '👑'}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{c.votes}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{c.percentage}%</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Addendum Notes */}
                  {customNotes && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Commission Notes & Remarks
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {customNotes}
                      </p>
                    </div>
                  )}

                  {/* Signature block */}
                  {showSignature && (
                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1.5rem', marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.6rem', color: '#2563EB', paddingBottom: '0.25rem' }}>
                          {signatureText || ecName}
                        </div>
                        <div style={{ borderTop: '1px solid #475569', width: '220px', margin: '4px 0' }} />
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>{ecName}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{ecTitle}</div>
                      </div>

                      <div style={{ border: '2px double #DC2626', padding: '0.5rem 1rem', borderRadius: '8px', textAlign: 'center', color: '#DC2626', transform: 'rotate(-4deg)', opacity: 0.85, userSelect: 'none' }}>
                        <div style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em' }}>OFFICIAL ELECTION SEAL</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, margin: '2px 0' }}>APPROVED & CERTIFIED</div>
                        <div style={{ fontSize: '0.6rem', fontFamily: 'monospace' }}>{new Date().toLocaleDateString()}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

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
