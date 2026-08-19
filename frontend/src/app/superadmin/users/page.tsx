'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import {
  ArrowLeft, Users, ShieldCheck, ShieldAlert, UserCheck, UserX,
  Pencil, Trash2, X, Search, Activity, CheckCircle2, AlertTriangle
} from 'lucide-react';
import DataTable, { type ColumnDef, type FilterDef } from '@/components/DataTable';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  tenantId?: string;
  status: string;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function UserManagementContent() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: '', status: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete confirmation state
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await apiRequest<{ status: string; data: SystemUser[] }>('/superadmin/users');
      if (res.status === 'success' && Array.isArray(res.data)) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  // Edit handlers
  const openEditModal = (user: SystemUser) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'voter',
      status: user.status || 'active',
    });
    setEditMessage(null);
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setEditLoading(true);
    setEditMessage(null);
    try {
      await apiRequest(`/superadmin/users/${editingUser.id}`, 'PATCH', {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
        status: editForm.status,
      });
      setEditMessage({ type: 'success', text: 'User updated successfully.' });
      fetchUsers();
      setTimeout(() => setShowEditModal(false), 1200);
    } catch (err: any) {
      setEditMessage({ type: 'error', text: err.message || 'Failed to update user.' });
    } finally {
      setEditLoading(false);
    }
  };

  // Delete handlers
  const openDeleteModal = (user: SystemUser) => {
    setDeletingUser(user);
    setDeleteMessage(null);
    setDeleteLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    setDeleteMessage(null);
    try {
      await apiRequest(`/superadmin/users/${deletingUser.id}`, 'DELETE');
      setDeleteMessage({ type: 'success', text: 'User deleted successfully.' });
      fetchUsers();
      setTimeout(() => setDeletingUser(null), 1200);
    } catch (err: any) {
      setDeleteMessage({ type: 'error', text: err.message || 'Failed to delete user.' });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Derived stats
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const superadminCount = users.filter(u => u.role === 'superadmin').length;
  const voterCount = users.filter(u => u.role === 'voter').length;
  const activeCount = users.filter(u => u.status === 'active').length;

  // Dynamic filter options
  const uniqueRoles = [...new Set(users.map(u => u.role))].sort();
  const uniqueStatuses = [...new Set(users.map(u => u.status))].sort();

  const userFilters: FilterDef[] = [
    {
      key: 'role',
      label: 'All Roles',
      options: uniqueRoles.map(r => ({
        value: r,
        label: r.charAt(0).toUpperCase() + r.slice(1),
      })),
    },
    {
      key: 'status',
      label: 'All Statuses',
      options: uniqueStatuses.map(s => ({
        value: s,
        label: s.charAt(0).toUpperCase() + s.slice(1),
      })),
    },
  ];

  const userColumns: ColumnDef<SystemUser>[] = [
    {
      key: 'name',
      label: 'User',
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-[10px] font-extrabold text-blue-600 dark:text-blue-400 shrink-0">
            {(u.name || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white text-xs block">{u.name || 'Unknown'}</span>
            <span className="text-[10px] text-slate-400 font-medium">{u.email}</span>
          </div>
        </div>
      ),
    },
    { key: 'email', label: 'Email', render: (u) => <span className="text-slate-600 dark:text-slate-300 text-xs">{u.email}</span> },
    { key: 'phone', label: 'Phone', render: (u) => <span className="text-slate-500 dark:text-slate-400 text-xs">{u.phone || 'N/A'}</span> },
    {
      key: 'role',
      label: 'Role',
      filterable: true,
      filterKey: 'role',
      render: (u) => {
        const roleColors: Record<string, string> = {
          superadmin: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/30',
          admin: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30',
          voter: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        };
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${roleColors[u.role] || roleColors.voter}`}>
            {u.role === 'superadmin' ? <ShieldAlert size={10} /> : u.role === 'admin' ? <ShieldCheck size={10} /> : <UserCheck size={10} />}
            {u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Voter'}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      filterable: true,
      filterKey: 'status',
      render: (u) => u.status === 'active' ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
          <CheckCircle2 size={10} /> Active
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30">
          <UserX size={10} /> {u.status || 'Inactive'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (u) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openEditModal(u)}
            className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1"
          >
            <Pencil size={10} /> Edit
          </button>
          {u.role !== 'superadmin' && (
            <button
              onClick={() => openDeleteModal(u)}
              className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors flex items-center gap-1"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link href="/superadmin/dashboard" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Super Admin Dashboard
        </Link>
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Users size={24} className="text-blue-600" />
          User Management
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
          Manage all system users, roles, and account status across the platform
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Users', value: totalUsers, icon: Users, color: 'blue' },
          { label: 'Super Admins', value: superadminCount, icon: ShieldAlert, color: 'purple' },
          { label: 'Admins', value: adminCount, icon: ShieldCheck, color: 'blue' },
          { label: 'Voters', value: voterCount, icon: UserCheck, color: 'emerald' },
          { label: 'Active', value: activeCount, icon: CheckCircle2, color: 'emerald' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">{kpi.label}</span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white">{kpi.value}</span>
            </div>
            <div className={`p-2.5 bg-${kpi.color}-50 dark:bg-${kpi.color}-950/40 text-${kpi.color}-600 dark:text-${kpi.color}-400 rounded-xl`}>
              <kpi.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">System Users Directory</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Total: {users.length} users</p>
          </div>
        </div>

        {loading ? (
          <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading users...</p>
        ) : (
          <DataTable
            data={users}
            columns={userColumns}
            searchPlaceholder="Search by name, email, or phone…"
            searchKeys={['name', 'email', 'phone']}
            filters={userFilters}
            dateField="createdAt"
            emptyMessage="No users found in the system."
            pageSize={15}
          />
        )}
      </div>

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil size={18} className="text-blue-600" /> Edit User
              </h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {editMessage && (
              <div className={`p-3 rounded-xl text-xs font-semibold mb-4 ${
                editMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
              }`}>
                {editMessage.text}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Role</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    disabled={editingUser.role === 'superadmin'}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="voter">Voter</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={editLoading}
                className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md shadow-blue-500/20 transition-colors"
              >
                {editLoading ? 'Saving...' : 'Update User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">Delete User</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              Are you sure you want to delete <strong className="text-slate-700 dark:text-slate-300">{deletingUser.name}</strong>?
            </p>
            <p className="text-[11px] text-slate-400 mb-4">This action cannot be undone.</p>

            {deleteMessage && (
              <div className={`p-3 rounded-xl text-xs font-semibold mb-4 ${
                deleteMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
              }`}>
                {deleteMessage.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-md shadow-red-500/20 transition-colors"
              >
                {deleteLoading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserManagementPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">Loading user management...</div>}>
      <UserManagementContent />
    </Suspense>
  );
}
