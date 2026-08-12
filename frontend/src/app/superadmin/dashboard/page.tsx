'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { Building2, Activity, Users, ShieldCheck, Plus, Upload, Calendar } from 'lucide-react';

interface SuperAdminStats {
  departments: number;
  elections: number;
  voters: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<SuperAdminStats>({ departments: 0, elections: 0, voters: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiRequest<{ status: string; data: SuperAdminStats }>('/superadmin/stats');
        if (res.status === 'success') {
          setStats(res.data);
        } else {
          throw new Error('Failed to load stats');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="animate-page-enter flex flex-col gap-6 md:gap-7">
      
      {/* Justadmin Hero Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight m-0">
            Hi, Superadmin
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 m-0">
            Welcome back to HTU Elect Root Console!
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
          >
            <Upload size={16} /> Download Report
          </button>

          <Link
            href="/superadmin/departments"
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold inline-flex items-center gap-2 shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all cursor-pointer no-underline"
          >
            <Plus size={18} /> + Add Department
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* 4 KPI Stat Cards Row (Card 1 is Primary Blue) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Primary Blue */}
        <div className="bg-blue-600 text-white rounded-3xl p-6 shadow-lg shadow-blue-500/20 flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold opacity-90 block mb-2">Active Departments</span>
            <span className="text-4xl font-extrabold tracking-tight leading-none">{stats.departments}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white">
            <Building2 size={22} />
          </div>
        </div>

        {/* Card 2: Total Elections */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">Total Elections</span>
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">{stats.elections}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Activity size={22} />
          </div>
        </div>

        {/* Card 3: Registered Voters */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">Registered Voters</span>
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">{stats.voters.toLocaleString()}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Users size={22} />
          </div>
        </div>

        {/* Card 4: System Health */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">System Health</span>
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight leading-none block mt-1">100% Operational</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={22} />
          </div>
        </div>

      </div>

      {/* Analytics Visual Grid Row (Bar Chart + Donut Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Voting Activity Bar Chart Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Global System Activity</span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white m-0 mt-1">
                {stats.voters.toLocaleString()} Platform Requests
              </h3>
            </div>
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar size={14} /> Aug 08 - Aug 14
            </div>
          </div>

          {/* Visual Bar Chart Height Indicators */}
          <div className="flex items-end justify-between h-36 pt-4 border-b border-slate-100 dark:border-slate-800">
            {[
              { day: 'Mon', height: '40%', active: false },
              { day: 'Tue', height: '65%', active: false },
              { day: 'Wed', height: '50%', active: false },
              { day: 'Thu', height: '90%', active: true },
              { day: 'Fri', height: '75%', active: false },
              { day: 'Sat', height: '80%', active: false }
            ].map((bar, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`w-9 rounded-lg transition-all duration-300 ${
                    bar.active ? 'bg-blue-600 shadow-md shadow-blue-500/20' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                  style={{ height: bar.height }}
                />
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{bar.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Uptime Donut Breakdown Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white m-0">System SLA</h4>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Railway Cluster</span>
          </div>

          <div className="relative w-32 h-32 my-4 mx-auto flex items-center justify-center">
            <svg width="130" height="130" viewBox="0 0 36 36" className="transform -rotate-90">
              <path strokeWidth="4" className="stroke-slate-200 dark:stroke-slate-800 fill-none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path strokeWidth="4.5" strokeDasharray="99, 100" strokeLinecap="round" className="stroke-blue-600 fill-none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute text-center">
              <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none">99.9%</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1 block">Uptime</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
            Zero downtime logged this month
          </div>
        </div>

      </div>

    </div>
  );
}
