'use client';

import React, { useState } from 'react';
import { Database, Plus, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api'; // we will use this later if we add a backend route for provisioning

export default function TenantsPage() {
  const [tenantName, setTenantName] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // For now, this is a placeholder for the actual backend tenant provisioning API
      // which will create the root tenant document and setup the RBAC admin user.
      await new Promise(resolve => setTimeout(resolve, 1500));
      setMessage({ type: 'success', text: `Tenant "${tenantName}" provisioned successfully.` });
      setTenantName('');
      setTenantDomain('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to provision tenant.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-content animate-page-enter">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Database size={28} className="text-primary" />
            Tenant Management (VaaS)
          </h1>
          <p className="page-subtitle">Provision and manage isolated environments for multi-tenant organizations.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
        
        {/* Provisioning Form */}
        <div className="glass-card-strong fade-in-up" style={{ padding: 'var(--space-6)', animationDelay: '0.1s' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} className="text-primary" />
            Provision New Tenant
          </h2>
          
          {message && (
            <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: 'var(--space-4)' }}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleProvisionTenant}>
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Organization Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. University of Ghana"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
              <label className="form-label">Organization Domain</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. ug.edu.gh"
                required
                value={tenantDomain}
                onChange={(e) => setTenantDomain(e.target.value)}
                disabled={loading}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Used to route voters to the correct tenant automatically.
              </p>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Provisioning...' : 'Provision Tenant'}
            </button>
          </form>
        </div>

        {/* Existing Tenants (Mock List) */}
        <div className="glass-card-strong fade-in-up" style={{ padding: 'var(--space-6)', animationDelay: '0.2s' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            Active Tenants
          </h2>
          
          <div className="election-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontWeight: 600 }}>Default University (COMPSSA)</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>ID: default_tenant</p>
              </div>
              <span className="status-badge status-active"><CheckCircle size={14}/> Active</span>
            </div>
          </div>
          
          <div className="alert alert-warning" style={{ display: 'flex', gap: '8px', fontSize: 'var(--text-sm)', marginTop: 'var(--space-4)' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Note:</strong> Super Admin authentication and backend multi-tenant provisioning APIs will be fully wired up in the next development sprint.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
