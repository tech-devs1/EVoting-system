'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import { Building2, Plus, AlertCircle, Shield, MoreVertical, Pencil, KeyRound, Trash2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  domain: string;
  adminEmail: string;
  status: string;
  electionsCount: number;
  votersCount: number;
}

type ModalType = 'create' | 'edit' | 'password' | 'delete' | null;

export default function SuperAdminDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Active dropdown
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(null);

  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({ name: '', domain: '', adminEmail: '', adminPassword: '' });

  // Edit name form
  const [editName, setEditName] = useState('');

  // Change password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setMenuCoords(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; data: Department[] }>('/superadmin/departments');
      if (res.status === 'success') setDepartments(res.data);
    } catch (err) {
      console.error('Failed to load departments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDepartments(); }, []);

  const openModal = (type: ModalType, dept?: Department) => {
    setError('');
    setOpenMenuId(null);
    setMenuCoords(null);
    setSelectedDept(dept || null);
    if (type === 'edit' && dept) setEditName(dept.name);
    if (type === 'password') { setNewPassword(''); setConfirmPassword(''); }
    if (type === 'create') setCreateForm({ name: '', domain: '', adminEmail: '', adminPassword: '' });
    setModalType(type);
  };

  const closeModal = () => { setModalType(null); setSelectedDept(null); setError(''); setMenuCoords(null); };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFormLoading(true);
    try {
      const res = await apiRequest<{ status: string; message?: string }>('/superadmin/departments', 'POST', createForm);
      if (res.status === 'success') { closeModal(); fetchDepartments(); }
      else throw new Error(res.message || 'Failed to create department');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;
    setError('');
    setFormLoading(true);
    try {
      const res = await apiRequest<{ status: string; message?: string }>(`/superadmin/departments/${selectedDept.id}`, 'PATCH', { name: editName });
      if (res.status === 'success') { closeModal(); fetchDepartments(); }
      else throw new Error(res.message || 'Failed to update department');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setFormLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setFormLoading(true);
    try {
      const res = await apiRequest<{ status: string; message?: string }>(`/superadmin/departments/${selectedDept.id}`, 'PATCH', { adminPassword: newPassword });
      if (res.status === 'success') { closeModal(); }
      else throw new Error(res.message || 'Failed to update password');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDept) return;
    setError('');
    setFormLoading(true);
    try {
      const res = await apiRequest<{ status: string; message?: string }>(`/superadmin/departments/${selectedDept.id}`, 'DELETE');
      if (res.status === 'success') { closeModal(); fetchDepartments(); }
      else throw new Error(res.message || 'Failed to delete department');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Shared Modal Shell ────────────────────────────────────────────────────
  const renderModal = (title: string, onSubmit: (e: React.FormEvent) => void, children: React.ReactNode, submitLabel: string, submitClass = 'btn-primary', isDelete = false) =>
    mounted && createPortal(
      <div
        onClick={closeModal}
        style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 88px 16px', overflowY: 'auto', background: 'rgba(0,0,0,0.5)' }}
      >
        <div className="modal-container" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px', maxHeight: 'calc(100dvh - 180px)' }}>
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button className="modal-close" onClick={closeModal}>&times;</button>
          </div>
          <form onSubmit={isDelete ? (e) => { e.preventDefault(); handleDelete(); } : onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="modal-body">
              {error && (
                <div style={{ padding: '12px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #EF444444' }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              {children}
            </div>
            <div className="modal-footer">
              <button type="button" onClick={closeModal} className="btn btn-secondary" disabled={formLoading}>Cancel</button>
              <button type="submit" className={`btn ${submitClass}`} disabled={formLoading}>
                {formLoading ? 'Working...' : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="animate-page-enter">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>Manage Departments</h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Provision and monitor isolated VaaS tenants.</span>
        </div>
        <button onClick={() => openModal('create')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> Provision Department
        </button>
      </header>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading departments registry...</p>
      ) : (
        <div className="card" style={{ padding: 'var(--space-6)', overflow: 'visible' }}>
          <div style={{ overflowX: 'auto', flexGrow: 1, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Department Name</th>
                  <th style={{ padding: '12px' }}>Tenant ID</th>
                  <th style={{ padding: '12px' }}>Admin Email</th>
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
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{dept.name}</div>
                          {dept.domain && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{dept.domain}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}><code style={{ fontSize: '12px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>{dept.id}</code></td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{dept.adminEmail}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        <div><strong style={{ color: 'var(--text-primary)' }}>{dept.electionsCount}</strong> Elections</div>
                        <div><strong style={{ color: 'var(--text-primary)' }}>{dept.votersCount}</strong> Voters</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`badge ${dept.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {dept.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-block' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: '6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId === dept.id) {
                              setOpenMenuId(null);
                              setMenuCoords(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setOpenMenuId(dept.id);
                              setSelectedDept(dept);
                              setMenuCoords({
                                x: rect.right + window.scrollX,
                                y: rect.bottom + window.scrollY
                              });
                            }
                          }}
                          aria-label="Department actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>No departments found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create Modal ── */}
      {modalType === 'create' && renderModal(
        'Provision New Department',
        handleCreate,
        <>
          <div className="form-group">
            <label className="form-label">Department Name</label>
            <input type="text" className="form-input" required placeholder="e.g. Computer Science Department" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Sub-Domain / Identifier (Optional)</label>
            <input type="text" className="form-input" placeholder="e.g. cs.htu.edu.gh" value={createForm.domain} onChange={e => setCreateForm({ ...createForm, domain: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Admin Login Email</label>
            <input type="email" className="form-input" required placeholder="admin@cs.htu.edu.gh" value={createForm.adminEmail} onChange={e => setCreateForm({ ...createForm, adminEmail: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Admin Initial Password</label>
            <input type="password" className="form-input" required placeholder="Enter secure password" value={createForm.adminPassword} onChange={e => setCreateForm({ ...createForm, adminPassword: e.target.value })} />
          </div>
        </>,
        'Provision Tenant'
      )}

      {/* ── Edit Name Modal ── */}
      {modalType === 'edit' && selectedDept && renderModal(
        `Rename "${selectedDept.name}"`,
        handleEditName,
        <div className="form-group">
          <label className="form-label">New Department Name</label>
          <input type="text" className="form-input" required placeholder="Enter new name" value={editName} onChange={e => setEditName(e.target.value)} />
        </div>,
        'Save Changes'
      )}

      {/* ── Change Password Modal ── */}
      {modalType === 'password' && selectedDept && renderModal(
        `Change Admin Password — ${selectedDept.name}`,
        handleChangePassword,
        <>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            Setting a new password for <strong>{selectedDept.adminEmail}</strong>.
          </p>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input type="password" className="form-input" required placeholder="Enter new password (min 6 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input type="password" className="form-input" required placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
        </>,
        'Update Password'
      )}

      {/* ── Delete Confirm Modal ── */}
      {modalType === 'delete' && selectedDept && renderModal(
        `Delete "${selectedDept.name}"?`,
        handleDelete,
        <div>
          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            This will permanently delete <strong style={{ color: 'var(--text-primary)' }}>{selectedDept.name}</strong> and all its associated elections, candidates, and voter rolls. This action <strong style={{ color: '#EF4444' }}>cannot be undone</strong>.
          </p>
          <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid #EF444433', fontSize: 'var(--text-xs)', color: '#EF4444' }}>
            ⚠ All data under <code>{selectedDept.id}</code> will be permanently erased.
          </div>
        </div>,
        'Delete Department',
        'btn-danger',
        true
      )}
      {/* ── Dropdown Portal ── */}
      {openMenuId && menuCoords && selectedDept && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            left: `${menuCoords.x - 200}px`,
            top: `${menuCoords.y + 4}px`,
            zIndex: 9999,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            minWidth: '200px',
            overflow: 'hidden'
          }}
        >
          <button
            onClick={() => openModal('edit', selectedDept)}
            style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Pencil size={15} style={{ color: 'var(--color-primary)' }} /> Rename Department
          </button>
          <button
            onClick={() => openModal('password', selectedDept)}
            style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <KeyRound size={15} style={{ color: 'var(--color-warning)' }} /> Change Admin Password
          </button>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
          <button
            onClick={() => openModal('delete', selectedDept)}
            style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: '#EF4444', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Trash2 size={15} /> Delete Department
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
