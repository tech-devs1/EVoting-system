'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, apiRequestCached } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Search, FolderOpen, Clock, Lock, ArrowLeft, ChevronRight } from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'scheduled' | 'active' | 'ended' | 'completed';
  category?: string;
  hasVoted?: boolean;
  showResults?: boolean;
  previewImageUrl?: string;
}

function CountdownTimer({ endsAt, status }: { endsAt: string; status: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [endingSoon, setEndingSoon] = useState<boolean>(false);

  useEffect(() => {
    if (status !== 'active') {
      setTimeLeft(status === 'ended' || status === 'completed' ? 'Ended' : 'Not started');
      return;
    }

    const endTime = new Date(endsAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft('Ended');
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
  }, [endsAt, status]);

  return (
    <div className={`countdown-timer ${endingSoon ? 'ending-soon' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <Clock size={14} /> {timeLeft}
    </div>
  );
}

export default function VoterElectionsPage() {
  const { user } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [filteredList, setFilteredList] = useState<Election[]>([]);
  const [votedElectionIds, setVotedElectionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'draft' | 'ended' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchElections() {
      try {
        const res = await apiRequestCached<{ status: string; data: any[] }>('/elections/eligible', (updatedRes) => {
          if (updatedRes.status === 'success' && Array.isArray(updatedRes.data)) {
            setElections(updatedRes.data);
            setFilteredList(updatedRes.data);
          }
        });

        let initialVotedIds: string[] = [];
        if (res.status === 'success' && Array.isArray(res.data)) {
          setElections(res.data);
          setFilteredList(res.data);
          initialVotedIds = res.data.filter(el => el.hasVoted).map(el => el.id);
          setVotedElectionIds(initialVotedIds);
          setLoading(false);
        }

        // Fetch user voted elections for ultimate consistency
        try {
          const votedRes = await apiRequestCached<{ status: string; data: string[] }>('/votes/voted-elections');
          if (votedRes.status === 'success') {
            const combinedVotedIds = Array.from(new Set([...initialVotedIds, ...votedRes.data]));
            setVotedElectionIds(combinedVotedIds);
          }
        } catch (_) {}
      } catch (err) {
        console.error('Error fetching elections:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchElections();
  }, []);

  useEffect(() => {
    let result = elections;

    if (selectedFilter !== 'all') {
      result = result.filter(el => el.status === selectedFilter || (selectedFilter === 'draft' && el.status === 'scheduled'));
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(el => 
        el.title.toLowerCase().includes(q) || 
        el.description.toLowerCase().includes(q)
      );
    }

    setFilteredList(result);
  }, [selectedFilter, searchQuery, elections]);

  const mapStatusLabel = (status: string) => {
    if (status === 'draft' || status === 'scheduled') return 'upcoming';
    if (status === 'ended' || status === 'completed') return 'closed';
    return status;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter and Search Bar */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <Link href="/voter/dashboard" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
            <ArrowLeft size={14} /> Return to Dashboard
          </Link>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <button 
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedFilter === 'all' 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`} 
              onClick={() => setSelectedFilter('all')}
            >
              All Elections
            </button>
            <button 
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedFilter === 'active' 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`} 
              onClick={() => setSelectedFilter('active')}
            >
              Active
            </button>
            <button 
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedFilter === 'draft' 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`} 
              onClick={() => setSelectedFilter('draft')}
            >
              Upcoming
            </button>
            <button 
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedFilter === 'completed' 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`} 
              onClick={() => setSelectedFilter('completed')}
            >
              Closed
            </button>
          </div>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="Search elections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Elections Cards Grid */}
      {loading ? (
        <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Synchronizing ballot database...</p>
      ) : filteredList.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center">
          <FolderOpen size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">No Elections Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">No matching election schedules fit the active queries.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredList.map(el => {
            const statusLabel = mapStatusLabel(el.status);
            const hasVoted = votedElectionIds.includes(el.id);

            return (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow" key={el.id}>
                <Link href={`/voter/elections/detail?id=${el.id}`} className="block">
                  {el.previewImageUrl ? (
                    <img
                      src={el.previewImageUrl}
                      alt={el.title}
                      className="w-full h-36 object-cover"
                    />
                  ) : (
                    <div className="w-full h-36 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <FolderOpen size={40} />
                    </div>
                  )}
                </Link>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <Link href={`/voter/elections/detail?id=${el.id}`} className="hover:underline">
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-1">{el.title}</h4>
                      </Link>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasVoted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">✓ Voted</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                          el.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' :
                          el.status === 'completed' ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30' :
                          'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30'
                        }`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 mb-4">{el.description}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex justify-between items-center mt-auto">
                    <CountdownTimer endsAt={el.endDate} status={el.status} />
                    <div className="flex items-center gap-2">
                      <Link href={`/voter/elections/detail?id=${el.id}`} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold transition-colors">
                        Details
                      </Link>
                      {el.status === 'completed' && el.showResults && (
                        <Link href={`/voter/elections/results?id=${el.id}`} className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors">
                          Results
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
