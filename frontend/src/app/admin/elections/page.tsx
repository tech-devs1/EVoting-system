'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { Plus, FolderOpen, Settings, Activity, Trash, ArrowLeft, Download } from 'lucide-react';

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
  }, []);

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const typeLabel = formType === 'src' ? 'SRC Election' : `${formDepartment.replace('_', ' ').toUpperCase()} Departmental Election`;
      const dateLabel = formStartDate ? new Date(formStartDate).toLocaleDateString() : new Date().toLocaleDateString();
      const generatedTitle = `${typeLabel} (${dateLabel})`;
      const generatedDesc = `Automated ${typeLabel} scheduled for ${dateLabel}.`;

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
                      <option value="nursing">Nursing</option>
                      <option value="arts">Arts and Humanities</option>
                      <option value="applied_sciences">Applied Sciences</option>
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
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-4)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    id="el-show-results"
                    checked={formShowResults}
                    onChange={e => setFormShowResults(e.target.checked)}
                    style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                  />
                  <label htmlFor="el-show-results" style={{ margin: 0, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--weight-semibold)' }}>
                    Allow voters to see live results/charts
                  </label>
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
    </div>
  );
}
