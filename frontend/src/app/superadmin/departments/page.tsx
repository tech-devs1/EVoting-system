'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import { Building2, Plus, AlertCircle, MoreVertical, Shield } from 'lucide-react';

export default function SuperAdminDepartments() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', domain: '', adminEmail: '', adminPassword: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; data: any[] }>('/superadmin/departments');
      if (res.status === 'success') {
        setDepartments(res.data);
      }
    } catch (err) {
      console.error('Failed to load departments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFormLoading(true);
    try {
      const res = await apiRequest<{ status: string; message?: string }>('/superadmin/departments', 'POST', formData);
      if (res.status === 'success') {
        setShowModal(false);
        setFormData({ name: '', domain: '', adminEmail: '', adminPassword: '' });
        fetchDepartments();
      } else {
        throw new Error(res.message || 'Failed to create department');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="animate-page-enter">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>Manage Departments</h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Provision and monitor isolated VaaS tenants.</span>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} />
          Provision Department
        </button>
      </header>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading departments registry...</p>
      ) : (
        <div className="card" style={{ padding: 'var(--space-6)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', flexGrow: 1, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Department Name</th>
                  <th style={{ padding: '12px' }}>Tenant ID</th>
                  <th style={{ padding: '12px' }}>Admin Login (Email)</th>
                  <th style={{ padding: '12px' }}>Stats</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, idx) => (
                  <tr key={dept.id} style={{ borderBottom: idx < departments.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                          background: dept.id === 'default_tenant' ? 'var(--color-primary-100)' : 'var(--bg-secondary)',
                          color: dept.id === 'default_tenant' ? 'var(--color-primary)' : 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {dept.id === 'default_tenant' ? <Shield size={20} /> : <Building2 size={20} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dept.name}</div>
                          {dept.domain && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{dept.domain}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}><code style={{ fontSize: '12px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>{dept.id}</code></td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{dept.adminEmail}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        <div><strong style={{color: 'var(--text-primary)'}}>{dept.electionsCount}</strong> Elections</div>
                        <div><strong style={{color: 'var(--text-primary)'}}>{dept.votersCount}</strong> Voters</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`badge ${dept.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {dept.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button 
                        className="btn btn-outline btn-sm" 
                        style={{ padding: '6px' }} 
                        disabled={dept.id === 'default_tenant'}
                        title={dept.id === 'default_tenant' ? "Default tenant cannot be managed here" : "Manage"}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>
                      No departments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provision Modal */}
      {showModal && typeof window !== 'undefined' && createPortal(
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '80px 16px 88px 16px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.5)'
          }}
        >
          <div 
            className="modal-container" 
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '560px', maxHeight: 'calc(100dvh - 180px)' }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Provision New Department</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                {error && (
                  <div style={{
                    padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444',
                    borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--text-sm)',
                    display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #EF444444'
                  }}>
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Department Name</label>
                  <input 
                    type="text" className="form-input" required 
                    placeholder="e.g. Computer Science Department"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sub-Domain / Identifier (Optional)</label>
                  <input 
                    type="text" className="form-input" 
                    placeholder="e.g. cs.htu.edu.gh"
                    value={formData.domain} onChange={e => setFormData({...formData, domain: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Admin Login Email</label>
                  <input 
                    type="email" className="form-input" required 
                    placeholder="admin@cs.htu.edu.gh"
                    value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Admin Initial Password</label>
                  <input 
                    type="password" className="form-input" required 
                    placeholder="Enter secure password"
                    value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" disabled={formLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Provisioning...' : 'Provision Tenant'}
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
