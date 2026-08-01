'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Building2, Users, FileText, Activity } from 'lucide-react';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    departments: 0,
    elections: 0,
    voters: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiRequest<{ status: string; data: any[] }>('/superadmin/departments');
        if (res.status === 'success') {
          const departments = res.data;
          let elections = 0;
          let voters = 0;
          departments.forEach(dept => {
            elections += dept.electionsCount || 0;
            voters += dept.votersCount || 0;
          });
          
          setStats({
            departments: departments.length,
            elections,
            voters
          });
        }
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return <div className="spinner" style={{ margin: '50px auto' }}></div>;
  }

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>System Overview</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Global metrics across all VaaS tenant departments.</p>
      </header>

      <div className="dashboard-grid" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--color-primary-100)', color: 'var(--color-primary)' }}>
            <Building2 size={24} />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Active Departments</h3>
            <p className="stat-value">{stats.departments}</p>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Total Elections</h3>
            <p className="stat-value">{stats.elections}</p>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Total Registered Voters</h3>
            <p className="stat-value">{stats.voters.toLocaleString()}</p>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">System Health</h3>
            <p className="stat-value" style={{ color: 'var(--color-success)', fontSize: '1.2rem' }}>All Systems Nominal</p>
          </div>
        </div>
      </div>
      
      <div className="glass-card">
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Recent System Activity</h2>
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--text-secondary)' }}>
          <Activity size={48} style={{ opacity: 0.2, margin: '0 auto var(--space-4) auto' }} />
          <p>System audit logs will appear here.</p>
        </div>
      </div>
    </div>
  );
}
