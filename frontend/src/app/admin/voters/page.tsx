'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { hardNavigate } from '@/lib/navigation';
import { Users, Vote, ChevronRight, ArrowLeft } from 'lucide-react';

interface Election {
  id: string;
  title: string;
  category?: string;
  status: string;
  totalVoters?: number;
  voterCount?: number;
}

export default function AdminVotersDirectoryPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchElections() {
      try {
        const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
        if (res.status === 'success' && Array.isArray(res.data)) {
          setElections(res.data);
        }
      } catch (err) {
        console.error('Error fetching elections for roster directory:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchElections();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Users size={24} className="text-blue-600" /> Election Voter Rosters Directory
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
          Select an election below to manage its specific voter roster and upload Excel/CSV rosters
        </p>
      </div>

      {loading ? (
        <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading election rosters...</p>
      ) : elections.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center">
          <Users size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">No Elections Available</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Create an election from the dashboard first to manage voter rosters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {elections.map(el => {
            const rosterSize = el.voterCount || el.totalVoters || 0;
            return (
              <div
                key={el.id}
                onClick={() => hardNavigate(`/admin/elections/voters?electionId=${el.id}`)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg">
                      {el.category || 'Executive'}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                      {el.status}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2 line-clamp-1">{el.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
                    Roster Size: <strong className="text-slate-800 dark:text-slate-200">{rosterSize}</strong> eligible voters
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/60 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <span>Manage Election Roster</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
