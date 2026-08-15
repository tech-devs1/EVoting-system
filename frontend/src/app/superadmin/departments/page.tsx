'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Building2, Plus, AlertCircle, Shield, MoreVertical, Pencil, KeyRound, Trash2, Users, UserPlus, X, ExternalLink, Lock, Mail } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  domain: string;
  adminEmail: string;
  status: string;
  electionsCount: number;
  votersCount: number;
  adminsCount?: number;
}

interface DeptAdmin {
  id: string;
  name: string;
  email: string;
  isPrimary: boolean;
  createdAt?: number | null;
}

type ModalType = 'create' | 'edit' | 'password' | 'delete' | 'admins' | null;

export default function SuperAdminDepartments() {
  const router = useRouter();
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
  const [createForm, setCreateForm] = useState({ name: '', adminEmail: '', adminPassword: '' });

  // Edit name form
  const [editName, setEditName] = useState('');

  // Change password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  // Admin management state
  const [deptAdmins, setDeptAdmins] = useState<DeptAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [addAdminForm, setAddAdminForm] = useState({ name: '', email: '', password: '' });
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [editAdminForm, setEditAdminForm] = useState({ name: '', password: '' });

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
    if (type === 'create') setCreateForm({ name: '', adminEmail: '', adminPassword: '' });
    if (type === 'admins' && dept) fetchAdmins(dept.id);
    setModalType(type);
  };

  const closeModal = () => { setModalType(null); setSelectedDept(null); setError(''); setMenuCoords(null); setShowAddAdmin(false); setEditingAdminId(null); setAddAdminForm({ name: '', email: '', password: '' }); };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFormLoading(true);
    try {
      const res = await apiRequest<{ status: string; message?: string }>('/superadmin/departments', 'POST', createForm);
      if (res.status === 'success') { closeModal(); fetchDepartments(); }
      else throw new Error(res.message || 'Failed to onboard organization');
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

  // ── Admin Management Handlers ─────────────────────────────────────────────
  const fetchAdmins = async (tenantId: string) => {
    setAdminsLoading(true);
    try {
      const res = await apiRequest<{ status: string; data: DeptAdmin[] }>(`/superadmin/departments/${tenantId}/admins`);
      if (res.status === 'success') setDeptAdmins(res.data);
    } catch (err) { console.error('Failed to load admins', err); }
    finally { setAdminsLoading(false); }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;
    setError('');
    setFormLoading(true);
    try {
      const res = await apiRequest<{ status: string; message?: string }>(`/superadmin/departments/${selectedDept.id}/admins`, 'POST', addAdminForm);
      if (res.status === 'success') {
        setShowAddAdmin(false);
        setAddAdminForm({ name: '', email: '', password: '' });
        fetchAdmins(selectedDept.id);
        fetchDepartments();
      } else throw new Error(res.message || 'Failed to add admin');
    } catch (err: any) { setError(err.message || 'An error occurred'); }
    finally { setFormLoading(false); }
  };

  const handleEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !editingAdminId) return;
    setError('');
    setFormLoading(true);
    try {
      const body: any = {};
      if (editAdminForm.name.trim()) body.name = editAdminForm.name.trim();
      if (editAdminForm.password.trim()) body.password = editAdminForm.password.trim();
      const res = await apiRequest<{ status: string; message?: string }>(`/superadmin/departments/${selectedDept.id}/admins/${editingAdminId}`, 'PATCH', body);
      if (res.status === 'success') {
        setEditingAdminId(null);
        setEditAdminForm({ name: '', password: '' });
        fetchAdmins(selectedDept.id);
      } else throw new Error(res.message || 'Failed to update admin');
    } catch (err: any) { setError(err.message || 'An error occurred'); }
    finally { setFormLoading(false); }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (!selectedDept) return;
    if (!confirm('Are you sure you want to remove this admin?')) return;
    setError('');
    try {
      const res = await apiRequest<{ status: string; message?: string }>(`/superadmin/departments/${selectedDept.id}/admins/${adminId}`, 'DELETE');
      if (res.status === 'success') {
        fetchAdmins(selectedDept.id);
        fetchDepartments();
      } else throw new Error(res.message || 'Failed to remove admin');
    } catch (err: any) { setError(err.message || 'An error occurred'); }
  };

  // ── Shared Modal Shell ────────────────────────────────────────────────────
  const renderModal = (title: string, onSubmit: (e: React.FormEvent) => void, children: React.ReactNode, submitLabel: string, submitClass = 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10', isDelete = false) =>
    mounted && createPortal(
      <div
        onClick={closeModal}
        className="fixed inset-0 z-[9000] flex items-start justify-center p-4 md:py-20 overflow-y-auto bg-slate-900/60 backdrop-blur-sm"
      >
        <div
          onClick={e => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        >
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              onClick={closeModal}
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={isDelete ? (e) => { e.preventDefault(); handleDelete(); } : onSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              {children}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                disabled={formLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2.5 font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer ${submitClass}`}
                disabled={formLoading}
              >
                {formLoading ? 'Working...' : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="animate-page-enter flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight m-0 text-slate-900 dark:text-white">Manage Organizations</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">Provision and monitor isolated organization tenants.</span>
        </div>
        <button
          onClick={() => openModal('create')}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer transition-all active:scale-95 border-none"
        >
          <Plus size={16} /> Onboard Organization
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading organization registry...</p>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-visible">
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
            <table className="w-full border-collapse text-sm text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Organization Name</th>
                  <th className="p-3.5">Tenant ID</th>
                  <th className="p-3.5">Admin Email</th>
                  <th className="p-3.5">Admins</th>
                  <th className="p-3.5">Stats</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-center pr-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, idx) => (
                  <tr key={dept.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 last:border-none">
                    <td className="p-3.5 pl-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{dept.name}</div>
                          {dept.domain && <div className="text-xs text-slate-400 dark:text-slate-500">{dept.domain}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-md font-mono">
                        {dept.id}
                      </code>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{dept.adminEmail}</td>
                    <td className="p-3.5">
                      <span
                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold cursor-pointer border border-blue-100/30"
                        onClick={() => openModal('admins', dept)}
                      >
                        {dept.adminsCount || 1} {(dept.adminsCount || 1) === 1 ? 'admin' : 'admins'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                        <div><strong className="text-slate-800 dark:text-slate-200 font-bold">{dept.electionsCount}</strong> Elections</div>
                        <div><strong className="text-slate-800 dark:text-slate-200 font-bold">{dept.votersCount}</strong> Voters</div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        dept.status === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                      }`}>
                        {dept.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center pr-5">
                      <button
                        className="p-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-500 dark:text-slate-400"
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
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-400 dark:text-slate-500">No organizations found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create Modal ── */}
      {modalType === 'create' && renderModal(
        'Onboard New Organization',
        handleCreate,
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Organization Name</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              placeholder="e.g. Computer Science Society"
              value={createForm.name}
              onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Admin Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                placeholder="admin@organization.org"
                value={createForm.adminEmail}
                onChange={e => setCreateForm({ ...createForm, adminEmail: e.target.value })}
              />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block leading-relaxed">
              If an account with this email already exists, their role will automatically be assigned as Organization Administrator.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Admin Password <span className="text-slate-400 font-normal">(Required for new users)</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Set password for authentication"
                value={createForm.adminPassword}
                onChange={e => setCreateForm({ ...createForm, adminPassword: e.target.value })}
              />
            </div>
          </div>
        </div>,
        'Onboard Organization'
      )}

      {/* ── Edit Name Modal ── */}
      {modalType === 'edit' && selectedDept && renderModal(
        `Rename "${selectedDept.name}"`,
        handleEditName,
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">New Department Name</label>
          <input
            type="text"
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            placeholder="Enter new name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
          />
        </div>,
        'Save Changes'
      )}

      {/* ── Change Password Modal ── */}
      {modalType === 'password' && selectedDept && renderModal(
        `Change Admin Password — ${selectedDept.name}`,
        handleChangePassword,
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Setting a new password for <strong>{selectedDept.adminEmail}</strong>.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">New Password</label>
            <input
              type="password"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              placeholder="Enter new password (min 6 chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirm New Password</label>
            <input
              type="password"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>,
        'Update Password'
      )}

      {/* ── Delete Confirm Modal ── */}
      {modalType === 'delete' && selectedDept && renderModal(
        `Delete "${selectedDept.name}"?`,
        handleDelete,
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            This will permanently delete <strong className="text-slate-800 dark:text-slate-200">{selectedDept.name}</strong> and all its associated elections, candidates, and voter rolls. This action <strong className="text-red-500">cannot be undone</strong>.
          </p>
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200/40 text-xs text-red-600 dark:text-red-400">
            ⚠ All data under <code>{selectedDept.id}</code> will be permanently erased.
          </div>
        </div>,
        'Delete Department',
        'bg-red-600 hover:bg-red-700 text-white shadow-red-500/10',
        true
      )}

      {/* ── Manage Admins Modal ── */}
      {modalType === 'admins' && selectedDept && mounted && createPortal(
        <div
          onClick={closeModal}
          className="fixed inset-0 z-[9000] flex items-start justify-center p-4 md:py-20 overflow-y-auto bg-slate-900/60 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={18} /> Manage Admins — {selectedDept.name}
              </h3>
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                onClick={closeModal}
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {adminsLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">Loading admins...</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {deptAdmins.map(admin => (
                    <div key={admin.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl gap-3 flex-wrap">
                      {editingAdminId === admin.id ? (
                        <form onSubmit={handleEditAdmin} className="flex gap-2 flex-1 items-center flex-wrap">
                          <input
                            type="text"
                            className="flex-1 min-w-[120px] px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                            placeholder="Name"
                            value={editAdminForm.name}
                            onChange={e => setEditAdminForm({ ...editAdminForm, name: e.target.value })}
                          />
                          <input
                            type="password"
                            className="flex-1 min-w-[120px] px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                            placeholder="New password (optional)"
                            value={editAdminForm.password}
                            onChange={e => setEditAdminForm({ ...editAdminForm, password: e.target.value })}
                          />
                          <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold" disabled={formLoading}>{formLoading ? '...' : 'Save'}</button>
                          <button type="button" className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold" onClick={() => setEditingAdminId(null)}>Cancel</button>
                        </form>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                              {admin.name}
                              {admin.isPrimary && <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 uppercase">Primary</span>}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{admin.email}</div>
                          </div>
                          {!admin.isPrimary && (
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button
                                className="p-1.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400"
                                onClick={() => { setEditingAdminId(admin.id); setEditAdminForm({ name: admin.name, password: '' }); }}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                className="p-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400"
                                onClick={() => handleRemoveAdmin(admin.id)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Admin Form */}
              {showAddAdmin ? (
                <form onSubmit={handleAddAdmin} className="mt-4 p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 flex flex-col gap-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900 dark:text-white text-xs">Add New Admin</span>
                    <button type="button" onClick={() => { setShowAddAdmin(false); setAddAdminForm({ name: '', email: '', password: '' }); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white bg-none border-none cursor-pointer"><X size={16} /></button>
                  </div>
                  <div className="flex flex-col gap-3">
                    <input type="text" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white" required placeholder="Admin Name" value={addAdminForm.name} onChange={e => setAddAdminForm({ ...addAdminForm, name: e.target.value })} />
                    <input type="email" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white" required placeholder="Admin Email" value={addAdminForm.email} onChange={e => setAddAdminForm({ ...addAdminForm, email: e.target.value })} />
                    <input type="password" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white" required placeholder="Password (min 6 chars)" value={addAdminForm.password} onChange={e => setAddAdminForm({ ...addAdminForm, password: e.target.value })} />
                    <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl self-end" disabled={formLoading}>
                      {formLoading ? 'Adding...' : 'Add Admin'}
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowAddAdmin(true)} className="mt-4 w-full px-4 py-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/20 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer">
                  <UserPlus size={16} /> Add New Admin
                </button>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Dropdown Portal ── */}
      {openMenuId && menuCoords && selectedDept && createPortal(
        <div
          ref={menuRef}
          className="absolute z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl min-w-[210px] overflow-hidden p-1.5"
          style={{
            left: `${menuCoords.x - 210}px`,
            top: `${menuCoords.y + 4}px`
          }}
        >
          <button
            onClick={() => {
              localStorage.setItem('COMPSSA_tenantId', selectedDept.id);
              router.push('/admin/dashboard');
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 rounded-xl bg-none border-none cursor-pointer text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors text-left"
          >
            <ExternalLink size={14} /> Access Admin Console
          </button>
          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />
          <button
            onClick={() => openModal('admins', selectedDept)}
            className="w-full px-3 py-2 flex items-center gap-2.5 rounded-xl bg-none border-none cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <Users size={14} className="text-blue-500" /> Manage Admins
          </button>
          <button
            onClick={() => openModal('edit', selectedDept)}
            className="w-full px-3 py-2 flex items-center gap-2.5 rounded-xl bg-none border-none cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <Pencil size={14} className="text-blue-500" /> Rename Organization
          </button>
          <button
            onClick={() => openModal('password', selectedDept)}
            className="w-full px-3 py-2 flex items-center gap-2.5 rounded-xl bg-none border-none cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <KeyRound size={14} className="text-amber-500" /> Change Admin Password
          </button>
          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />
          <button
            onClick={() => openModal('delete', selectedDept)}
            className="w-full px-3 py-2 flex items-center gap-2.5 rounded-xl bg-none border-none cursor-pointer text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left"
          >
            <Trash2 size={14} /> Delete Organization
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
