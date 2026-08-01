'use client';

import React, { useState, useEffect } from 'react';
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
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-primary)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-6)' }}>Provision New Department</h2>
            
            {error && (
              <div style={{
                padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444',
                borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--text-sm)',
                display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #EF444444'
              }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>Department Name</label>
                <input 
                  type="text" className="form-input" required 
                  placeholder="e.g. Computer Science Department"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>Sub-Domain / Identifier (Optional)</label>
                <input 
                  type="text" className="form-input" 
                  placeholder="e.g. cs.htu.edu.gh"
                  value={formData.domain} onChange={e => setFormData({...formData, domain: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>Admin Login Email</label>
                <input 
                  type="email" className="form-input" required 
                  placeholder="admin@cs.htu.edu.gh"
                  value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>Admin Initial Password</label>
                <input 
                  type="password" className="form-input" required 
                  placeholder="Enter secure password"
                  value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
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
