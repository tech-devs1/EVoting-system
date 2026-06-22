'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { Plus, FolderOpen, Settings, Activity, Trash } from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed';
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
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formType, setFormType] = useState('src');
  const [formDepartment, setFormDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      const res = await apiRequest<{ status: string; data: Election }>('/elections', 'POST', {
        title: formTitle,
        description: formDescription,
        startDate: formStartDate,
        endDate: formEndDate,
        type: formType,
        department: formType === 'departmental' ? formDepartment : '',
      });
      if (res.status === 'success') {
        setElections(prev => [...prev, res.data]);
        setIsModalOpen(false);
        setFormTitle(''); setFormDescription(''); setFormStartDate(''); setFormEndDate(''); setFormType('src'); setFormDepartment('');
      }
    } catch (err) {
      console.error('Error creating election:', err);
    } finally {
      setSubmitting(false);
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

  return (
    <div className="animate-page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
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
                <Link href={`/admin/elections/${el.id}/candidates`} className="btn btn-outline btn-sm" style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Settings size={12} /> Manage Candidates
                </Link>
                <Link href={`/admin/results`} className="btn btn-primary btn-sm" style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={12} /> View Results
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Election Modal */}
      {isModalOpen && (
        <div className="modal-overlay active" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Election</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateElection}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="el-title">Election Title</label>
                  <input type="text" id="el-title" className="form-input" placeholder="e.g. Student Council Presidential Election" required value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="el-desc">Description</label>
                  <textarea id="el-desc" className="form-input" placeholder="Describe the purpose of this election..." style={{ minHeight: '80px' }} value={formDescription} onChange={e => setFormDescription(e.target.value)} />
                </div>
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Election'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
