'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  Settings,
  Trophy
} from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement,
  Title, 
  Tooltip, 
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const COLORS = [
  '#3B82F6', '#7C3AED', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316',
  '#6366F1', '#84CC16',
];

interface Candidate {
  id: string;
  name: string;
  position: string;
  votes: number;
}

interface Election {
  id: string;
  title: string;
  status: string;
}

interface ElectionResult {
  election: Election;
  candidates: Candidate[];
  totalVotes: number;
}

interface KPIStats {
  totalElections: number;
  totalVoters: number;
  totalVotesCast: number;
  activeAlerts: number;
}

function ElectionDashboardChart({ result }: { result: ElectionResult }) {
  const { election, candidates, totalVotes } = result;
  const sorted = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));

  const barData = {
    labels: sorted.map(c => c.name),
    datasets: [{
      label: 'Votes',
      data: sorted.map(c => c.votes || 0),
      backgroundColor: sorted.map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 6,
      borderSkipped: false as const,
    }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const pct = totalVotes > 0 ? ((ctx.raw / totalVotes) * 100).toFixed(1) : '0.0';
            return ` ${ctx.raw} votes (${pct}%)`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { stepSize: 1 },
      },
      x: { grid: { display: false } },
    },
  };

  const statusColors: Record<string, string> = {
    active: '#10B981',
    completed: '#6366F1',
    draft: '#F59E0B',
  };

  return (
    <div className="card chart-card" style={{ marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <Trophy size={16} color={COLORS[0]} />
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0 }}>{election.title} Standings</h4>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            <span>{candidates.length} candidate{candidates.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{totalVotes.toLocaleString()} vote{totalVotes !== 1 ? 's' : ''} cast</span>
          </div>
        </div>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '10px',
            fontWeight: 600,
            background: `${statusColors[election.status] || '#94a3b8'}22`,
            color: statusColors[election.status] || '#94a3b8',
            border: `1px solid ${statusColors[election.status] || '#94a3b8'}44`,
            textTransform: 'capitalize',
          }}
        >
          {election.status}
        </span>
      </div>

      <div style={{ height: `${Math.max(220, sorted.length * 40)}px`, position: 'relative' }}>
        {candidates.length > 0 ? (
          <Bar data={barData} options={barOptions} />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
            No candidates registered
          </div>
        )}
      </div>
    </div>
  );
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
  const [results, setResults] = useState<ElectionResult[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchDashboardData() {
    try {
      console.log('[Admin Dashboard] Fetching static KPIs...');
      const res = await apiRequest<{ status: string; data: KPIStats }>('/admin/dashboard');
      if (res.status === 'success') {
        setStats(res.data);
      }

      // Fetch all elections and their candidates in parallel for real-time charts
      const electionsRes = await apiRequest<{ status: string; data: Election[] }>('/elections');
      if (electionsRes.status === 'success' && electionsRes.data.length > 0) {
        const elections = electionsRes.data;
        const activeCount = elections.filter(e => e.status === 'active').length;
        setActiveElectionsCount(activeCount);

        const settled = await Promise.allSettled(
          elections.map(election =>
            apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${election.id}`)
          )
        );

        const newResults: ElectionResult[] = elections.map((election, i) => {
          const resVal = settled[i];
          const candidates = resVal.status === 'fulfilled' && resVal.value.status === 'success'
            ? resVal.value.data
            : [];
          const totalVotes = candidates.reduce((s, c) => s + (c.votes || 0), 0);
          return { election, candidates, totalVotes };
        });

        setResults(newResults);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('[Admin Dashboard] Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
    // Poll stats and charts data every 5 seconds
    intervalRef.current = setInterval(fetchDashboardData, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
              <TrendingUp size={12} /> {stats.totalVoters > 0 ? ((stats.totalVotesCast / stats.totalVoters) * 100).toFixed(1) : 0}% Turnout
            </div>
          </div>
          <div className="kpi-icon-wrapper amber">
            <Vote size={20} />
          </div>
        </div>

      </div>

      {/* Real-Time Activity Charts Grid */}
      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 'var(--space-8) 0 var(--space-4) 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Real-Time Standings 
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
          <RefreshCw size={10} className="animate-spin-slow" /> Live updates
        </span>
      </h3>
      
      <div className="admin-grid-charts" style={{ gridTemplateColumns: '1fr', gap: 'var(--space-6)' }}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading live standings...</p>
        ) : results.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No elections created yet.</p>
          </div>
        ) : (
          results.map(result => (
            <ElectionDashboardChart key={result.election.id} result={result} />
          ))
        )}
      </div>
    </div>
  );
}
