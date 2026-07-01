'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

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

  // Fetch candidates whenever election selection changes
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

    // Simulate real-time vote streaming
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCandidates(prev => {
        const updated = prev.map(c => ({
          ...c,
          votes: (c.votes || 0) + Math.floor(Math.random() * 3)
        }));
        const newTotal = updated.reduce((sum, c) => sum + c.votes, 0);
        setTotalVotes(newTotal);
        return updated;
      });
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedElectionId]);

  const selectedElection = elections.find(e => e.id === selectedElectionId);

  const chartData = {
    labels: candidates.map(c => c.name),
    datasets: [{
      data: candidates.map(c => c.votes || 0),
      backgroundColor: ['#2563EB', '#7C3AED', '#10B981', '#F59E0B'],
      borderWidth: 0,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } }
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
            <RefreshCw size={14} className="animate-spin-slow" /> Stream active (2s auto-refresh)
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading results stream...</p>
      ) : (
        <div className="admin-grid-charts" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
          {/* Live Rank Progress Indicators */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-6)' }}>Candidate Vote Standings</h3>
            <div className="rankings-list">
              {candidates.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No candidates registered for this election.</p>
              ) : (
                candidates.map((cand, idx) => {
                  const percentage = totalVotes > 0 ? Math.round(((cand.votes || 0) / totalVotes) * 100) : 0;
                  const colors = ['#2563EB', '#7C3AED', '#10B981', '#F59E0B'];
                  return (
                    <div className="ranking-item" key={cand.id} style={{ marginBottom: 'var(--space-4)' }}>
                      <div className="ranking-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                        <span style={{ fontWeight: 'var(--weight-semibold)' }}>{cand.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>({cand.position})</span></span>
                        <span>{(cand.votes || 0).toLocaleString()} votes ({percentage}%)</span>
                      </div>
                      <div className="ranking-progress-bg" style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div
                          className="ranking-progress-bar"
                          style={{
                            width: `${percentage}%`,
                            height: '100%',
                            background: colors[idx % colors.length],
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

          {/* Vote Share Donut Chart */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-6)' }}>Vote Share Breakdown</h3>
            <div style={{ height: '280px', position: 'relative' }}>
              {candidates.length > 0 ? (
                <Doughnut data={chartData} options={chartOptions} />
              ) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 'var(--space-8)' }}>No vote data available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
