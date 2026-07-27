'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { Plus, FolderOpen, Settings, Activity, Trash, ArrowLeft, Download, Clock } from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed';
  showResults?: boolean;
}

const statusBadgeMap: Record<string, string> = {
  active: 'badge-success',
  draft: 'badge-warning',
  completed: 'badge-danger',
};

const statusLabelMap: Record<string, string> = {
  active: 'Active',
  draft: 'Upcoming',
  completed: 'Closed',
};

export default function AdminElectionsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formType, setFormType] = useState('src');
  const [formDepartment, setFormDepartment] = useState('');
  const [formShowResults, setFormShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [isEditTimeModalOpen, setIsEditTimeModalOpen] = useState(false);
  const [editElectionId, setEditElectionId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editingTime, setEditingTime] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    async function fetchElections() {
      try {
        const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
        if (res.status === 'success') setElections(res.data);
      } catch (err) {
        console.error('Error fetching elections:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchElections();

    // One-time migration: fix existing elections with generic descriptions
    apiRequest('/elections/migrate-descriptions', 'POST')
      .then((r: any) => console.log('[Migration]', r?.message))
      .catch(() => {}); // silent — non-critical
  }, []);

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const deptLabel = formDepartment.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const typeLabel = formType === 'src' ? 'SRC Election' : `${deptLabel} Departmental Election`;
      const dateLabel = formStartDate ? new Date(formStartDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString();
      const generatedTitle = `${typeLabel} (${dateLabel})`;

      // Type-specific description
      const generatedDesc = formType === 'src'
        ? `This is the Student Representative Council (SRC) election scheduled for ${dateLabel}. Eligible students are invited to vote for their preferred candidates across all SRC positions.`
        : `This is the ${deptLabel} Departmental election scheduled for ${dateLabel}. Students in the ${deptLabel} department are invited to elect their departmental representatives.`;

      console.log('[Create Election] Submitting auto-generated form data:', {
        title: generatedTitle,
        description: generatedDesc,
        startDate: formStartDate,
        endDate: formEndDate,
        type: formType,
        department: formType === 'departmental' ? formDepartment : '',
        showResults: formShowResults,
      });
      
      const res = await apiRequest<{ status: string; data: Election }>('/elections', 'POST', {
        title: generatedTitle,
        description: generatedDesc,
        startDate: formStartDate,
        endDate: formEndDate,
        type: formType,
        department: formType === 'departmental' ? formDepartment : '',
        showResults: formShowResults,
      });
      
      console.log('[Create Election] Response:', res);
      
      if (res.status === 'success') {
        setElections(prev => [...prev, res.data]);
        setIsModalOpen(false);
        setFormStartDate(''); setFormEndDate(''); setFormType('src'); setFormDepartment(''); setFormShowResults(false);
        alert('Election created successfully!');
      } else {
        alert('Failed to create election: ' + (res as any).message || 'Unknown error');
      }
    } catch (err: any) {
      console.error('[Create Election] Error:', err);
      alert('Failed to create election: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleResults = async (elId: string, newShowResults: boolean) => {
    try {
      await apiRequest(`/elections/${elId}/toggle-results`, 'PATCH', { showResults: newShowResults });
      setElections(prev => prev.map(el => el.id === elId ? { ...el, showResults: newShowResults } : el));
    } catch (err: any) {
      console.error('Error toggling results visibility:', err);
      alert('Failed to update results visibility: ' + err.message);
    }
  };

  const handleChangeStatus = async (elId: string, newStatus: string) => {
    try {
      await apiRequest(`/elections/${elId}/status`, 'PATCH', { status: newStatus });
      setElections(prev => prev.map(el => el.id === elId ? { ...el, status: newStatus as any } : el));
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDeleteElection = async (elId: string) => {
    if (!confirm('Are you sure you want to delete this election?')) return;
    try {
      await apiRequest(`/elections/${elId}`, 'DELETE');
      setElections(prev => prev.filter(el => el.id !== elId));
    } catch (err) {
      console.error('Error deleting election:', err);
    }
  };

  const handleDownloadReport = async (elId: string, elTitle: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/elections/${elId}/report/pdf`, {
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Report download failed:', response.status, errorText);
        throw new Error('Failed to download report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${elTitle.replace(/[^a-zA-Z0-9]/g, '_')}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error downloading report:', err);
      alert('Failed to download report: ' + err.message);
    }
  };

  const openEditTimeModal = (el: Election) => {
    setEditElectionId(el.id);
    setEditStartDate(el.startDate);
    setEditEndDate(el.endDate);
    setIsEditTimeModalOpen(true);
  };

  const handleEditTimeWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editElectionId) return;
    setEditingTime(true);
    try {
      const res = await apiRequest<{ status: string }>(`/elections/${editElectionId}/time-window`, 'PATCH', {
        startDate: editStartDate,
        endDate: editEndDate,
      });
      if (res.status === 'success') {
        setElections(prev => prev.map(el => 
          el.id === editElectionId ? { ...el, startDate: editStartDate, endDate: editEndDate } : el
        ));
        setIsEditTimeModalOpen(false);
        alert('Election time window updated successfully!');
      } else {
        alert('Failed to update time window: ' + (res as any).message || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error updating time window:', err);
      alert('Failed to update time window: ' + err.message);
    } finally {
      setEditingTime(false);
    }
  };

  return (
    <div className="animate-page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <Link href="/admin/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={14} /> Return to Dashboard
          </Link>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>Manage Elections</h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Create, configure, and monitor all election instances</span>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> Create New Election
        </button>
      </div>

      {/* Elections List */}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading elections registry...</p>
      ) : elections.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={48} style={{ color: 'var(--text-tertiary)' }} />
          <h3>No Elections Configured</h3>
          <p>Get started by creating your first election instance above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {elections.map(el => (
            <div className="card card-hover" key={el.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                  <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{el.title}</h4>
                  <span className={`badge ${statusBadgeMap[el.status] || 'badge-info'}`}>
                    {statusLabelMap[el.status] || el.status}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>{el.description}</p>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {new Date(el.startDate).toLocaleDateString()} → {new Date(el.endDate).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-sm ${el.showResults ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => handleToggleResults(el.id, !el.showResults)}
                  style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {el.showResults ? 'Results: Public' : 'Results: Hidden'}
                </button>
                {el.status === 'draft' && (
                  <button className="btn btn-success btn-sm" onClick={() => handleChangeStatus(el.id, 'active')} style={{ fontSize: 'var(--text-xs)' }}>
                    <Activity size={12} /> Activate
                  </button>
                )}
                {el.status === 'active' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleChangeStatus(el.id, 'completed')} style={{ fontSize: 'var(--text-xs)' }}>
                    Close Election
                  </button>
                )}
                {el.status === 'completed' && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleDownloadReport(el.id, el.title)} style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Download size={12} /> Download Report
                  </button>
                )}
                <Link href={`/admin/elections/${el.id}/candidates`} className="btn btn-outline btn-sm" style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Settings size={12} /> Manage Candidates
                </Link>
                <button className="btn btn-outline btn-sm" onClick={() => openEditTimeModal(el)} style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Edit Time
                </button>
                <Link href={`/admin/results`} className="btn btn-primary btn-sm" style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={12} /> View Results
                </Link>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteElection(el.id)} style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trash size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Election Modal — mounted via portal to escape overflow:hidden on app-shell */}
      {mounted && isModalOpen && createPortal(
        <div
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            // pad top below the topbar (64px) + gap, pad bottom above bottom-nav (68px) + gap
            padding: '80px 16px 88px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            className="modal-container"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '560px', maxHeight: 'calc(100dvh - 180px)' }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Create New Election</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateElection} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="el-type">Election Type</label>
                  <select id="el-type" className="form-input" value={formType} onChange={e => setFormType(e.target.value)}>
                    <option value="src">SRC / University Wide</option>
                    <option value="departmental">Departmental</option>
                  </select>
                </div>
                {formType === 'departmental' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="el-dept">Department</label>
                    <select id="el-dept" className="form-input" required value={formDepartment} onChange={e => setFormDepartment(e.target.value)}>
                      <option value="">Select a Department</option>
                      <option value="computer_science">Computer Science</option>
                      <option value="engineering">Engineering</option>
                      <option value="business_administration">Business Administration</option>
                     
                     
                    </select>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="el-start">Start Date</label>
                    <input type="datetime-local" id="el-start" className="form-input" required value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="el-end">End Date</label>
                    <input type="datetime-local" id="el-end" className="form-input" required value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Election'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {mounted && isEditTimeModalOpen && createPortal(
        <div
          onClick={() => setIsEditTimeModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '80px 16px 88px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            className="modal-container"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '400px', maxHeight: 'calc(100dvh - 180px)' }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Edit Election Time Window</h3>
              <button className="modal-close" onClick={() => setIsEditTimeModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleEditTimeWindow} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-start">Start Date</label>
                  <input type="datetime-local" id="edit-start" className="form-input" required value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-end">End Date</label>
                  <input type="datetime-local" id="edit-end" className="form-input" required value={editEndDate} onChange={e => setEditEndDate(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditTimeModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editingTime}>
                  {editingTime ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
