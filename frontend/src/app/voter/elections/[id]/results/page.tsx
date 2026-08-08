'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { ArrowLeft, Trophy, EyeOff, XCircle } from 'lucide-react';
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
  noVotes?: number;
  isIndependent?: boolean;
  ballotNumber?: string | number;
}

interface Election {
  id: string;
  title: string;
  status: string;
  showResults?: boolean;
  description?: string;
}

function PositionChart({
  position,
  candidates,
  colorOffset,
}: {
  position: string;
  candidates: Candidate[];
  colorOffset: number;
}) {
  const sorted = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const positionTotal = sorted.reduce((s, c) => s + (c.votes || 0) + (c.noVotes || 0), 0);

  const topVotes = sorted[0]?.votes || 0;
  const isTied = positionTotal > 0 && sorted.filter(c => (c.votes || 0) === topVotes).length > 1;
  const isIndependentTied = positionTotal > 0 && sorted.length === 1 && !!sorted[0].isIndependent && (sorted[0].votes || 0) === (sorted[0].noVotes || 0);

  const chartLabels: string[] = [];
  const chartVotes: number[] = [];
  const chartColors: string[] = [];

  sorted.forEach((c, i) => {
    const prefix = c.ballotNumber ? `No. ${c.ballotNumber} ` : '';
    if (c.isIndependent) {
      chartLabels.push(`${prefix}${c.name} (Yes)`);
      chartVotes.push(c.votes || 0);
      chartColors.push('#10B981');

      chartLabels.push(`${prefix}${c.name} (No)`);
      chartVotes.push(c.noVotes || 0);
      chartColors.push('#EF4444');
    } else {
      chartLabels.push(`${prefix}${c.name}`);
      chartVotes.push(c.votes || 0);
      chartColors.push(COLORS[(colorOffset + i) % COLORS.length]);
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
            const pct = positionTotal > 0 ? ((ctx.raw / positionTotal) * 100).toFixed(1) : '0.0';
            return ` ${ctx.raw} votes (${pct}% of position)`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { stepSize: 1, color: 'var(--text-tertiary)' },
      },
      x: {
        grid: { display: false },
        ticks: { color: 'var(--text-secondary)' },
      },
    },
  };

  const leader = sorted[0];
  const accentColor = COLORS[colorOffset % COLORS.length];

  return (
    <div style={{
      marginBottom: 'var(--space-6)',
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)',
      background: 'var(--bg-card)',
    }}>
      {/* Position header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: accentColor,
            display: 'inline-block', flexShrink: 0,
          }} />
          <h4 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700 }}>{position}</h4>
          <span style={{
            fontSize: 'var(--text-xs)', padding: '2px 8px',
            borderRadius: '999px', background: 'var(--bg-input)',
            border: '1px solid var(--border-color)', color: 'var(--text-tertiary)',
          }}>
            {sorted.length} candidate{sorted.length !== 1 ? 's' : ''}
          </span>
          {isTied && (
            <span style={{
              fontSize: 'var(--text-xs)', padding: '2px 8px',
              borderRadius: '999px', background: '#F59E0B22',
              border: '1px solid #F59E0B44', color: '#F59E0B',
              fontWeight: 600,
            }}>
              ⚖ Tied
            </span>
          )}
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          {positionTotal.toLocaleString()} vote{positionTotal !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Leader callout */}
      {leader && positionTotal > 0 && !isTied && !isIndependentTied && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: leader.isIndependent && (leader.noVotes || 0) > (leader.votes || 0) ? '#EF444418' : `${accentColor}18`,
          border: `1px solid ${leader.isIndependent && (leader.noVotes || 0) > (leader.votes || 0) ? '#EF444444' : accentColor + '44'}`,
        }}>
          {leader.isIndependent && (leader.noVotes || 0) > (leader.votes || 0) ? (
            <XCircle size={14} color="#EF4444" />
          ) : (
            <Trophy size={14} color={accentColor} />
          )}
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: leader.isIndependent && (leader.noVotes || 0) > (leader.votes || 0) ? '#EF4444' : accentColor }}>
            {leader.ballotNumber ? `No. ${leader.ballotNumber} - ` : ''}{leader.name}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            {leader.isIndependent && (leader.noVotes || 0) > (leader.votes || 0) ? (
              <>losing by {(((leader.noVotes || 0) / positionTotal) * 100).toFixed(1)}%</>
            ) : (
              <>leading with {(leader.votes || 0).toLocaleString()} vote{(leader.votes || 0) !== 1 ? 's' : ''}
              {' '}({positionTotal > 0 ? (((leader.votes || 0) / positionTotal) * 100).toFixed(1) : 0}%)</>
            )}
          </span>
        </div>
      )}

      {/* Tie callout */}
      {isTied && positionTotal > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: '#F59E0B18',
          border: '1px solid #F59E0B44',
        }}>
          <span style={{ fontSize: '14px' }}>⚖️</span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#F59E0B' }}>
            Tie — {sorted.filter(c => (c.votes || 0) === topVotes).map(c => `${c.ballotNumber ? `No. ${c.ballotNumber} ` : ''}${c.name}`).join(' & ')}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            each with {topVotes.toLocaleString()} vote{topVotes !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Independent Tie callout */}
      {isIndependentTied && positionTotal > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: '#F59E0B18',
          border: '1px solid #F59E0B44',
        }}>
          <span style={{ fontSize: '14px' }}>⚖️</span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#F59E0B' }}>
            Tie — {leader.ballotNumber ? `No. ${leader.ballotNumber} ` : ''}{leader.name}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Yes and No votes are tied at {(leader.votes || 0).toLocaleString()}
          </span>
        </div>
      )}

      {/* Bar chart */}
      <div style={{ height: `${Math.max(160, sorted.length * 44)}px`, position: 'relative', marginBottom: 'var(--space-4)' }}>
        <Bar data={barData} options={barOptions} />
      </div>

      {/* Rankings */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
        {sorted.map((cand, idx) => {
          const pct = positionTotal > 0 ? Math.round(((cand.votes || 0) / positionTotal) * 100) : 0;
          const color = COLORS[(colorOffset + idx) % COLORS.length];
          const isWinner = idx === 0 && !isTied && positionTotal > 0;
          const isCandTied = isTied && (cand.votes || 0) === topVotes;
          return (
            <div key={cand.id} style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
                <span style={{ fontWeight: isWinner || isCandTied ? 700 : 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: color,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {idx + 1}
                  </span>
                  {cand.ballotNumber ? `No. ${cand.ballotNumber} - ` : ''}{cand.name}
                  {isWinner && <span style={{ fontSize: '12px' }}>🏆</span>}
                  {isCandTied && (
                    <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 600 }}>⚖</span>
                  )}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{(cand.votes || 0).toLocaleString()} · {pct}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: color,
                  borderRadius: '999px',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VoterResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const electionId = resolvedParams.id;

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const elRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
        if (elRes.status === 'success') {
          setElection(elRes.data);
        }

        const candRes = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`);
        if (candRes.status === 'success') {
          setCandidates(candRes.data);
        }
      } catch (err) {
        console.error('Error fetching results:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [electionId]);

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading live results...</p>;
  }

  if (!election) {
    return (
      <div className="empty-state">
        <h3>Election Not Found</h3>
        <p>No valid election parameters were passed to this terminal session.</p>
        <Link href="/voter/elections" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
          Back to Elections
        </Link>
      </div>
    );
  }

  // Double check client-side block just in case
  if (!election.showResults) {
    return (
      <div className="empty-state animate-page-enter">
        <EyeOff size={48} style={{ color: 'var(--color-warning, #f59e0b)', marginBottom: 'var(--space-4)' }} />
        <h3>Results View Disabled</h3>
        <p style={{ maxWidth: '480px', margin: '0 auto var(--space-4)' }}>
          Live results for "{election.title}" are currently hidden. The administrator has disabled public charts prior to the official declaration of results.
        </p>
        <Link href="/voter/elections" className="btn btn-primary">
          Return to Elections List
        </Link>
      </div>
    );
  }

  // Group by position
  const positionGroups: Record<string, Candidate[]> = {};
  candidates.forEach(c => {
    if (!positionGroups[c.position]) positionGroups[c.position] = [];
    positionGroups[c.position].push(c);
  });
  const positions = Object.keys(positionGroups);
  const totalVotes = candidates.reduce((s, c) => s + (c.votes || 0), 0);

  return (
    <div className="animate-page-enter">
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link href="/voter/elections" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-3)' }}>
          <ArrowLeft size={14} /> Return to Elections
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>{election.title} — Results</h2>
            <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              <span>{candidates.length} candidate{candidates.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{positions.length} position{positions.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{totalVotes.toLocaleString()} total vote{totalVotes !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <span style={{
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            background: 'var(--color-success-bg, #22c55e22)',
            color: 'var(--color-success, #22c55e)',
            border: '1px solid var(--color-success-border, #22c55e44)',
          }}>
            ● Live Charts
          </span>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No candidates registered for this election.</p>
        </div>
      ) : (
        positions.map((position, pi) => (
          <PositionChart
            key={position}
            position={position}
            candidates={positionGroups[position]}
            colorOffset={pi * 3}
          />
        ))
      )}
    </div>
  );
}
