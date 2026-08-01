'use client';

import React from 'react';
import { Activity } from 'lucide-react';

export default function SuperAdminAudit() {
  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>System Audit Logs</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Global transaction and activity logs across all tenants.</p>
      </header>

      <div className="glass-card">
        <div style={{ textAlign: 'center', padding: 'var(--space-12) 0', color: 'var(--text-secondary)' }}>
          <Activity size={48} style={{ opacity: 0.2, margin: '0 auto var(--space-4) auto' }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Audit Logging Active</h3>
          <p>Global audit trails will appear here. The Merkle root hash is currently protecting all votes.</p>
        </div>
      </div>
    </div>
  );
}
