'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import {
  ArrowLeft, BarChart3, Users, Vote, TrendingUp, Download,
  Filter, Calendar, CheckCircle2, Clock, AlertTriangle,
  PieChart, Activity, FileText, Printer, RefreshCw, EyeOff
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

interface Candidate {
  id: string;
  name: string;
  position: string;
  positionTitle: string;
  votes: number;
  noVotes?: number;
  isIndependent?: boolean;
  ballotNumber?: string | number;
  photoUrl?: string;
}

interface Election {
  id: string;
  title: string;
  status: string;
  totalVoters?: number;
  totalVotesCast?: number;
  startDate?: string;
  endDate?: string;
  showResults?: boolean;
}

interface Voter {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone?: string;
  program?: string;
  level?: string;
  hasVoted?: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: number;
  actorEmail: string;
  action: string;
  description: string;
}

const COLORS = [
  '#3B82F6', '#7C3AED', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316',
  '#6366F1', '#84CC16',
];

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Query filters
  const [positionFilter, setPositionFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    if (!electionId) { setLoading(false); return; }
    async function fetchAll() {
      try {
        const [resElection, resVoters, resAudit] = await Promise.all([
          apiRequest<{ status: string; data: { election: Election; candidates: Candidate[]; totalVotes: number } }>(
            `/elections/${electionId}/results`
          ),
          apiRequest<{ status: string; data: Voter[] }>(`/elections/${electionId}/voters`),
          apiRequest<{ status: string; data: AuditEntry[] }>(`/elections/${electionId}/audit-records`),
        ]);

        if (resElection.status === 'success' && resElection.data) {
          setElection(resElection.data.election);
          setCandidates(resElection.data.candidates);
        }
        if (resVoters.status === 'success' && Array.isArray(resVoters.data)) {
          setVoters(resVoters.data);
        }
        if (resAudit.status === 'success' && Array.isArray(resAudit.data)) {
          setAuditLogs(resAudit.data);
        }
      } catch (err) {
        console.error('Error fetching analytics data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [electionId]);

  // Derived data
  const positions = useMemo(() => [...new Set(candidates.map(c => c.position || c.positionTitle || 'General'))], [candidates]);
  const uniquePrograms = useMemo(() => [...new Set(voters.map(v => v.program || '').filter(Boolean))].sort(), [voters]);
  const uniqueLevels = useMemo(() => [...new Set(voters.map(v => v.level || '').filter(Boolean))].sort(), [voters]);

  // Filtered candidates
  const filteredCandidates = useMemo(() => {
    let result = [...candidates];
    if (positionFilter !== 'all') result = result.filter(c => (c.position || c.positionTitle) === positionFilter);
    return result;
  }, [candidates, positionFilter]);

  // Filtered voters
  const filteredVoters = useMemo(() => {
    let result = [...voters];
    if (programFilter !== 'all') result = result.filter(v => v.program === programFilter);
    if (levelFilter !== 'all') result = result.filter(v => v.level === levelFilter);
    return result;
  }, [voters, programFilter, levelFilter]);

  // KPIs
  const totalVoters = filteredVoters.length;
  const totalVotesCast = filteredVoters.filter(v => v.hasVoted).length;
  const turnout = totalVoters > 0 ? Math.round((totalVotesCast / totalVoters) * 100) : 0;
  const totalPositions = positions.length;
  const totalCandidates = filteredCandidates.length;
  const fraudCount = auditLogs.filter(a => a.action?.includes('FRAUD') || a.action?.includes('DUPLICATE')).length;

  // Turnout by program
  const turnoutByProgram = useMemo(() => {
    const map: Record<string, { total: number; voted: number }> = {};
    filteredVoters.forEach(v => {
      const prog = v.program || 'Unknown';
      if (!map[prog]) map[prog] = { total: 0, voted: 0 };
      map[prog].total++;
      if (v.hasVoted) map[prog].voted++;
    });
    return Object.entries(map).map(([program, data]) => ({
      program,
      total: data.total,
      voted: data.voted,
      turnout: data.total > 0 ? Math.round((data.voted / data.total) * 100) : 0,
    })).sort((a, b) => b.turnout - a.turnout);
  }, [filteredVoters]);

  // Turnout by level
  const turnoutByLevel = useMemo(() => {
    const map: Record<string, { total: number; voted: number }> = {};
    filteredVoters.forEach(v => {
      const lev = v.level || 'Unknown';
      if (!map[lev]) map[lev] = { total: 0, voted: 0 };
      map[lev].total++;
      if (v.hasVoted) map[lev].voted++;
    });
    return Object.entries(map).map(([level, data]) => ({
      level,
      total: data.total,
      voted: data.voted,
      turnout: data.total > 0 ? Math.round((data.voted / data.total) * 100) : 0,
    })).sort((a, b) => a.level.localeCompare(b.level));
  }, [filteredVoters]);

  // Position vote breakdown
  const positionBreakdown = useMemo(() => {
    const map: Record<string, Candidate[]> = {};
    filteredCandidates.forEach(c => {
      const pos = c.position || c.positionTitle || 'General';
      if (!map[pos]) map[pos] = [];
      map[pos].push(c);
    });
    return Object.entries(map).map(([position, cands]) => {
      const sorted = [...cands].sort((a, b) => (b.votes || 0) - (a.votes || 0));
      const total = sorted.reduce((s, c) => s + (c.votes || 0) + (c.noVotes || 0), 0);
      return { position, candidates: sorted, totalVotes: total };
    });
  }, [filteredCandidates]);

  // Activity timeline
  const activityByDay = useMemo(() => {
    const map: Record<string, number> = {};
    auditLogs.forEach(a => {
      if (a.timestamp) {
        const d = new Date(a.timestamp).toISOString().split('T')[0];
        map[d] = (map[d] || 0) + 1;
      }
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  }, [auditLogs]);

  // Chart data — Turnout by Program
  const programChartData = {
    labels: turnoutByProgram.map(p => p.program),
    datasets: [
      {
        label: 'Voted',
        data: turnoutByProgram.map(p => p.voted),
        backgroundColor: '#3B82F6',
        borderRadius: 6,
      },
      {
        label: 'Not Voted',
        data: turnoutByProgram.map(p => p.total - p.voted),
        backgroundColor: '#E2E8F0',
        borderRadius: 6,
      },
    ],
  };

  // Chart data — Position Winners
  const positionChartData = {
    labels: positionBreakdown.map(p => p.position),
    datasets: [{
      label: 'Votes',
      data: positionBreakdown.map(p => p.totalVotes),
      backgroundColor: COLORS.slice(0, positionBreakdown.length),
      borderRadius: 6,
    }],
  };

  // Chart data — Doughnut turnout
  const doughnutData = {
    labels: ['Voted', 'Not Voted'],
    datasets: [{
      data: [totalVotesCast, totalVoters - totalVotesCast],
      backgroundColor: ['#3B82F6', '#E2E8F0'],
      borderWidth: 0,
    }],
  };

  // Print / Export report
  const handlePrintReport = () => { window.print(); };

  const handleDownloadReport = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/elections/${electionId}/report/pdf`, { headers });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${election?.title || 'election'}_analytics_report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Error downloading report:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
        Loading election analytics...
      </div>
    );
  }

  const isOngoing = election && election.status !== 'ended' && election.status !== 'completed';

  if (isOngoing) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href={`/admin/elections/dashboard?electionId=${electionId}`}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3"
          >
            <ArrowLeft size={14} /> Back to Election Command Center
          </Link>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <BarChart3 size={24} className="text-blue-600" />
            Election Analytics & Report
          </h2>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/30 rounded-3xl p-12 text-center">
          <EyeOff size={48} className="text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Analytics & Reports Locked</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
            This election poll is currently active ({election?.title}). Deep analytical queries and PDF report exports will be unlocked when the polls close.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-4">
            ⏳ Current status: <span className="uppercase font-bold">{election?.status}</span>
          </p>
          <button
            disabled={true}
            className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed flex items-center gap-1.5 mx-auto"
          >
            <Download size={16} /> Export Locked (Election Ongoing)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 print:gap-4">
      {/* Header */}
      <div className="print:hidden">
        <Link
          href={`/admin/elections/dashboard?electionId=${electionId}`}
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3"
        >
          <ArrowLeft size={14} /> Back to Election Command Center
        </Link>
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <BarChart3 size={24} className="text-blue-600" />
              Election Analytics & Report
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Interactive analytical queries and report generation for {election?.title || 'this election'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Filter size={14} /> {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <button
              onClick={handlePrintReport}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Printer size={14} /> Print Report
            </button>
            <button
              onClick={handleDownloadReport}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-colors flex items-center gap-1.5"
            >
              <Download size={14} /> Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm print:hidden">
          <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <Filter size={14} className="text-blue-600" /> Analytical Query Filters
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Position</label>
              <select
                value={positionFilter}
                onChange={e => setPositionFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Positions</option>
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Program</label>
              <select
                value={programFilter}
                onChange={e => setProgramFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Programs</option>
                {uniquePrograms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Level</label>
              <select
                value={levelFilter}
                onChange={e => setLevelFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Levels</option>
                {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {(positionFilter !== 'all' || programFilter !== 'all' || levelFilter !== 'all') && (
            <button
              onClick={() => { setPositionFilter('all'); setProgramFilter('all'); setLevelFilter('all'); setDateFrom(''); setDateTo(''); }}
              className="mt-3 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Voters', value: totalVoters, icon: Users, color: 'blue' },
          { label: 'Votes Cast', value: totalVotesCast, icon: Vote, color: 'emerald' },
          { label: 'Turnout', value: `${turnout}%`, icon: TrendingUp, color: turnout >= 50 ? 'emerald' : 'amber' },
          { label: 'Positions', value: totalPositions, icon: PieChart, color: 'purple' },
          { label: 'Candidates', value: totalCandidates, icon: Activity, color: 'pink' },
          { label: 'Alerts', value: fraudCount, icon: AlertTriangle, color: fraudCount > 0 ? 'red' : 'slate' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">{kpi.label}</span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white">{kpi.value}</span>
            </div>
            <div className={`p-2.5 bg-${kpi.color}-50 dark:bg-${kpi.color}-950/40 text-${kpi.color}-600 dark:text-${kpi.color}-400 rounded-xl`}>
              <kpi.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Turnout by Program */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" /> Voter Turnout by Program
          </h3>
          {turnoutByProgram.length > 0 ? (
            <div style={{ height: '280px' }}>
              <Bar data={programChartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { font: { size: 11, weight: 'bold' as const } } } },
                scales: {
                  x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' as const } } },
                  y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(148,163,184,0.15)' }, ticks: { stepSize: 1, font: { size: 10, weight: 'bold' as const } } },
                },
              }} />
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">No program data available</p>
          )}
          {/* Program breakdown table */}
          {turnoutByProgram.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                    <th className="pb-2 font-bold">Program</th>
                    <th className="pb-2 font-bold text-right">Total</th>
                    <th className="pb-2 font-bold text-right">Voted</th>
                    <th className="pb-2 font-bold text-right">Turnout</th>
                  </tr>
                </thead>
                <tbody>
                  {turnoutByProgram.map(p => (
                    <tr key={p.program} className="border-b border-slate-50 dark:border-slate-700/50">
                      <td className="py-1.5 font-semibold text-slate-900 dark:text-white">{p.program}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-300">{p.total}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-300">{p.voted}</td>
                      <td className="py-1.5 text-right">
                        <span className={`font-bold ${p.turnout >= 70 ? 'text-emerald-600' : p.turnout >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {p.turnout}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Turnout Doughnut + Level Breakdown */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChart size={18} className="text-emerald-600" /> Overall Participation
          </h3>
          <div className="flex flex-col items-center gap-4">
            <div style={{ width: '200px', height: '200px' }}>
              <Doughnut data={doughnutData} options={{
                responsive: true, maintainAspectRatio: true,
                cutout: '65%',
                plugins: {
                  legend: { position: 'bottom', labels: { font: { size: 11, weight: 'bold' as const }, padding: 16 } },
                },
              }} />
            </div>
            <div className="text-center">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{turnout}%</span>
              <p className="text-[11px] text-slate-400 font-medium">Overall Turnout</p>
            </div>
          </div>
          {/* Level breakdown */}
          {turnoutByLevel.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2">By Level</h4>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                    <th className="pb-2 font-bold">Level</th>
                    <th className="pb-2 font-bold text-right">Total</th>
                    <th className="pb-2 font-bold text-right">Voted</th>
                    <th className="pb-2 font-bold text-right">Turnout</th>
                  </tr>
                </thead>
                <tbody>
                  {turnoutByLevel.map(l => (
                    <tr key={l.level} className="border-b border-slate-50 dark:border-slate-700/50">
                      <td className="py-1.5 font-semibold text-slate-900 dark:text-white">{l.level}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-300">{l.total}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-300">{l.voted}</td>
                      <td className="py-1.5 text-right">
                        <span className={`font-bold ${l.turnout >= 70 ? 'text-emerald-600' : l.turnout >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {l.turnout}%
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

      {/* Position-by-Position Breakdown */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Activity size={18} className="text-purple-600" /> Position-by-Position Vote Analysis
        </h3>
        {positionBreakdown.length > 0 ? (
          <div className="space-y-4">
            {positionBreakdown.map((pos, pi) => (
              <div key={pos.position} className="border border-slate-100 dark:border-slate-700/50 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[pi % COLORS.length] }} />
                    {pos.position}
                  </h4>
                  <span className="text-[11px] font-bold text-slate-400">{pos.totalVotes} total votes</span>
                </div>
                <div className="space-y-2">
                  {pos.candidates.map((cand, ci) => {
                    const pct = pos.totalVotes > 0 ? Math.round(((cand.votes || 0) / pos.totalVotes) * 100) : 0;
                    const isLeader = ci === 0 && (cand.votes || 0) > 0;
                    return (
                      <div key={cand.id} className="flex items-center gap-3">
                        <div className="w-32 sm:w-40 text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {cand.ballotNumber ? `No. ${cand.ballotNumber} ` : ''}{cand.name}
                          {cand.isIndependent && (
                            <span className="ml-1 text-[9px] text-slate-400">(Yes/No)</span>
                          )}
                        </div>
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: isLeader ? '#F59E0B' : COLORS[(pi + ci) % COLORS.length],
                            }}
                          />
                        </div>
                        <div className="w-20 text-right text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          {cand.votes || 0} <span className="text-slate-400">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-8">No position data available</p>
        )}
      </div>

      {/* Activity Timeline */}
      {activityByDay.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm print:hidden">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={18} className="text-amber-600" /> Activity Timeline (Last 14 Days)
          </h3>
          <div style={{ height: '180px' }}>
            <Bar
              data={{
                labels: activityByDay.map(([d]) => d.slice(5)),
                datasets: [{
                  label: 'Actions',
                  data: activityByDay.map(([, c]) => c),
                  backgroundColor: '#F59E0B',
                  borderRadius: 4,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' as const } } },
                  y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.15)' }, ticks: { stepSize: 1, font: { size: 10 } } },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Report Footer */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 text-center print:hidden">
        <FileText size={24} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-400 font-medium">
          Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {' · '}{election?.title || 'Election'} Analytics Report
        </p>
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={handlePrintReport}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Printer size={14} /> Print This Report
          </button>
          <button
            onClick={handleDownloadReport}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-colors flex items-center gap-1.5"
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ElectionAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">Loading analytics...</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
