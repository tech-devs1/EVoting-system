'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { getEffectiveStatus } from '@/lib/electionStatus';
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
      borderRadius: 8,
      borderSkipped: false as const,
    }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleFont: { size: 13, weight: 'bold' as const },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 12,
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
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: { stepSize: 1, color: '#64748B', font: { size: 11, weight: 'bold' as const } },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748B', font: { size: 11, weight: 'bold' as const } },
      },
    },
  };

  const leader = sorted[0];
  const accentColor = COLORS[colorOffset % COLORS.length];

  return (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 mb-6 shadow-sm">
      {/* Position Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{position}</h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {sorted.length} candidate{sorted.length !== 1 ? 's' : ''}
          </span>
          {isTied && (
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
              ⚖ Tied
            </span>
          )}
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {positionTotal.toLocaleString()} total vote{positionTotal !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Leader Callout */}
      {leader && positionTotal > 0 && !isTied && !isIndependentTied && (
        <div className={`flex items-center gap-2.5 mb-5 px-4 py-2.5 rounded-xl border text-xs font-bold ${
          leader.isIndependent && (leader.noVotes || 0) > (leader.votes || 0)
            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30'
            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30'
        }`}>
          {leader.isIndependent && (leader.noVotes || 0) > (leader.votes || 0) ? (
            <XCircle size={16} className="text-red-500 shrink-0" />
          ) : (
            <Trophy size={16} className="text-amber-500 shrink-0" />
          )}
          <span>
            {leader.ballotNumber ? `No. ${leader.ballotNumber} - ` : ''}{leader.name}
          </span>
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {leader.isIndependent && (leader.noVotes || 0) > (leader.votes || 0) ? (
              <>losing by {(((leader.noVotes || 0) / positionTotal) * 100).toFixed(1)}%</>
            ) : (
              <>leading with {(leader.votes || 0).toLocaleString()} votes ({positionTotal > 0 ? (((leader.votes || 0) / positionTotal) * 100).toFixed(1) : 0}%)</>
            )}
          </span>
        </div>
      )}

      {/* Bar Chart Container */}
      <div className="w-full relative mb-6" style={{ height: `${Math.max(200, sorted.length * 56)}px` }}>
        <Bar data={barData} options={barOptions} />
      </div>

      {/* Candidate Breakdown & Progress Bars */}
      <div className="border-t border-slate-100 dark:border-slate-700/60 pt-4 flex flex-col gap-4">
        {sorted.map((cand, idx) => {
          const isSingleCandidate = sorted.length === 1;
          const yesVotes = cand.votes || 0;
          const noVotes = cand.noVotes || 0;
          const pct = positionTotal > 0 ? Math.round((yesVotes / positionTotal) * 100) : 0;
          const noPct = positionTotal > 0 ? Math.round((noVotes / positionTotal) * 100) : 0;
          const color = COLORS[(colorOffset + idx) % COLORS.length];
          const isWinner = idx === 0 && !isTied && positionTotal > 0 && !isIndependentTied;
          const isCandTied = isTied && (cand.votes || 0) === topVotes;
          const isRejected = isSingleCandidate && noVotes > yesVotes;

          return (
            <div key={cand.id} className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: color }}>
                    {idx + 1}
                  </span>
                  <span className={`font-bold text-slate-900 dark:text-white ${isWinner && !isRejected ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    {cand.ballotNumber ? `No. ${cand.ballotNumber} - ` : ''}{cand.name}
                  </span>
                  {isWinner && !isRejected && <Trophy size={14} className="text-amber-500" />}
                  {isRejected && <XCircle size={14} className="text-red-500" />}
                  {isCandTied && <span className="text-amber-500 font-bold">⚖</span>}
                </div>
              </div>

              {isSingleCandidate ? (
                <>
                  {/* Yes votes */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                      ✅ Yes
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      {yesVotes.toLocaleString()} votes · <span className="text-slate-500">{pct}%</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>

                  {/* No votes */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                      ❌ No
                    </span>
                    <span className="font-bold text-red-700 dark:text-red-300">
                      {noVotes.toLocaleString()} votes · <span className="text-slate-500">{noPct}%</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 bg-red-500" style={{ width: `${noPct}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {yesVotes.toLocaleString()} votes · <span className="text-slate-500">{pct}%</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VoterResultsContent() {
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!electionId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const res = await apiRequest<{
          status: string;
          data: {
            election: Election;
            candidates: Candidate[];
            totalVotes: number;
          };
        }>(`/elections/${electionId}/results`);

        if (res.status === 'success' && res.data) {
          setElection(res.data.election);
          setCandidates(res.data.candidates);
        } else {
          const elRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
          if (elRes.status === 'success') {
            setElection(elRes.data);
          }
          const candRes = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`);
          if (candRes.status === 'success') {
            setCandidates(candRes.data);
          }
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
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium text-xs">
        Loading live results...
      </div>
    );
  }

  if (!election) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Election Not Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">No valid election parameters were passed to this terminal session.</p>
        <Link href="/voter/elections" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors">
          Back to Elections
        </Link>
      </div>
    );
  }

  if (!election.showResults || getEffectiveStatus(election) !== 'ended') {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-lg mx-auto">
        <EyeOff size={48} className="text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Results View Disabled</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
          Results for "{election.title}" are not available yet. Results will be visible once the election polling period has ended.
        </p>
        <Link href="/voter/elections" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors">
          Return to Elections List
        </Link>
      </div>
    );
  }

  const positionGroups: Record<string, Candidate[]> = {};
  candidates.forEach(c => {
    if (!positionGroups[c.position]) positionGroups[c.position] = [];
    positionGroups[c.position].push(c);
  });
  const positions = Object.keys(positionGroups);
  const totalVotes = candidates.reduce((s, c) => s + (c.votes || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/voter/elections" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
          <ArrowLeft size={14} /> Return to Elections
        </Link>
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
              {election.title} — Results
            </h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>{candidates.length} candidates</span>
              <span>·</span>
              <span>{positions.length} positions</span>
              <span>·</span>
              <span>{totalVotes.toLocaleString()} total votes</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
            ● Live Charts
          </span>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400 font-medium text-xs">
          No candidates registered for this election.
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

export default function VoterResultsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">Loading live results...</div>}>
      <VoterResultsContent />
    </Suspense>
  );
}
