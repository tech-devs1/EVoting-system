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
  Trophy,
  AlertTriangle,
  ShieldAlert
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
  noVotes?: number;
  isIndependent?: boolean;
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
  totalStudents?: number;
  uniqueVotersCount?: number;
  activeElectionsCount?: number;
  completedElectionsCount?: number;
}

function ElectionDashboardChart({ result }: { result: ElectionResult }) {
  const { election, candidates, totalVotes } = result;

  const chartLabels: string[] = [];
  const chartVotes: number[] = [];
  const chartColors: string[] = [];

  candidates.forEach((c, i) => {
    if (c.isIndependent) {
      chartLabels.push(`${c.name} (Yes)`);
      chartVotes.push(c.votes || 0);
      chartColors.push('#10B981');

      chartLabels.push(`${c.name} (No)`);
      chartVotes.push(c.noVotes || 0);
      chartColors.push('#EF4444');
    } else {
      chartLabels.push(c.name);
      chartVotes.push(c.votes || 0);
      chartColors.push(COLORS[i % COLORS.length]);
    }
  });

  const barData = {
    labels: chartLabels,
    datasets: [{
      label: 'Votes',
      data: chartVotes,
      backgroundColor: chartColors,
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

      <div style={{ height: `${Math.max(220, candidates.length * 40)}px`, position: 'relative' }}>
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
  const [flaggedUsers, setFlaggedUsers] = useState<{id: string; studentId: string; attemptedAt: string; email: string; timestamp: number; status?: string}[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  async function fetchDashboardData() {
    try {
      console.log('[Admin Dashboard] Fetching full unified dashboard data...');
      const res = await apiRequest<{
        status: string;
        data: {
          stats: KPIStats;
          electionResults: ElectionResult[];
          flaggedUsers: any[];
        };
      }>('/admin/dashboard-full');

      if (res.status === 'success') {
        const { stats, electionResults, flaggedUsers } = res.data;
        setStats(stats);
        setResults(electionResults);
        setFlaggedUsers(flaggedUsers);
        setActiveElectionsCount(stats.activeElectionsCount || 0);
      }
    } catch (err) {
      console.error('[Admin Dashboard] Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();

    // Reduce polling to 30 seconds and respect Page Visibility API to save Firebase reads
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        fetchDashboardData();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(fetchDashboardData, 30000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    intervalRef.current = setInterval(fetchDashboardData, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);;

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
              <TrendingUp size={12} /> {stats.totalElections > 0 ? Math.min(100, Math.round(((stats.completedElectionsCount || 0) / stats.totalElections) * 100)) : 0}% completed
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
              <Check size={12} /> {stats.totalElections > 0 ? Math.min(100, Math.round(((stats.activeElectionsCount || 0) / stats.totalElections) * 100)) : 0}% of all polls
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
              <TrendingUp size={12} /> {stats.totalStudents && stats.totalStudents > 0 ? Math.min(100, (stats.totalVoters / stats.totalStudents) * 100).toFixed(1) : '0.0'}% registration rate
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
              <TrendingUp size={12} /> {stats.totalVoters > 0 ? Math.min(100, ((stats.uniqueVotersCount || 0) / stats.totalVoters) * 100).toFixed(1) : '0.0'}% Turnout
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

      {/* Flagged Users Section */}
      <div style={{ marginTop: 'var(--space-10)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: '0 0 var(--space-4) 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="#EF4444" />
          Flagged Users
          {flaggedUsers.length > 0 && (
            <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: '10px', border: '1px solid rgba(239,68,68,0.3)' }}>
              {flaggedUsers.length} flagged
            </span>
          )}
        </h3>
        {flaggedUsers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No flagged users detected. All access attempts are matching the database.</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={14} color="#EF4444" />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#EF4444' }}>
                These individuals attempted to access the system but their IDs were not found in the registered student database.
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student ID Attempted</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time of Attempt</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student Email</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {flaggedUsers.map((fu, index) => (
                  <tr key={fu.id} style={{ borderTop: '1px solid var(--border-color)', background: index % 2 === 0 ? 'transparent' : 'var(--bg-input)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontFamily: 'monospace', color: '#EF4444', fontWeight: 600 }}>
                      {fu.studentId}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      {fu.attemptedAt ? new Date(fu.attemptedAt).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      {fu.email}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 600 }}>
                        {fu.status || 'unresolved'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
