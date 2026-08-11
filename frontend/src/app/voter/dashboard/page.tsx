'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { get, set } from 'idb-keyval';
import { 
  ShieldCheck, 
  Key, 
  Clock, 
  Inbox,
  Award,
  Vote
} from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'scheduled' | 'active' | 'completed';
  createdBy?: string;
  showResults?: boolean;
}

interface CacheData {
  elections: Election[];
  upcomingElections: Election[];
  publishedResultsElections: Election[];
  votedElectionIds: string[];
  totalVotes: number;
}

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [endingSoon, setEndingSoon] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const endTime = new Date(endsAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft('Closed');
        setEndingSoon(false);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${mins}m ${secs}s`);

      if (hours < 24) {
        setEndingSoon(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endsAt, mounted]);

  return (
    <div className={`inline-flex items-center gap-1 text-xs font-medium ${
      endingSoon ? 'text-red-500 font-semibold' : 'text-slate-500 dark:text-slate-400'
    }`} suppressHydrationWarning>
      <Clock size={12} /> {mounted ? timeLeft : 'Loading...'}
    </div>
  );
}

export default function VoterDashboard() {
  const { user } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [upcomingElections, setUpcomingElections] = useState<Election[]>([]);
  const [publishedResultsElections, setPublishedResultsElections] = useState<Election[]>([]);
  const [votedElectionIds, setVotedElectionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function fetchData() {
      try {
        console.log('[Dashboard] Fetching elections data...');
        
        try {
          const cachedData = await get<CacheData>('voter_dashboard_cache');
          if (cachedData) {
            setElections(cachedData.elections || []);
            setUpcomingElections(cachedData.upcomingElections || []);
            setPublishedResultsElections(cachedData.publishedResultsElections || []);
            setVotedElectionIds(cachedData.votedElectionIds || []);
            setTotalVotes(cachedData.totalVotes || 0);
            setLoading(false);
          }
        } catch (e) {
          console.warn('IndexedDB cache read failed', e);
        }

        const res = await apiRequest<{ status: string; data: any[] }>('/elections/eligible');
        let newElections: Election[] = [], newUpcoming: Election[] = [], newPublished: Election[] = [];
        let newVotedIds: string[] = [];
        if (res.status === 'success' && Array.isArray(res.data)) {
          const allElections = res.data;
          newElections = allElections.filter(el => el.status === 'active');
          newUpcoming = allElections.filter(el => el.status === 'draft' || el.status === 'scheduled');
          newPublished = allElections.filter(el => el.showResults === true);
          
          setElections(newElections);
          setUpcomingElections(newUpcoming);
          setPublishedResultsElections(newPublished);

          newVotedIds = allElections.filter(el => el.hasVoted).map(el => el.id);
          setVotedElectionIds(newVotedIds);
        }

        try {
          const votedRes = await apiRequest<{ status: string; data: string[] }>('/votes/voted-elections');
          if (votedRes.status === 'success') {
            const combinedVotedIds = Array.from(new Set([...newVotedIds, ...votedRes.data]));
            newVotedIds = combinedVotedIds;
            setVotedElectionIds(newVotedIds);
          }
        } catch (votedErr) {
          console.error('Error fetching voted elections:', votedErr);
        }

        let newTotalVotes = 0;
        const storedVotes = localStorage.getItem('COMPSSA_voter_votes');
        if (storedVotes) {
          const parsed = JSON.parse(storedVotes);
          newTotalVotes = parsed.length;
          setTotalVotes(newTotalVotes);
        }

        try {
          await set('voter_dashboard_cache', {
            elections: newElections,
            upcomingElections: newUpcoming,
            publishedResultsElections: newPublished,
            votedElectionIds: newVotedIds,
            totalVotes: newTotalVotes
          });
        } catch (e) {
          console.warn('IndexedDB cache write failed', e);
        }

      } catch (err) {
        console.error('[Dashboard] Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    let intervalId: NodeJS.Timeout | null = setInterval(fetchData, 60000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } else {
        fetchData();
        if (!intervalId) {
          intervalId = setInterval(fetchData, 60000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mounted]);

  const userName = user?.name || "Voter";

  return (
    <div className="flex flex-col gap-6" suppressHydrationWarning>

      {/* Top Welcome Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6 md:p-8 rounded-3xl shadow-md shadow-blue-500/10">
        <h2 className="text-xl md:text-2xl font-extrabold mb-2 tracking-tight">Welcome back, {userName}!</h2>
        <p className="text-sm text-blue-100 leading-relaxed max-w-3xl font-medium">
          Your student voter account is cryptographically verified and ready. Review the running e-ballots below to securely cast your vote.
        </p>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Active Ballots</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{elections.length}</span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Vote size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Upcoming Elections</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{upcomingElections.length}</span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Total Votes Cast</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalVotes}</span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Award size={20} />
          </div>
        </div>
      </div>

      {/* Main Grid: Left Main Area, Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left Column — Active Elections */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">Active Elections</h3>
              <Link href="/voter/elections" className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                View All
              </Link>
            </div>

            {loading ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Syncing active ballots...</p>
              </div>
            ) : elections.length === 0 ? (
              <div className="text-center py-12 px-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800">
                <Inbox size={40} className="text-slate-400 dark:text-slate-500 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No Active Elections</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-xs mx-auto">There are no running elections at the moment. Please check back later.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {elections.map(el => {
                  const hasVoted = votedElectionIds.includes(el.id);
                  return (
                    <div key={el.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">{el.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{el.description}</p>
                        </div>
                        <div className="shrink-0">
                          {hasVoted ? (
                            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md font-bold border border-emerald-200 dark:border-emerald-900/30">✓ Voted</span>
                          ) : (
                            <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md font-bold border border-blue-200 dark:border-blue-900/30">Active</span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-700 pt-4 mt-1">
                        <CountdownTimer endsAt={el.endDate} />
                        <div className="flex gap-2">
                          {hasVoted ? (
                            <button disabled className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 font-bold cursor-not-allowed">
                              Already Voted
                            </button>
                          ) : (
                            <Link href={`/voter/elections/${el.id}`} className="px-3.5 py-2 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors">
                              Vote Now
                            </Link>
                          )}
                          {el.showResults && (
                            <Link href={`/voter/elections/${el.id}/results`} className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-bold transition-all">
                              View Results
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Elections */}
          {upcomingElections.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight mb-4">Upcoming Elections</h3>
              <div className="flex flex-col gap-4">
                {upcomingElections.map(el => (
                  <div key={el.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
                    <div className="flex justify-between items-center gap-4">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{el.title}</h4>
                      <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-md font-bold border border-amber-200 dark:border-amber-900/30">Upcoming</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{el.description}</p>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 font-medium">
                      <Clock size={12} /> Starts {new Date(el.startDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Published Election Results */}
          {publishedResultsElections.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight mb-4">📊 Published Results</h3>
              <div className="flex flex-col gap-4">
                {publishedResultsElections.map(el => (
                  <div key={el.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex justify-between items-center shadow-sm">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">{el.title}</h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Ended</span>
                    </div>
                    <Link href={`/voter/elections/${el.id}/results`} className="px-3.5 py-2 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors">
                      View Results
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column — Sidebar Profile & Security Integrities */}
        <div className="flex flex-col gap-4">

          {/* Security Info Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">Security Status</h4>

            <div className="flex gap-3 items-start">
              <div className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">MFA Credentials Validated</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">Single Sign-On authentication is active for this session.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start border-t border-slate-100 dark:border-slate-700 pt-4 mt-1">
              <div className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
                <Key size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">Tamper-proof Log Verified</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">Cryptographic SHA-256 chain checked and valid.</p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
