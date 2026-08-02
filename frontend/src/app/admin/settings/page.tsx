'use client';

import { useState } from 'react';
import { KeyRound, ShieldCheck, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function AdminSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    if (currentPassword === newPassword) {
      setMessage({ type: 'error', text: 'New password must be different from the current password.' });
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ status: string; message: string }>(
        '/admin/change-password',
        'POST',
        { currentPassword, newPassword }
      );

      if (res.status === 'success') {
        setMessage({ type: 'success', text: 'Password updated successfully. This change is reflected across all portals.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: res.message || 'Failed to change password.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (pwd: string) => {
    if (!pwd) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: 'Weak', color: '#EF4444' };
    if (score <= 3) return { level: 2, label: 'Medium', color: '#F59E0B' };
    return { level: 3, label: 'Strong', color: '#10B981' };
  };

  const strength = passwordStrength(newPassword);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={24} style={{ color: 'var(--color-primary)' }} />
          Account Settings
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
          Manage your department admin credentials. Password changes are synced to the Super Admin portal.
        </p>
      </div>

      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KeyRound size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Change Password</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Update your admin login password</p>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: 'var(--text-sm)',
            background: message.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${message.type === 'success' ? '#10B98133' : '#EF444433'}`,
            color: message.type === 'success' ? '#10B981' : '#EF4444'
          }}>
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleChangePassword}>
          {/* Current Password */}
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label">Current Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                className="form-input"
                required
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)' }}
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
            <label className="form-label">New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                className="form-input"
                required
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)' }}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {/* Password Strength Meter */}
            {newPassword && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{
                      height: '4px', flex: 1, borderRadius: '2px',
                      background: i <= strength.level ? strength.color : 'var(--border-color)',
                      transition: 'background 0.2s ease'
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '11px', color: strength.color, fontWeight: 500 }}>{strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
            <label className="form-label">Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                className="form-input"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{
                  paddingRight: '44px',
                  borderColor: confirmPassword && confirmPassword !== newPassword ? '#EF4444' : undefined
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)' }}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px' }}>Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            style={{ width: '100%', padding: '12px', fontWeight: 600, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>

        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          
        </div>
      </div>
    </div>
  );
}
