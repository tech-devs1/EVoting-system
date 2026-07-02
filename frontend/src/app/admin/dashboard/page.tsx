'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  BarElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CandidateStats {
  name: string;
  votes: number;
}

interface KPIStats {
  totalElections: number;
  totalVoters: number;
  totalVotesCast: number;
  activeAlerts: number;
  topCandidates?: CandidateStats[];
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

  // Updated admin dashboard to fetch live vote count and animate donut on new votes
  useEffect(() => {
    async function fetchDashboard() {
      try {
        console.log('[Admin Dashboard] Fetching static KPIs...');
        const res = await apiRequest<{ status: string; data: KPIStats }>('/admin/dashboard');
        if (res.status === 'success') {
          const s = res.data;
          setStats({
            totalElections: s.totalElections || 0,
            totalVoters: s.totalVoters || 0,
            totalVotesCast: s.totalVotesCast || 0,
            activeAlerts: s.activeAlerts || 0,
            topCandidates: s.topCandidates || []
          });
        }
        
        // Fetch elections list to count active
        const electionsRes = await apiRequest<{ status: string; data: any[] }>('/elections');
        if (electionsRes.status === 'success') {
          const active = electionsRes.data.filter(e => e.status === 'active').length;
          setActiveElectionsCount(active);
        }
      } catch (err) {
        console.error('[Admin Dashboard] Error fetching KPIs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  // State to control donut animation
  const [animateDonut, setAnimateDonut] = useState(false);

  // Update live votes and trigger animation only on change
  const [liveVotesCast, setLiveVotesCast] = useState(0);
  const [liveCandidates, setLiveCandidates] = useState<CandidateStats[]>([]);
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    async function fetchLiveVotes() {
      try {
        const res = await apiRequest<{ status: string; data: { liveVotesCount: number; topCandidates?: CandidateStats[] } }>('/admin/live-votes');
        if (res.status === 'success') {
          const count = res.data.liveVotesCount ?? 0;
          setLiveVotesCast(prev => {
            if (prev !== count) {
              setAnimateDonut(true); // trigger animation
              return count;
            }
            return prev;
          });
          if (res.data.topCandidates) {
             setLiveCandidates(res.data.topCandidates);
          }
        }
      } catch (err) {
        console.error('[Admin Dashboard] Error fetching live votes:', err);
      }
    }
    fetchLiveVotes();
    intervalId = setInterval(fetchLiveVotes, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Reset animation flag after a short period to avoid re‑animation on unchanged data
  useEffect(() => {
    if (animateDonut) {
      const timeout = setTimeout(() => setAnimateDonut(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [animateDonut]);

  // Candidate Bar Chart Data
  const candidatesSource = liveCandidates.length > 0 ? liveCandidates : (stats.topCandidates || []);
  const candidateChartData = {
    labels: candidatesSource.map(c => c.name),
    datasets: [{
      label: 'Votes Cast',
      data: candidatesSource.map(c => c.votes),
      backgroundColor: '#3B82F6',
      borderRadius: 4
    }]
  };

  const candidateChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, beginAtZero: true },
      x: { grid: { display: false } }
    }
  };

  return (
    <div className="animate-page-enter">
      {/* Dashboard Header with Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
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
      <div className="admin-grid-charts" style={{ gridTemplateColumns: '1fr' }}>
        
        {/* Main Live Candidate Bar Chart */}
        <div className="card chart-card">
          <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="chart-title">Real-Time Candidate Vote Standings</h3>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={12} className="animate-spin-slow" /> Live updates
            </span>
          </div>
          <div className="chart-body" style={{ height: '400px', position: 'relative' }}>
            {candidatesSource.length > 0 ? (
              <Bar data={candidateChartData} options={candidateChartOptions} />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
                No active candidates found
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
