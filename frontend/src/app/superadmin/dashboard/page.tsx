'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Building2, Activity, Users, FileText } from 'lucide-react';

interface SuperAdminStats {
  departments: number;
  elections: number;
  voters: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<SuperAdminStats>({ departments: 0, elections: 0, voters: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiRequest<{ status: string; data: SuperAdminStats }>('/superadmin/stats');
        if (res.status === 'success') {
          setStats(res.data);
        } else {
          throw new Error('Failed to load stats');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="animate-page-enter">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, margin: 0 }}>System Overview</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-sm)' }}>Global metrics across all tenants</p>
        </div>
      </header>

      {error && (
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', border: '1px solid #EF444444' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading system statistics...</p>
      ) : (
        <div className="admin-grid-top">
          <div className="card kpi-card">
            <div className="kpi-details">
              <span className="kpi-label">Active Departments</span>
              <span className="kpi-value">{stats.departments}</span>
              <div className="kpi-trend up">
                <span>Total tenants</span>
              </div>
            </div>
            <div className="kpi-icon-wrapper blue">
              <Building2 size={24} />
            </div>
          </div>

          <div className="card kpi-card">
            <div className="kpi-details">
              <span className="kpi-label">Total Elections</span>
              <span className="kpi-value">{stats.elections}</span>
              <div className="kpi-trend">
                <span>Across all departments</span>
              </div>
            </div>
            <div className="kpi-icon-wrapper purple">
              <Activity size={24} />
            </div>
          </div>

          <div className="card kpi-card">
            <div className="kpi-details">
              <span className="kpi-label">Registered Voters</span>
              <span className="kpi-value">{stats.voters.toLocaleString()}</span>
              <div className="kpi-trend">
                <span>Total platform users</span>
              </div>
            </div>
            <div className="kpi-icon-wrapper green">
              <Users size={24} />
            </div>
          </div>
          
          <div className="card kpi-card">
            <div className="kpi-details">
              <span className="kpi-label">System Health</span>
              <span className="kpi-value" style={{ color: 'var(--color-success)', fontSize: '1.2rem' }}>Nominal</span>
              <div className="kpi-trend">
                <span>All systems operational</span>
              </div>
            </div>
            <div className="kpi-icon-wrapper green">
              <FileText size={24} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
