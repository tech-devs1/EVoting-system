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
    <div className="animate-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Justadmin Hero Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.025em' }}>
            Hi, Superadmin
          </h1>
          <p style={{ fontSize: '0.95rem', color: '#64748B', margin: '0.25rem 0 0 0' }}>
            Welcome back to HTU Elect Root Console!
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <Upload size={16} /> Download Report
          </button>

          <Link
            href="/superadmin/departments"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: '#7C3AED',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '14px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
            }}
          >
            <Plus size={18} /> + Add Department
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#FEF2F2', color: '#DC2626', borderRadius: '12px', fontSize: '0.875rem', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {/* 4 KPI Stat Cards Row (Card 1 is Primary Purple) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        {/* Card 1: Primary Purple */}
        <div style={{
          backgroundColor: '#7C3AED',
          color: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          boxShadow: '0 8px 24px -4px rgba(124, 58, 237, 0.35)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.9, display: 'block', marginBottom: '0.5rem' }}>Active Departments</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{stats.departments}</span>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <Building2 size={22} />
          </div>
        </div>

        {/* Card 2: Total Elections */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.5rem' }}>Total Elections</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>{stats.elections}</span>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563EB'
          }}>
            <Activity size={22} />
          </div>
        </div>

        {/* Card 3: Registered Voters */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.5rem' }}>Registered Voters</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>{stats.voters.toLocaleString()}</span>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#ECFDF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10B981'
          }}>
            <Users size={22} />
          </div>
        </div>

        {/* Card 4: System Health */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.5rem' }}>System Health</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981', letterSpacing: '-0.02em', lineHeight: 1 }}>100% Operational</span>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#ECFDF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10B981'
          }}>
            <ShieldCheck size={22} />
          </div>
        </div>

      </div>

      {/* Analytics Visual Grid Row (Bar Chart + Donut Breakdown) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
        
        {/* Voting Activity Bar Chart Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Global System Activity</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {stats.voters.toLocaleString()} Platform Requests
              </h3>
            </div>
            <div style={{ padding: '0.35rem 0.85rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={14} /> Aug 08 - Aug 14
            </div>
          </div>

          {/* Visual Bar Chart Height Indicators */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', paddingTop: '1rem', borderBottom: '1px solid #F1F5F9' }}>
            {[
              { day: 'Mon', height: '40%', active: false },
              { day: 'Tue', height: '65%', active: false },
              { day: 'Wed', height: '50%', active: false },
              { day: 'Thu', height: '90%', active: true },
              { day: 'Fri', height: '75%', active: false },
              { day: 'Sat', height: '80%', active: false }
            ].map((bar, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <div style={{
                  width: '36px',
                  height: bar.height,
                  backgroundColor: bar.active ? '#7C3AED' : '#E2E8F0',
                  borderRadius: '10px',
                  transition: 'height 0.3s ease',
                  boxShadow: bar.active ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'
                }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8' }}>{bar.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Uptime Donut Breakdown Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>System SLA</h4>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Railway Cluster</span>
          </div>

          <div style={{ position: 'relative', width: '130px', height: '130px', margin: '1rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="130" height="130" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <path stroke="#E2E8F0" strokeWidth="4" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path stroke="#7C3AED" strokeWidth="4.5" strokeDasharray="99, 100" strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', display: 'block', lineHeight: 1 }}>99.9%</span>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Uptime</span>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748B', textAlign: 'center', fontWeight: 500 }}>
            Zero downtime logged this month
          </div>
        </div>

      </div>

    </div>
  );
}
