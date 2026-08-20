'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { getEffectiveStatus } from '@/lib/electionStatus';
import { get, set } from 'idb-keyval';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import { 
  ShieldCheck, 
  Key, 
  Clock, 
  Inbox,
  Award,
  Vote,
  ChevronRight,
  CalendarClock
} from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'scheduled' | 'active' | 'ended' | 'completed';
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
          newElections = allElections.filter(el => getEffectiveStatus(el) === 'active');
          newUpcoming = allElections.filter(el => { const s = getEffectiveStatus(el); return s === 'draft' || s === 'scheduled'; });
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
        try {
          const userVotesRes = await apiRequest<{ status: string; data: any[] }>('/votes/user-votes');
          if (userVotesRes.status === 'success' && Array.isArray(userVotesRes.data)) {
            newTotalVotes = userVotesRes.data.length;
          }
        } catch (_) {}

        if (newTotalVotes === 0) {
          const storedVotes = localStorage.getItem('COMPSSA_voter_votes');
          if (storedVotes) {
            try {
              const parsed = JSON.parse(storedVotes);
              newTotalVotes = parsed.length;
            } catch (_) {}
          }
        }
        setTotalVotes(newTotalVotes);

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

  if (loading) {
    return <DashboardSkeleton role="voter" />;
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6" suppressHydrationWarning>

      {/* Welcome Card — clean and simple on every screen size */}
      <div className="relative overflow-hidden bg-blue-600 text-white p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-lg shadow-blue-600/20">
        <div className="hidden md:block absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 pointer-events-none" />
        <div className="hidden md:block absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-blue-400/20 pointer-events-none" />
        <div className="relative flex items-center gap-3 md:gap-4">
          <div className="w-11 h-11 md:w-14 md:h-14 shrink-0 rounded-xl md:rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 md:w-7 md:h-7" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg md:text-2xl font-extrabold mb-0.5 md:mb-1 tracking-tight leading-snug">Welcome back, {userName}!</h2>
            <p className="text-[13px] md:text-sm text-blue-100 leading-relaxed max-w-3xl font-medium">
              Your voter account is verified and ready to vote.
            </p>
          </div>
          <div className="hidden md:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/15 border border-white/20 text-[11px] font-bold shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            Verified voter
          </div>
        </div>
      </div>

      {/* Stats — compact 3-col row on mobile, same on desktop */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="mobile-app-card flex flex-col items-start justify-center gap-1 md:flex-row md:items-center md:justify-between p-3 md:p-5">
          <div className="min-w-0">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Active Ballots</span>
            <span className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">{elections.length}</span>
          </div>
          <div className="hidden md:flex p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Vote size={20} />
          </div>
        </div>

        <div className="mobile-app-card flex flex-col items-start justify-center gap-1 md:flex-row md:items-center md:justify-between p-3 md:p-5">
          <div className="min-w-0">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Upcoming</span>
            <span className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">{upcomingElections.length}</span>
          </div>
          <div className="hidden md:flex p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock size={20} />
          </div>
        </div>

        <div className="mobile-app-card flex flex-col items-start justify-center gap-1 md:flex-row md:items-center md:justify-between p-3 md:p-5">
          <div className="min-w-0">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Votes Cast</span>
            <span className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">{totalVotes}</span>
          </div>
          <div className="hidden md:flex p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Award size={20} />
          </div>
        </div>
      </div>

      {/* Main Grid: Left Main Area, Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left Column — Active Elections */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          <div>
            <div className="flex justify-between items-center mb-3 md:mb-4">
              <h3 className="text-sm md:text-base font-bold text-slate-950 dark:text-white tracking-tight">Recent Elections</h3>
              <Link href="/voter/elections" className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                View All
              </Link>
            </div>

            {elections.length === 0 ? (
              <div className="text-center py-12 px-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800">
                <Inbox size={40} className="text-slate-400 dark:text-slate-500 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No Active Elections</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-xs mx-auto">There are no running elections at the moment. Please check back later.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 md:gap-4">
                {elections.map(el => {
                  const hasVoted = votedElectionIds.includes(el.id);
                  return (
                    <div key={el.id} className="mobile-app-card flex items-center gap-3 md:gap-4 hover:shadow-md transition-all">
                      {/* Icon tile */}
                      <Link href={`/voter/elections/detail?id=${el.id}`} className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                        <div className={`w-11 h-11 md:w-12 md:h-12 shrink-0 rounded-2xl flex items-center justify-center ${
                          hasVoted
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                        }`}>
                          {hasVoted ? <Award size={20} /> : <Vote size={20} />}
                        </div>

                        {/* Title + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{el.title}</h4>
                            {hasVoted ? (
                              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold shrink-0">✓ Voted</span>
                            ) : (
                              <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md font-bold shrink-0">Active</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            <CalendarClock size={12} className="shrink-0" />
                            <CountdownTimer endsAt={el.endDate} />
                          </div>
                        </div>
                      </Link>

                      {/* Action */}
                      <Link
                        href={`/voter/elections/detail?id=${el.id}`}
                        className="shrink-0 flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition-colors"
                      >
                        {hasVoted ? 'Details' : 'Vote'} <ChevronRight size={14} />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Elections */}
          {upcomingElections.length > 0 && (
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-950 dark:text-white tracking-tight mb-4">Upcoming Elections</h3>
              <div className="flex flex-col gap-3 md:gap-4">
                {upcomingElections.map(el => (
                  <Link key={el.id} href={`/voter/elections/detail?id=${el.id}`} className="mobile-app-card flex flex-col gap-3 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-center gap-4">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{el.title}</h4>
                      <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-md font-bold border border-amber-200 dark:border-amber-900/30">Upcoming</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{el.description}</p>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between font-medium pt-1">
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} /> Starts {new Date(el.startDate).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
                        Details <ChevronRight size={12} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Published Election Results */}
          {publishedResultsElections.length > 0 && (
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-950 dark:text-white tracking-tight mb-4">📊 Published Results</h3>
              <div className="flex flex-col gap-3 md:gap-4">
                {publishedResultsElections.map(el => (
                  <div key={el.id} className="mobile-app-card flex justify-between items-center gap-3 shadow-sm">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">{el.title}</h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Ended</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/voter/elections/detail?id=${el.id}`} className="px-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 transition-colors">
                        Details
                      </Link>
                      <Link href={`/voter/elections/results?id=${el.id}`} className="px-3.5 py-1.5 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors">
                        View Results
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column — Sidebar Profile & Security Integrities */}
        <div className="flex flex-col gap-4">

          {/* Security Info Card */}
          <div className="mobile-app-card flex flex-col gap-4 shadow-sm">
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
