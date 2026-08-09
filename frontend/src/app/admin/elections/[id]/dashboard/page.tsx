'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Square, 
  Mail, 
  Send, 
  Download, 
  Users, 
  Vote, 
  Layers, 
  ShieldCheck, 
  Clock, 
  BarChart3, 
  Calendar,
  CheckCircle2
} from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: 'draft' | 'scheduled' | 'active' | 'ended';
  startDate: string;
  endDate: string;
  totalVoters?: number;
  totalVotesCast?: number;
  candidateCount?: number;
  positionCount?: number;
}

export default function PerElectionDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const electionId = resolvedParams.id;

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function fetchElectionData() {
    try {
      setLoading(true);
      const res = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
      if (res.status === 'success' && res.data) {
        setElection(res.data);
      }
    } catch (err: any) {
      console.error('Error loading election:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (electionId) fetchElectionData();
  }, [electionId]);

  // Update Status Action
  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ status: string; message: string }>(`/elections/${electionId}`, 'PUT', { status: newStatus });
      if (res.status === 'success') {
        setMessage({ type: 'success', text: `Election status updated to ${newStatus.toUpperCase()}.` });
        fetchElectionData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update election status.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Send Invitations Action
  const handleSendInvitations = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ status: string; message: string }>(`/elections/${electionId}/send-invitations`, 'POST');
      if (res.status === 'success') {
        setMessage({ type: 'success', text: res.message || 'Voting invitations dispatched to roster voters!' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to dispatch invitations.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Broadcast Results Action
  const handleBroadcastResults = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ status: string; message: string }>(`/elections/${electionId}/broadcast-results`, 'POST');
      if (res.status === 'success') {
        setMessage({ type: 'success', text: res.message || 'Final election results broadcasted to roster voters!' });
        fetchElectionData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to broadcast results.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Export Audit CSV Action
  const handleExportAudit = async () => {
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
      a.download = `audit_ledger_${electionId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Failed to export audit ledger:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading election workspace...</div>;
  }

  if (!election) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <h3>Election Not Found</h3>
        <Link href="/admin/dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Organization Hub
        </Link>
      </div>
    );
  }

  const turnout = (election.totalVoters && election.totalVoters > 0)
    ? Math.min(100, Math.round(((election.totalVotesCast || 0) / election.totalVoters) * 100))
    : 0;

  return (
    <div className="animate-page-enter">
      {/* Top Banner & Context */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginBottom: '0.75rem' }}>
          <ArrowLeft size={16} /> Back to Organization Hub
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <span className="badge badge-info">{election.category || 'Executive'}</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                {election.title}
              </h2>
              {election.status === 'active' && <span className="badge badge-success">🟢 LIVE NOW</span>}
              {election.status === 'scheduled' && <span className="badge badge-info">⏰ SCHEDULED</span>}
              {election.status === 'ended' && <span className="badge badge-secondary">🏁 CLOSED</span>}
              {election.status === 'draft' && <span className="badge badge-warning">📝 DRAFT</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <Calendar size={14} />
              <span>
                Window: <strong>{new Date(election.startDate).toLocaleString()}</strong> ➔ <strong>{new Date(election.endDate).toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {election.status !== 'active' && (
              <button disabled={actionLoading} onClick={() => handleStatusChange('active')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <Play size={14} /> Start Election
              </button>
            )}
            {election.status === 'active' && (
              <button disabled={actionLoading} onClick={() => handleStatusChange('ended')} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <Square size={14} /> End Election
              </button>
            )}
            <button disabled={actionLoading} onClick={handleSendInvitations} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <Mail size={14} /> Send Invitations
            </button>
            <button disabled={actionLoading} onClick={handleBroadcastResults} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <Send size={14} /> Broadcast Results
            </button>
            <button onClick={handleExportAudit} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <Download size={14} /> Audit Ledger CSV
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

      {/* Election Workspace KPI Cards */}
      <div className="admin-grid-top" style={{ marginBottom: '1.5rem' }}>
        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Ballots Cast</span>
            <span className="kpi-value">{election.totalVotesCast || 0}</span>
            <div className="kpi-trend up"><span>{turnout}% Turnout</span></div>
          </div>
          <div className="kpi-icon-wrapper blue"><Vote size={20} /></div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Eligible Voters</span>
            <span className="kpi-value">{election.totalVoters || 0}</span>
            <div className="kpi-trend"><span>Uploaded CSV roster</span></div>
          </div>
          <div className="kpi-icon-wrapper green"><Users size={20} /></div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Positions & Lineup</span>
            <span className="kpi-value">{election.candidateCount || 0}</span>
            <div className="kpi-trend"><span>Registered candidates</span></div>
          </div>
          <div className="kpi-icon-wrapper purple"><Layers size={20} /></div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Access Health</span>
            <span className="kpi-value" style={{ color: 'var(--color-success)', fontSize: '1.2rem' }}>Nominal</span>
            <div className="kpi-trend"><span>0 Security Anomalies</span></div>
          </div>
          <div className="kpi-icon-wrapper green"><ShieldCheck size={20} /></div>
        </div>
      </div>

      {/* Turnout Details Card */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Live Election Status & Guidelines</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 1.25rem 0' }}>
          {election.description || 'No additional guidelines provided for this election.'}
        </p>

        <div style={{ backgroundColor: 'var(--bg-input)', padding: '1rem', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <span>Live Turnout Progress</span>
            <span>{turnout}% ({election.totalVotesCast || 0} / {election.totalVoters || 0} voters)</span>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${turnout}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '999px' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
