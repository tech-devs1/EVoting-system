'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Building,
  Mail,
  Phone,
  MapPin,
  User,
  Sliders,
  Smartphone,
  Palette,
  Image as ImageIcon
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Expanded Organization Settings State
  const [orgName, setOrgName] = useState('Students\' Representative Council (SRC)');
  const [portalTitle, setPortalTitle] = useState('HTU Elect Portal');
  const [supportEmail, setSupportEmail] = useState('info@htu.edu.gh');
  const [supportPhone, setSupportPhone] = useState('+233 24 000 0000');
  const [address, setAddress] = useState('P.O. Box HP 35, Ho, Volta Region, Ghana');
  const [ecName, setEcName] = useState('Electoral Commissioner');
  const [ecTitle, setEcTitle] = useState('Ho Technical University Electoral Commission');
  const [systemMode, setSystemMode] = useState('passwordless_otp');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#2563eb');
  const [smsSenderId, setSmsSenderId] = useState('HTU-ELECT');
  const [enableSmsInvites, setEnableSmsInvites] = useState(true);

  // Fetch current settings on load (simulated or real from tenant configuration)
  useEffect(() => {
    async function loadBranding() {
      try {
        // Query current tenant parameters if available
        const res = await apiRequest<{ status: string; data?: any }>('/tenants/branding', 'GET').catch(() => null);
        if (res && res.status === 'success' && res.data) {
          if (res.data.logoUrl) setLogoUrl(res.data.logoUrl);
          if (res.data.brandColor) setBrandColor(res.data.brandColor);
          if (res.data.orgName) setOrgName(res.data.orgName);
          if (res.data.smsSenderId) setSmsSenderId(res.data.smsSenderId);
        }
      } catch (err) {
        console.warn('Could not load current settings:', err);
      }
    }
    loadBranding();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Save branding and general configuration details to backend
      const res = await apiRequest<{ status: string; message?: string }>(
        '/tenants/branding',
        'POST',
        {
          logoUrl,
          brandColor,
          orgName,
          portalTitle,
          supportEmail,
          supportPhone,
          address,
          ecName,
          ecTitle,
          systemMode,
          smsSenderId,
          enableSmsInvites
        }
      );

      if (res.status === 'success') {
        setMessage({ type: 'success', text: '✅ Organization settings and branding parameters updated successfully!' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setMessage({ type: 'error', text: res.message || 'Failed to update organization settings.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'An unexpected error occurred while saving.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', paddingTop: '1.5rem', paddingBottom: '3rem' }} className="animate-page-enter">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link 
          href="/admin/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#2563eb',
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
            marginBottom: '1rem',
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(37, 99, 235, 0.08)'
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building size={28} style={{ color: '#2563eb' }} />
          Organization & Institutional Settings
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
          Configure comprehensive administrative parameters, helpdesk contact profiles, and passwordless authentication modes.
        </p>
      </div>

      {message && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          background: message.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${message.type === 'success' ? '#10B98133' : '#EF444433'}`,
          color: message.type === 'success' ? '#10B981' : '#EF4444'
        }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Core Institutional Info Card */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <Building size={20} style={{ color: '#2563eb' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Institutional Profile</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Organization / Faculty Name</label>
              <input
                type="text"
                className="form-input"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                required
                placeholder="e.g. Students' Representative Council (SRC)"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Institutional Portal Title</label>
              <input
                type="text"
                className="form-input"
                value={portalTitle}
                onChange={e => setPortalTitle(e.target.value)}
                required
                placeholder="e.g. HTU Elect Portal"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} style={{ color: 'var(--text-tertiary)' }} /> Support Helpdesk Email
              </label>
              <input
                type="email"
                className="form-input"
                value={supportEmail}
                onChange={e => setSupportEmail(e.target.value)}
                required
                placeholder="info@htu.edu.gh"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Phone size={14} style={{ color: 'var(--text-tertiary)' }} /> Support Helpdesk Phone
              </label>
              <input
                type="text"
                className="form-input"
                value={supportPhone}
                onChange={e => setSupportPhone(e.target.value)}
                placeholder="+233 24 000 0000"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} style={{ color: 'var(--text-tertiary)' }} /> Headquarters / Physical Address
            </label>
            <input
              type="text"
              className="form-input"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. P.O. Box HP 35, Ho, Volta Region, Ghana"
            />
          </div>
        </div>

        {/* Electoral Commission Official Sign-Off Details Card */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <User size={20} style={{ color: '#10B981' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Electoral Commission Sign-Off Details</h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
            These parameters are dynamically printed on official certified election reports and results PDF certifications.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Electoral Commissioner Name</label>
              <input
                type="text"
                className="form-input"
                value={ecName}
                onChange={e => setEcName(e.target.value)}
                required
                placeholder="e.g. Prof. Joseph K. Anumu"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Official Commission Title</label>
              <input
                type="text"
                className="form-input"
                value={ecTitle}
                onChange={e => setEcTitle(e.target.value)}
                required
                placeholder="e.g. Ho Technical University Electoral Commission"
              />
            </div>
          </div>
        </div>

        {/* Security & Passwordless Gateways Card */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <Sliders size={20} style={{ color: '#4F46E5' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Security Mode & OTP Gateways</h3>
          </div>

          <div className="form-group">
            <label className="form-label">System Authentication Mode</label>
            <div style={{ padding: '1rem', backgroundColor: '#EFF6FF', borderRadius: '12px', border: '1px solid #DBEAFE', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <ShieldCheck size={22} style={{ color: '#2563EB', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontWeight: 700, margin: '0 0 4px 0', color: '#1E40AF', fontSize: 'var(--text-sm)' }}>Passwordless OTP Only (Biometrics Bypassed)</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#1E3A8A', lineHeight: 1.4 }}>
                  Passwords have been completely decommissioned. Voters and admins log in passwordlessly utilizing Secure One-Time Passcode tokens delivered to their verified emails and phone numbers.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Smartphone size={14} style={{ color: 'var(--text-tertiary)' }} /> mNotify / BMS Africa SMS Sender ID
              </label>
              <input
                type="text"
                className="form-input"
                value={smsSenderId}
                onChange={e => setSmsSenderId(e.target.value)}
                placeholder="e.g. COMPSSA"
                maxLength={11}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Max 11 alphanumeric characters (pre-approved ID recommended)</p>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={enableSmsInvites}
                  onChange={e => setEnableSmsInvites(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                />
                <span>Enable SMS Invites & Broadcasts</span>
              </label>
            </div>
          </div>
        </div>

        {/* Branding & Logo Customization Card */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <Palette size={20} style={{ color: '#F59E0B' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Portal Custom Branding</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label className="form-label">Branding Preview</label>
              <div style={{
                height: '140px',
                borderRadius: '16px',
                border: '1.5px dashed var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '1rem',
                boxSizing: 'border-box'
              }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Branding Logo" style={{ maxHeight: '70px', maxWidth: '100%', objectFit: 'contain' }} />
                ) : (
                  <ImageIcon size={32} style={{ color: 'var(--text-tertiary)' }} />
                )}
                <span style={{ fontSize: '11px', fontWeight: 700, color: brandColor }}>
                  {orgName.substring(0, 20)}...
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Organization Logo Image URL</label>
                <input
                  type="url"
                  className="form-input"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Primary Brand Accent Color</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={brandColor}
                    onChange={e => setBrandColor(e.target.value)}
                    style={{ width: '48px', height: '38px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>{brandColor.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Submission Button */}
        <button
          type="submit"
          className="btn btn-primary animate-fade-in"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            fontWeight: 800,
            fontSize: '1rem',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            marginTop: '0.5rem'
          }}
        >
          {loading ? 'Saving Comprehensive Settings...' : '💾 Save Organization Parameters'}
        </button>
      </form>
    </div>
  );
}
