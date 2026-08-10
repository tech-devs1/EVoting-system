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
  CheckCircle2,
  Edit,
  Eye,
  EyeOff
} from 'lucide-react';
import Modal from '@/components/Modal';

interface Election {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: 'draft' | 'scheduled' | 'active' | 'ended';
  startDate: string;
  endDate: string;
  showResults?: boolean;
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

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('Executive');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState<string>('active');
  const [editShowResults, setEditShowResults] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  async function fetchElectionData() {
    try {
      setLoading(true);
      const res = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
      if (res.status === 'success' && res.data) {
        setElection(res.data);
        setEditTitle(res.data.title || '');
        setEditDescription(res.data.description || '');
        setEditCategory(res.data.category || 'Executive');
        setEditStartDate(res.data.startDate ? new Date(res.data.startDate).toISOString().slice(0, 16) : '');
        setEditEndDate(res.data.endDate ? new Date(res.data.endDate).toISOString().slice(0, 16) : '');
        setEditStatus(res.data.status || 'active');
        setEditShowResults(Boolean(res.data.showResults));
      }
    } catch (err: any) {
      console.error('Error loading election:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Save Edit Election Metadata
  const handleSaveElectionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setMessage(null);

    try {
      const res = await apiRequest<{ status: string; message: string }>(
        `/elections/${electionId}`,
        'PATCH',
        {
          title: editTitle,
          description: editDescription,
          category: editCategory,
          startDate: editStartDate,
          endDate: editEndDate,
          status: editStatus,
          showResults: editShowResults
        }
      );

      if (res.status === 'success') {
        setMessage({ type: 'success', text: 'Election parameters updated successfully!' });
        setIsEditModalOpen(false);
        fetchElectionData();
      } else {
        throw new Error(res.message || 'Failed to update election');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update election parameters.' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle Results Publication Directly
  const handleTogglePublishResults = async () => {
    if (!election) return;
    const nextShow = !election.showResults;
    setActionLoading(true);
    setMessage(null);

    try {
      const res = await apiRequest<{ status: string; message: string }>(
        `/elections/${electionId}/toggle-results`,
        'PATCH',
        { showResults: nextShow }
      );

      if (res.status === 'success') {
        setMessage({
          type: 'success',
          text: nextShow
            ? 'Official Results are now PUBLISHED and live for voters to view!'
            : 'Official Results are now HIDDEN from voters.'
        });
        fetchElectionData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to toggle results publication.' });
    } finally {
      setActionLoading(false);
    }
  };

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
            <button onClick={() => setIsEditModalOpen(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}>
              <Edit size={14} /> Edit Election Details
            </button>
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

      {/* Official Results Visibility & Public Access Card */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: `4px solid ${election.showResults ? '#166534' : '#F59E0B'}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: election.showResults ? '#166534' : '#B45309', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {election.showResults ? <Eye size={16} /> : <EyeOff size={16} />}
              {election.showResults ? 'Official Results PUBLISHED to Voters' : 'Official Results HIDDEN from Voters'}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>
            {election.showResults
              ? 'Roster voters can view live charts, percentages, winner declarations, and audit logs.'
              : 'Public charts are locked. Only EC administrators can view live tally statistics until published.'}
          </p>
        </div>

        <button
          onClick={handleTogglePublishResults}
          disabled={actionLoading}
          className={election.showResults ? "btn btn-outline" : "btn btn-primary"}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, backgroundColor: election.showResults ? 'transparent' : '#2563eb' }}
        >
          {election.showResults ? <EyeOff size={16} /> : <Eye size={16} />}
          {election.showResults ? 'Unpublish / Hide Results' : '📢 Publish Official Results to All Voters'}
        </button>
      </div>

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

      {/* Edit Election Parameters Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Election Parameters"
        subtitle="Update title, description, time window, status, or results visibility"
        maxWidth="580px"
      >
        <form onSubmit={handleSaveElectionEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Election Title</label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Description & Purpose</label>
            <textarea
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Category / Department</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
              >
                <option value="Executive">SRC Executive Elections</option>
                <option value="Departmental">Departmental Elections</option>
                <option value="Hall">Hall of Residence Elections</option>
                <option value="Association">Faculty Association</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Election Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
              >
                <option value="draft">Draft (Setup Phase)</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active (Voting Open)</option>
                <option value="ended">Ended (Voting Closed)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Voting Start Date & Time</label>
              <input
                type="datetime-local"
                required
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Voting End Date & Time</label>
              <input
                type="datetime-local"
                required
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
              <input
                type="checkbox"
                checked={editShowResults}
                onChange={(e) => setEditShowResults(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
              />
              Publish Official Results Publicly to Roster Voters
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={savingEdit} className="btn btn-primary" style={{ backgroundColor: '#2563eb', fontWeight: 700 }}>
              {savingEdit ? 'Saving Changes...' : 'Save Election Parameters'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
