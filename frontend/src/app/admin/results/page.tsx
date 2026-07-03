'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { RefreshCw, ArrowLeft, Trophy } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

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

function ElectionChart({ result }: { result: ElectionResult }) {
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
    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
      {/* Election header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <Trophy size={16} color={COLORS[0]} />
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>{election.title}</h3>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            <span>{candidates.length} candidate{candidates.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{totalVotes.toLocaleString()} total vote{totalVotes !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <span
          style={{
            padding: '2px 10px',
            borderRadius: '999px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            background: `${statusColors[election.status] || '#94a3b8'}22`,
            color: statusColors[election.status] || '#94a3b8',
            border: `1px solid ${statusColors[election.status] || '#94a3b8'}44`,
            textTransform: 'capitalize',
          }}
        >
          {election.status === 'active' && <span style={{ marginRight: 4 }}>●</span>}
          {election.status}
        </span>
      </div>

      {candidates.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-8) 0' }}>
          No candidates registered for this election.
        </p>
      ) : (
        <>
          {/* Bar chart */}
          <div style={{ height: `${Math.max(200, sorted.length * 48)}px`, position: 'relative', marginBottom: 'var(--space-6)' }}>
            <Bar data={barData} options={barOptions} />
          </div>

          {/* Rankings */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rankings</p>
            {sorted.map((cand, idx) => {
              const pct = totalVotes > 0 ? Math.round(((cand.votes || 0) / totalVotes) * 100) : 0;
              return (
                <div key={cand.id} style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
                    <span style={{ fontWeight: idx === 0 ? 700 : 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: COLORS[idx % COLORS.length],
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {idx + 1}
                      </span>
                      {cand.name}
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 'var(--text-xs)' }}>({cand.position})</span>
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{(cand.votes || 0).toLocaleString()} votes · {pct}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: COLORS[idx % COLORS.length],
                      borderRadius: '999px',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminResultsPage() {
  const [results, setResults] = useState<ElectionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchAll() {
    try {
      const electionsRes = await apiRequest<{ status: string; data: Election[] }>('/elections');
      if (electionsRes.status !== 'success' || !electionsRes.data.length) {
        setResults([]);
        return;
      }

      const elections = electionsRes.data;

      // Fetch candidates for every election in parallel
      const settled = await Promise.allSettled(
        elections.map(election =>
          apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${election.id}`)
        )
      );

      const newResults: ElectionResult[] = elections.map((election, i) => {
        const res = settled[i];
        const candidates = res.status === 'fulfilled' && res.value.status === 'success'
          ? res.value.data
          : [];
        const totalVotes = candidates.reduce((s, c) => s + (c.votes || 0), 0);
        return { election, candidates, totalVotes };
      });

      setResults(newResults);
    } catch (err) {
      console.error('[Results] Error fetching:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div className="animate-page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <Link href="/admin/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={14} /> Return to Dashboard
          </Link>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>Live Results Monitor</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
            <span style={{ width: '6px', height: '6px', background: 'var(--color-success)', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            All elections · Live (5s refresh)
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          <RefreshCw size={14} className="animate-spin-slow" />
          {results.length} election{results.length !== 1 ? 's' : ''} tracked
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading results...</p>
      ) : results.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No elections found. Create an election to see results here.</p>
        </div>
      ) : (
        results.map(result => (
          <ElectionChart key={result.election.id} result={result} />
        ))
      )}
    </div>
  );
}
