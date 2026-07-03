'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { RefreshCw, ArrowLeft } from 'lucide-react';
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

export default function AdminResultsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVotes, setTotalVotes] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch elections list on mount
  useEffect(() => {
    async function fetchElections() {
      try {
        const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
        if (res.status === 'success' && res.data.length > 0) {
          setElections(res.data);
          const activeOne = res.data.find(e => e.status === 'active');
          setSelectedElectionId(activeOne?.id || res.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching elections for results:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchElections();
  }, []);

  // Fetch real candidate vote counts whenever election selection changes (polls every 5s)
  useEffect(() => {
    if (!selectedElectionId) return;

    async function fetchCandidates() {
      try {
        const res = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${selectedElectionId}`);
        if (res.status === 'success') {
          setCandidates(res.data);
          const total = res.data.reduce((sum, c) => sum + (c.votes || 0), 0);
          setTotalVotes(total);
        }
      } catch (err) {
        console.error('Error fetching candidates for results:', err);
      }
    }

    fetchCandidates();

    // Poll real data every 5 seconds
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchCandidates, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedElectionId]);

  const selectedElection = elections.find(e => e.id === selectedElectionId);

  const COLORS = ['#3B82F6', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#F97316'];

  const barChartData = {
    labels: candidates.map(c => c.name),
    datasets: [{
      label: 'Votes',
      data: candidates.map(c => c.votes || 0),
      backgroundColor: candidates.map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 6,
      borderSkipped: false,
    }]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const pct = totalVotes > 0 ? ((ctx.raw / totalVotes) * 100).toFixed(1) : '0.0';
            return ` ${ctx.raw} votes (${pct}%)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { stepSize: 1 }
      },
      x: { grid: { display: false } }
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
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>
            {selectedElection?.title || 'Live Results Monitor'}
          </h2>
          <div className="live-indicator" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
            <span style={{ width: '6px', height: '6px', background: 'var(--color-success)', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
            Live Vote Streaming
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <select
            className="form-input"
            value={selectedElectionId}
            onChange={e => setSelectedElectionId(e.target.value)}
            style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-3)' }}
          >
            {elections.map(el => (
              <option key={el.id} value={el.id}>{el.title}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <RefreshCw size={14} className="animate-spin-slow" /> Live (5s refresh)
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading results stream...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

          {/* Bar Chart - Real-time vote counts */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)' }}>
              Real-Time Vote Standings
            </h3>
            <div style={{ height: '320px', position: 'relative' }}>
              {candidates.length > 0 ? (
                <Bar data={barChartData} options={barChartOptions} />
              ) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 'var(--space-8)' }}>No candidates registered for this election.</p>
              )}
            </div>
          </div>

          {/* Progress bars ranking */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-6)' }}>Candidate Rankings</h3>
            <div className="rankings-list">
              {candidates.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No candidates registered for this election.</p>
              ) : (
                [...candidates]
                  .sort((a, b) => (b.votes || 0) - (a.votes || 0))
                  .map((cand, idx) => {
                    const percentage = totalVotes > 0 ? Math.round(((cand.votes || 0) / totalVotes) * 100) : 0;
                    return (
                      <div className="ranking-item" key={cand.id} style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="ranking-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                          <span style={{ fontWeight: 'var(--weight-semibold)' }}>
                            #{idx + 1} {cand.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>({cand.position})</span>
                          </span>
                          <span>{(cand.votes || 0).toLocaleString()} votes ({percentage}%)</span>
                        </div>
                        <div className="ranking-progress-bg" style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div
                            className="ranking-progress-bar"
                            style={{
                              width: `${percentage}%`,
                              height: '100%',
                              background: COLORS[idx % COLORS.length],
                              borderRadius: 'var(--radius-full)',
                              transition: 'width 0.5s ease'
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
