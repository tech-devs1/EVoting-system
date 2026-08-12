'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { 
  ArrowLeft, 
  Send, 
  Download, 
  Trophy, 
  Vote, 
  Users, 
  RefreshCw, 
  CheckCircle2, 
  BarChart3 
} from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  votes: number;
  noVotes?: number;
  isIndependent?: boolean;
  photoUrl?: string;
}

interface Election {
  id: string;
  title: string;
  status: string;
  totalVoters?: number;
  totalVotesCast?: number;
}

export default function PerElectionResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const electionId = resolvedParams.id;

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 means off

  async function fetchResultsData(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
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
      }
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  // Handle manual sync
  const handleManualSync = async () => {
    setSyncing(true);
    await fetchResultsData(false);
    setSyncing(false);
  };

  useEffect(() => {
    if (electionId) fetchResultsData();
  }, [electionId]);

  // Set up auto-refresh polling
  useEffect(() => {
    if (!electionId || autoRefreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchResultsData(false);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [electionId, autoRefreshInterval]);

  // Download Results PDF Action
  const [pdfLoading, setPdfLoading] = useState(false);
  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/elections/${electionId}/results/pdf`, {
        headers
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${election?.title || 'election'}_results.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage({ type: 'success', text: 'Election results PDF generated and downloaded successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to generate PDF results.' });
    } finally {
      setPdfLoading(false);
    }
  };

  // Group Candidates by Position
  const positionsMap: Record<string, Candidate[]> = {};
  candidates.forEach(c => {
    const pos = c.position || 'General';
    if (!positionsMap[pos]) positionsMap[pos] = [];
    positionsMap[pos].push(c);
  });

  const totalVotesCast = election?.totalVotesCast || 0;
  const totalVoters = election?.totalVoters || 0;
  const turnout = totalVoters > 0 ? Math.min(100, Math.round((totalVotesCast / totalVoters) * 100)) : 0;

  return (
  return (
    <div className="flex flex-col gap-6">
      {/* Banner */}
      <div>
        <Link href={`/admin/elections/${electionId}/dashboard`} className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Election Command Center
        </Link>
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Live Results & Tallies
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Real-time candidate vote tallies and certified results broadcast
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Auto-Refresh:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold mr-2"
            >
              <option value={0}>Off</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>

            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? 'Syncing...' : 'Sync Live Tally'}
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-colors flex items-center gap-1.5"
            >
              <Download size={16} /> {pdfLoading ? 'Generating PDF...' : 'Download Results PDF'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold ${
          message.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' 
            : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
        }`}>
          {message.text}
        </div>
      )}

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Ballots Cast</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalVotesCast}</span>
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1"><span>{turnout}% Live Turnout</span></div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Vote size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Total Roster</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalVoters}</span>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1"><span>Eligible voters</span></div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Contested Positions</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{Object.keys(positionsMap).length}</span>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1"><span>Ballot categories</span></div>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
            <BarChart3 size={22} />
          </div>
        </div>
      </div>

      {/* Position-by-Position Tally Breakdown */}
      {loading ? (
        <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading live vote tallies...</p>
      ) : Object.keys(positionsMap).length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
          No candidate vote records available yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(positionsMap).map(([positionTitle, candidateList]) => {
            // Sort by highest votes first
            const sortedCandidates = [...candidateList].sort((a, b) => (b.votes || 0) - (a.votes || 0));
            const highestVotes = sortedCandidates[0]?.votes || 0;

            return (
              <div key={positionTitle} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
                  <Trophy size={18} className="text-amber-500" />
                  {positionTitle}
                </h3>

                <div className="flex flex-col gap-3">
                  {sortedCandidates.map((cand, idx) => {
                    const votes = cand.votes || 0;
                    const positionTotal = candidateList.reduce((sum, c) => sum + (c.votes || 0), 0);
                    const pct = positionTotal > 0 ? Math.round((votes / positionTotal) * 100) : 0;
                    const isLeader = idx === 0 && votes > 0;

                    return (
                      <div 
                        key={cand.id} 
                        className={`p-4 rounded-2xl border flex flex-col gap-3 transition-colors ${
                          isLeader 
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/40' 
                            : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/80'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-extrabold text-xs text-slate-700 dark:text-slate-200 overflow-hidden shrink-0">
                              {cand.photoUrl ? (
                                <img src={cand.photoUrl} alt={cand.name} className="w-full h-full object-cover" />
                              ) : (
                                cand.name.substring(0, 2).toUpperCase()
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-slate-900 dark:text-white">{cand.name}</span>
                                {isLeader && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                    🏆 LEADER
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white block">{votes} votes</span>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{pct}% of position</span>
                          </div>
                        </div>

                        {/* Animated Vote Progress Bar */}
                        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isLeader ? 'bg-amber-500' : 'bg-blue-600'}`} 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
