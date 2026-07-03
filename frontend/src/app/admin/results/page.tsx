'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { RefreshCw, ArrowLeft, Trophy, Download } from 'lucide-react';
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

// ---- Per-position chart sub-component ----
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
  const positionTotal = sorted.reduce((s, c) => s + (c.votes || 0), 0);

  // Tie detection: multiple candidates share the highest vote count
  const topVotes = sorted[0]?.votes || 0;
  const isTied = positionTotal > 0 && sorted.filter(c => (c.votes || 0) === topVotes).length > 1;

  const barData = {
    labels: sorted.map(c => c.name),
    datasets: [{
      label: 'Votes',
      data: sorted.map(c => c.votes || 0),
      backgroundColor: sorted.map((_, i) => COLORS[(colorOffset + i) % COLORS.length]),
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

      {/* Leader callout — hidden when tied */}
      {leader && positionTotal > 0 && !isTied && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: `${accentColor}18`,
          border: `1px solid ${accentColor}44`,
        }}>
          <Trophy size={14} color={accentColor} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: accentColor }}>
            {leader.name}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            leading with {(leader.votes || 0).toLocaleString()} vote{(leader.votes || 0) !== 1 ? 's' : ''}
            {' '}({positionTotal > 0 ? (((leader.votes || 0) / positionTotal) * 100).toFixed(1) : 0}%)
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
            Tie — {sorted.filter(c => (c.votes || 0) === topVotes).map(c => c.name).join(' & ')}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            each with {topVotes.toLocaleString()} vote{topVotes !== 1 ? 's' : ''}
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
                  {cand.name}
                  {/* Trophy only when there is a clear sole winner */}
                  {isWinner && <span style={{ fontSize: '12px' }}>🏆</span>}
                  {/* Tie badge instead */}
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

// ---- Per-election wrapper ----
function ElectionChart({ 
  result, 
  onDownloadPdf 
}: { 
  result: ElectionResult; 
  onDownloadPdf: (id: string, title: string) => void;
}) {
  const { election, candidates, totalVotes } = result;

  // Group by position (preserve insertion order)
  const positionGroups: Record<string, Candidate[]> = {};
  candidates.forEach(c => {
    if (!positionGroups[c.position]) positionGroups[c.position] = [];
    positionGroups[c.position].push(c);
  });
  const positions = Object.keys(positionGroups);

  const statusColors: Record<string, string> = {
    active: '#10B981',
    completed: '#6366F1',
    draft: '#F59E0B',
  };

  return (
    <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
      {/* Election header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <Trophy size={18} color={COLORS[0]} />
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>{election.title}</h3>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            <span>{candidates.length} candidate{candidates.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{positions.length} position{positions.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{totalVotes.toLocaleString()} total vote{totalVotes !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onDownloadPdf(election.id, election.title)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', padding: '4px 10px' }}
          >
            <Download size={12} /> Download PDF
          </button>
          <span style={{
            padding: '2px 10px', borderRadius: '999px',
            fontSize: 'var(--text-xs)', fontWeight: 600,
            background: `${statusColors[election.status] || '#94a3b8'}22`,
            color: statusColors[election.status] || '#94a3b8',
            border: `1px solid ${statusColors[election.status] || '#94a3b8'}44`,
            textTransform: 'capitalize',
          }}>
            {election.status === 'active' && <span style={{ marginRight: 4 }}>●</span>}
            {election.status}
          </span>
        </div>
      </div>

      {candidates.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-8) 0' }}>
          No candidates registered for this election.
        </p>
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

  const handleDownloadPdf = async (elId: string, elTitle: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/elections/${elId}/report/pdf`, {
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Report download failed:', response.status, errorText);
        throw new Error('Failed to download PDF report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${elTitle.replace(/[^a-zA-Z0-9]/g, '_')}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error downloading report:', err);
      alert('Failed to download report: ' + err.message);
    }
  };

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
          <ElectionChart key={result.election.id} result={result} onDownloadPdf={handleDownloadPdf} />
        ))
      )}
    </div>
  );
}
