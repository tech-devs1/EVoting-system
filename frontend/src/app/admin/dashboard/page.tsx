'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { 
  TrendingUp, 
  Archive, 
  Activity, 
  Users, 
  Vote, 
  RefreshCw, 
  Check,
  Plus,
  Settings
} from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  ArcElement,
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface KPIStats {
  totalElections: number;
  totalVoters: number;
  totalVotesCast: number;
  activeAlerts: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<KPIStats>({
    totalElections: 0,
    totalVoters: 0,
    totalVotesCast: 0,
    activeAlerts: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeElectionsCount, setActiveElectionsCount] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await apiRequest<{ status: string; data: KPIStats }>('/admin/dashboard');
        if (res.status === 'success') {
          // If mock DB is empty, use defaults
          const s = res.data;
          setStats({
            totalElections: s.totalElections || 0,
            totalVoters: s.totalVoters || 0,
            totalVotesCast: s.totalVotesCast || 0,
            activeAlerts: s.activeAlerts || 0
          });
        }
        
        // Fetch elections list to count active
        const electionsRes = await apiRequest<{ status: string; data: any[] }>('/elections');
        if (electionsRes.status === 'success') {
          const active = electionsRes.data.filter(e => e.status === 'active').length;
          setActiveElectionsCount(active);
        }
      } catch (err) {
        console.error('Error fetching admin dashboard KPIs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const activityData = {
    labels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
    datasets: [{
      label: 'Votes Cast / Hour',
      data: [0, 0, 0, 0, 0, 0, 0],
      borderColor: '#2563EB',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };

  const activityOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { grid: { color: 'rgba(148, 163, 184, 0.1)' } },
      x: { grid: { display: false } }
    }
  };

  const turnoutData = {
    labels: ['Voted', 'Remaining'],
    datasets: [{
      data: [stats.totalVotesCast, Math.max(0, stats.totalVoters - stats.totalVotesCast)],
      backgroundColor: ['#10B981', '#E2E8F0'],
      borderWidth: 0
    }]
  };

  const turnoutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } }
  };

  return (
    <div className="animate-page-enter">
      {/* Dashboard Header with Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, margin: 0 }}>Executive Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-sm)' }}>
            Real-time election monitoring and management
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href="/admin/elections" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Settings size={16} /> Manage Elections
          </Link>
        </div>
      </div>

      {/* Executive KPI Cards */}
      <div className="admin-grid-top">
        
        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Total Elections</span>
            <span className="kpi-value">{stats.totalElections}</span>
            <div className="kpi-trend up" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <TrendingUp size={12} /> +12% vs last sem
            </div>
          </div>
          <div className="kpi-icon-wrapper purple">
            <Archive size={20} />
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Active Polls</span>
            <span className="kpi-value">{activeElectionsCount}</span>
            <div className="kpi-trend up" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <Check size={12} /> 100% up status
            </div>
          </div>
          <div className="kpi-icon-wrapper blue">
            <Activity size={20} />
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Registered Voters</span>
            <span className="kpi-value">{stats.totalVoters.toLocaleString()}</span>
            <div className="kpi-trend up" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <TrendingUp size={12} /> +8.2% registration
            </div>
          </div>
          <div className="kpi-icon-wrapper green">
            <Users size={20} />
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Total Votes Cast</span>
            <span className="kpi-value">{stats.totalVotesCast.toLocaleString()}</span>
            <div className="kpi-trend up" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <TrendingUp size={12} /> {((stats.totalVotesCast / stats.totalVoters) * 100).toFixed(1)}% Turnout
            </div>
          </div>
          <div className="kpi-icon-wrapper amber">
            <Vote size={20} />
          </div>
        </div>

      </div>

      {/* Real-Time Activity Charts Grid */}
      <div className="admin-grid-charts">
        
        {/* Main Line Chart */}
        <div className="card chart-card">
          <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="chart-title">Real-Time Voting Activity Stream</h3>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={12} className="animate-spin-slow" /> Live updates
            </span>
          </div>
          <div className="chart-body" style={{ height: '300px', position: 'relative' }}>
            <Line data={activityData} options={activityOptions} />
          </div>
        </div>

        {/* Turnout Donut Chart */}
        <div className="card chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Voter turnout status</h3>
          </div>
          <div className="chart-body" style={{ height: '300px', position: 'relative' }}>
            <Doughnut data={turnoutData} options={turnoutOptions} />
          </div>
        </div>

      </div>
    </div>
  );
}
