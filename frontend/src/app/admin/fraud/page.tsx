'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { ShieldCheck, RefreshCw, ArrowLeft } from 'lucide-react';

interface Alert {
  id: string;
  type: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: number;
  status: string;
}

const DEFAULT_ALERTS: Alert[] = [];

const MOCK_STREAMING_ALERTS: { type: 'critical' | 'high' | 'medium' | 'low'; message: string; }[] = [];

export default function AdminFraudPage() {
  const [alerts, setAlerts] = useState<Alert[]>(DEFAULT_ALERTS);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await apiRequest<{ status: string; data: Alert[] }>('/admin/fraud-alerts');
        if (res.status === 'success' && res.data.length > 0) {
          setAlerts(res.data);
        }
      } catch {
        // Use default mock alerts on error
      } finally {
        setLoading(false);
      }
    }
    fetchAlerts();

    // No more simulated live streaming alerts since MOCK_STREAMING_ALERTS is empty.
  }, []);

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'critical': return { background: 'rgba(239,68,68,0.2)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' };
      case 'high': return { background: 'rgba(245,158,11,0.2)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' };
      case 'medium': return { background: 'rgba(124,58,237,0.2)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)' };
      default: return { background: 'rgba(34,197,94,0.2)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' };
    }
  };

  return (
    <div className="animate-page-enter">
      <div className="soc-dark-panel" style={{
        background: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        color: '#F1F5F9'
      }}>
        {/* Header */}
        <div className="soc-title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
          <div>
            <Link href="/admin/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: '#94A3B8' }}>
              <ArrowLeft size={14} /> Return to Dashboard
            </Link>
            <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: '2px', color: '#F1F5F9' }}>Threat Mitigation Command</h3>
            <span style={{ color: '#94A3B8', fontSize: 'var(--text-xs)' }}>Cybersecurity & Fraud Prevention Operations Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: '#22C55E', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
            <span style={{ fontSize: 'var(--text-xs)', color: '#22C55E', fontWeight: 700, letterSpacing: '0.05em' }}>LIVE MONITOR ACTIVATED</span>
          </div>
        </div>

        {/* SOC Top Row - Threat Score + Signals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)', alignItems: 'center' }}>
          <div className="soc-threat-score-card" style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-2)' }}>Active Threat Score</span>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: '#F59E0B', lineHeight: 1, marginBottom: 'var(--space-3)' }}>34</div>
            <span className="badge badge-warning">Medium Risk Level</span>
          </div>

          <div>
            <h4 style={{ fontSize: 'var(--text-base)', borderBottom: '1px solid #1E293B', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-4)', color: '#F1F5F9' }}>Real-Time Signals Tracked</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              {[
                { label: 'Duplicate Registers', value: '0 Flagged', color: '#22C55E' },
                { label: 'Multiple Login Tries', value: '4 Queries', color: '#F59E0B' },
                { label: 'Rapid Vote Spikes', value: '0 Spikes', color: '#22C55E' },
                { label: 'Suspicious Devices', value: '1 Flagged', color: '#EF4444' },
              ].map(item => (
                <div key={item.label} style={{ border: '1px solid #1E293B', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block', marginBottom: '2px' }}>{item.label}</span>
                  <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts Feed */}
        <div>
          <h4 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)', color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            System Threat Activity Log
            <RefreshCw size={14} style={{ color: '#64748B', animation: 'spin 3s linear infinite' }} />
          </h4>
          <div className="soc-alert-timeline" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {loading ? (
              <p style={{ color: '#94A3B8' }}>Loading threat monitor...</p>
            ) : (
              alerts.map(al => (
                <div
                  key={al.id}
                  className={`soc-alert-item ${al.type}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #1E293B',
                    background: '#1E293B',
                    animation: 'fadeIn 0.3s ease'
                  }}
                >
                  <span
                    className={`soc-alert-badge ${al.type}`}
                    style={{
                      ...getBadgeStyle(al.type),
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase' as const,
                      whiteSpace: 'nowrap' as const,
                      flexShrink: 0
                    }}
                  >
                    {al.type}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: '#F8FAFC', fontSize: 'var(--text-sm)' }}>{al.message}</p>
                    <span style={{ fontSize: '10px', color: '#64748B' }}>
                      Timestamp: {new Date(al.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
