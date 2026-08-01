'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Building2, Plus, AlertCircle, CheckCircle2, MoreVertical, Shield } from 'lucide-react';

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
    <div className="animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Manage Departments</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Provision and monitor isolated VaaS tenants.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary hover-lift">
          <Plus size={18} style={{ marginRight: '8px' }} />
          Provision Department
        </button>
      </header>

      {loading ? (
        <div className="spinner" style={{ margin: '50px auto' }}></div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Department Name</th>
                  <th>Tenant ID</th>
                  <th>Admin Login (Email)</th>
                  <th>Stats</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                          background: dept.id === 'default_tenant' ? 'var(--color-primary-100)' : 'var(--bg-input)',
                          color: dept.id === 'default_tenant' ? 'var(--color-primary)' : 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {dept.id === 'default_tenant' ? <Shield size={20} /> : <Building2 size={20} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dept.name}</div>
                          {dept.domain && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{dept.domain}</div>}
                        </div>
                      </div>
                    </td>
                    <td><code style={{ fontSize: '0.8rem', background: 'var(--bg-base)', padding: '2px 6px', borderRadius: '4px' }}>{dept.id}</code></td>
                    <td>{dept.adminEmail}</td>
                    <td>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        <div><strong style={{color: 'var(--text-primary)'}}>{dept.electionsCount}</strong> Elections</div>
                        <div><strong style={{color: 'var(--text-primary)'}}>{dept.votersCount}</strong> Voters</div>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${dept.status === 'active' ? 'active' : 'draft'}`}>
                        {dept.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline" style={{ padding: '6px' }} disabled={dept.id === 'default_tenant'}>
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
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
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4)'
        }}>
          <div className="glass-card-strong animate-scale-in" style={{ width: '100%', maxWidth: '500px' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-6)' }}>Provision New Department</h2>
            
            {error && (
              <div style={{
                padding: '12px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--text-sm)',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleCreate}>
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
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'var(--space-6)' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline" disabled={formLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Provisioning...' : 'Provision Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
