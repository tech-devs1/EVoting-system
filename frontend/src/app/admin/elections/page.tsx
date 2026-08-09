'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { Plus, FolderOpen, Settings, Activity, Trash, ArrowLeft, Download, Clock, RefreshCw, Send, Radio, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

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
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
      Redirecting to Organization Election Hub...
    </div>
  );
}

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
    setEditElectionStatus(el.status);
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
        const now = Date.now();
        const newEndTime = new Date(editEndDate).getTime();
        setElections(prev => prev.map(el => {
          if (el.id === editElectionId) {
            let newStatus = el.status;
            // Mirror backend logic: if it was completed and end time is pushed to future, it becomes active
            if (newStatus === 'completed' && newEndTime > now) {
              newStatus = 'active' as any;
            }
            return { ...el, startDate: editStartDate, endDate: editEndDate, status: newStatus };
          }
          return el;
        }));
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

  const openReactivateModal = (el: Election) => {
    setReactivateElectionId(el.id);
    setReactivateElectionTitle(el.title);
    // Default new end date = 24 hours from now
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setReactivateEndDate(tomorrow.toISOString().slice(0, 16));
    setIsReactivateModalOpen(true);
  };

  const handleReactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactivateElectionId) return;
    setReactivating(true);
    try {
      const res = await apiRequest<{ status: string }>(`/elections/${reactivateElectionId}/reactivate`, 'PATCH', {
        endDate: reactivateEndDate,
      });
      if (res.status === 'success') {
        setElections(prev => prev.map(el =>
          el.id === reactivateElectionId ? { ...el, status: 'active' as any, endDate: reactivateEndDate } : el
        ));
        setIsReactivateModalOpen(false);
        alert('Election reactivated successfully! Voting is now open again.');
      } else {
        alert('Failed to reactivate: ' + (res as any).message || 'Unknown error');
      }
    } catch (err: any) {
      alert('Failed to reactivate election: ' + err.message);
    } finally {
      setReactivating(false);
    }
  };

  // CSV Pre-Validation & Roster Upload Handlers
  const handleOpenCsvModal = (el: Election) => {
    setTargetElectionForCsv(el);
    setCsvFile(null);
    setCsvRawText('');
    setCsvStats({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
    setCsvPreviewRows([]);
    setIsCsvModalOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvRawText(text);

      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      let total = 0;
      let valid = 0;
      let duplicates = 0;
      let invalid = 0;

      const seenEmails = new Set<string>();
      const preview: Array<{ email: string; name: string; valid: boolean; reason?: string }> = [];

      lines.forEach((line, index) => {
        // Skip header if line 1 has 'email'
        if (index === 0 && line.toLowerCase().includes('email')) return;

        total++;
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        const email = parts[0] || '';
        const name = parts[1] || 'Voter';

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          invalid++;
          preview.push({ email, name, valid: false, reason: 'Invalid Email Format' });
        } else if (seenEmails.has(email.toLowerCase())) {
          duplicates++;
          preview.push({ email, name, valid: false, reason: 'Duplicate Email' });
        } else {
          valid++;
          seenEmails.add(email.toLowerCase());
          preview.push({ email, name, valid: true });
        }
      });

      setCsvStats({ total, valid, duplicates, invalid });
      setCsvPreviewRows(preview);
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvUpload = async () => {
    if (!targetElectionForCsv || !csvRawText) return;
    setCsvUploading(true);
    try {
      const res = await apiRequest<{ status: string; count?: number; message?: string }>(
        `/elections/${targetElectionForCsv.id}/voters/upload-csv`,
        'POST',
        { csvText: csvRawText }
      );
      if (res.status === 'success') {
        alert(`✅ Roster uploaded successfully! ${res.count || csvStats.valid} eligible voters registered for "${targetElectionForCsv.title}".`);
        setIsCsvModalOpen(false);
      } else {
        alert('Failed to upload roster: ' + (res.message || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error uploading roster: ' + err.message);
    } finally {
      setCsvUploading(false);
    }
  };

  const handleSendInvitations = async (el: Election) => {
    if (!confirm(`Send voting invitation emails to all roster voters for "${el.title}"?`)) return;
    try {
      const res = await apiRequest<{ status: string; message?: string; data?: { invitationsSent: number } }>(
        `/elections/${el.id}/send-invitations`,
        'POST'
      );
      if (res.status === 'success') {
        alert(`📧 Voting invitations dispatched to ${res.data?.invitationsSent || 0} roster voters!`);
      } else {
        alert('Failed to send invitations: ' + (res.message || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error sending invitations: ' + err.message);
    }
  };

  const handleBroadcastResults = async (el: Election) => {
    if (!confirm(`Are you sure you want to CLOSE voting and broadcast the final results for "${el.title}" to all roster voters?`)) return;
    try {
      const res = await apiRequest<{ status: string; message?: string; data?: { recipientCount: number } }>(
        `/elections/${el.id}/broadcast-results`,
        'POST'
      );
      if (res.status === 'success') {
        setElections(prev => prev.map(item => item.id === el.id ? { ...item, status: 'completed' } : item));
        alert(`🎉 Election closed and final results broadcast dispatched to ${res.data?.recipientCount || 0} roster voters!`);
      } else {
        alert('Failed to broadcast results: ' + (res.message || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error broadcasting results: ' + err.message);
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
                  className="btn btn-outline btn-sm"
                  onClick={() => handleOpenCsvModal(el)}
                  style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <FileSpreadsheet size={12} /> Upload Voter CSV
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleSendInvitations(el)}
                  style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Send size={12} /> Send Invitations
                </button>
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
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => handleBroadcastResults(el)} style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Radio size={12} /> Broadcast Results & End
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleChangeStatus(el.id, 'completed')} style={{ fontSize: 'var(--text-xs)' }}>
                      Close Election
                    </button>
                  </>
                )}
                {el.status === 'completed' && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => handleDownloadReport(el.id, el.title)} style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={12} /> Download Report
                    </button>
                    <button className="btn btn-success btn-sm" onClick={() => openReactivateModal(el)} style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RefreshCw size={12} /> Reactivate
                    </button>
                  </>
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
                {editElectionStatus === 'active' && (
                  <div style={{
                    padding: '10px 14px',
                    marginBottom: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    fontSize: 'var(--text-sm)',
                    color: '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>⚠️</span>
                    <span>Election is <strong>active</strong>. You may only extend the end time — the start time and reducing end time are locked.</span>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-start">Start Date</label>
                  <input
                    type="datetime-local"
                    id="edit-start"
                    className="form-input"
                    required
                    value={editStartDate}
                    onChange={e => setEditStartDate(e.target.value)}
                    disabled={editElectionStatus === 'active'}
                    style={editElectionStatus === 'active' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-end">End Date {editElectionStatus === 'active' && <span style={{ color: '#F59E0B', fontWeight: 600 }}>(Extend only)</span>}</label>
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

      {/* Reactivate Election Modal */}
      {mounted && isReactivateModalOpen && createPortal(
        <div
          onClick={() => setIsReactivateModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '80px 16px 88px 16px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="modal-container"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '440px', maxHeight: 'calc(100dvh - 180px)' }}
          >
            <div className="modal-header">
              <h3 className="modal-title">🔄 Reactivate Election</h3>
              <button className="modal-close" onClick={() => setIsReactivateModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleReactivate} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                {/* Info Banner */}
                <div style={{
                  padding: '10px 14px',
                  marginBottom: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  fontSize: 'var(--text-sm)',
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <span>✅</span>
                  <span>
                    <strong>Safe Reactivation:</strong> All existing votes, candidates, and results are preserved.
                    The election will reopen <strong>immediately</strong> (start time set to now) until your new end date.
                  </span>
                </div>

                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Reactivating: <strong style={{ color: 'var(--text-primary)' }}>{reactivateElectionTitle}</strong>
                </p>

                <div className="form-group">
                  <label className="form-label" htmlFor="reactivate-end">
                    New End Date <span style={{ color: '#EF4444', fontSize: '12px' }}>(must be in the future)</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="reactivate-end"
                    className="form-input"
                    required
                    value={reactivateEndDate}
                    onChange={e => setReactivateEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsReactivateModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={reactivating} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={14} />
                  {reactivating ? 'Reactivating...' : 'Reactivate Election'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* CSV Roster Pre-Validation & Preview Modal */}
      {mounted && isCsvModalOpen && targetElectionForCsv && createPortal(
        <div
          onClick={() => setIsCsvModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '40px 16px 40px 16px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.6)',
          }}
        >
          <div
            className="modal-container"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '650px', maxHeight: 'calc(100dvh - 80px)' }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} style={{ color: 'var(--color-primary)' }} />
                Roster CSV Pre-Validation & Import
              </h3>
              <button className="modal-close" onClick={() => setIsCsvModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                Target Election: <strong style={{ color: 'var(--text-primary)' }}>{targetElectionForCsv.title}</strong>
              </p>

              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-5)',
                textAlign: 'center',
                backgroundColor: 'var(--bg-secondary)',
                cursor: 'pointer',
                marginBottom: 'var(--space-4)'
              }} onClick={() => fileInputRef.current?.click()}>
                <Upload size={32} style={{ color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }} />
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  {csvFile ? csvFile.name : 'Click to select CSV File (email, name)'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Format: <code>email, name</code> per line
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </div>

              {/* Live Validation Summary */}
              {csvFile && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Rows</div>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>{csvStats.total}</div>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: '#10B981' }}>
                      <div style={{ fontSize: '11px' }}>Valid Emails</div>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>{csvStats.valid}</div>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '10px', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: '#F59E0B' }}>
                      <div style={{ fontSize: '11px' }}>Duplicates</div>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>{csvStats.duplicates}</div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: '#EF4444' }}>
                      <div style={{ fontSize: '11px' }}>Invalid Format</div>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>{csvStats.invalid}</div>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Previewing First 10 Rows
                  </h4>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 10px' }}>Email</th>
                          <th style={{ padding: '6px 10px' }}>Name</th>
                          <th style={{ padding: '6px 10px' }}>Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreviewRows.slice(0, 10).map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: row.valid ? 'transparent' : 'rgba(239, 68, 68, 0.05)' }}>
                            <td style={{ padding: '6px 10px' }}><code>{row.email}</code></td>
                            <td style={{ padding: '6px 10px' }}>{row.name}</td>
                            <td style={{ padding: '6px 10px' }}>
                              {row.valid ? (
                                <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                  <CheckCircle2 size={12} /> Valid
                                </span>
                              ) : (
                                <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                  <AlertTriangle size={12} /> {row.reason}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsCsvModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!csvFile || csvStats.valid === 0 || csvUploading}
                onClick={handleConfirmCsvUpload}
              >
                {csvUploading ? 'Uploading Roster...' : `Confirm & Import ${csvStats.valid} Voters`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
