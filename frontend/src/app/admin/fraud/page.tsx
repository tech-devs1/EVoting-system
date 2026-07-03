'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { ShieldCheck, RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';

interface Alert {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  metadata?: {
    voterId?: string;
    electionId?: string;
    candidateId?: string;
    position?: string;
  };
  status: string;
}

export default function AdminFraudPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await apiRequest<{ status: string; data: Alert[] }>('/admin/fraud-alerts');
        if (res.status === 'success') {
          // Filter to show only alerts of double voting in same category/duplicate vote attempts
          const dupAlerts = res.data.filter(a => 
            a.message && 
            (a.message.toLowerCase().includes('duplicate') || 
             a.message.toLowerCase().includes('twice') || 
             a.type === 'DUPLICATE_VOTE')
          );
          setAlerts(dupAlerts);
        }
      } catch (err) {
        console.error('Error fetching fraud alerts:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const uniqueVotersCount = new Set(alerts.map(a => a.metadata?.voterId).filter(Boolean)).size;

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
        <div className="soc-title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <Link href="/admin/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: '#94A3B8' }}>
              <ArrowLeft size={14} /> Return to Dashboard
            </Link>
            <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: '2px', color: '#F1F5F9' }}>Threat Mitigation Command</h3>
            <span style={{ color: '#94A3B8', fontSize: 'var(--text-xs)' }}>Cybersecurity & Fraud Prevention Operations Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: alerts.length > 0 ? '#EF4444' : '#22C55E', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
            <span style={{ fontSize: 'var(--text-xs)', color: alerts.length > 0 ? '#EF4444' : '#22C55E', fontWeight: 700, letterSpacing: '0.05em' }}>
              {alerts.length > 0 ? 'ANOMALIES DETECTED' : 'LIVE MONITOR ACTIVATED'}
            </span>
          </div>
        </div>

        {/* Real-time Signals Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Double Vote Attempts</span>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', color: alerts.length > 0 ? '#EF4444' : '#F1F5F9' }}>
              {alerts.length} Flagged
            </span>
          </div>
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flagged Voter IDs</span>
            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', color: uniqueVotersCount > 0 ? '#F59E0B' : '#F1F5F9' }}>
              {uniqueVotersCount} Unique
            </span>
          </div>
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Threat Severity</span>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: alerts.length > 0 ? '#EF4444' : '#22C55E', marginTop: 'auto' }}>
              {alerts.length > 5 ? 'HIGH RISK' : alerts.length > 0 ? 'MEDIUM RISK' : 'SECURE'}
            </span>
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
            ) : alerts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 'var(--space-8) 0',
                border: '1px dashed #334155',
                borderRadius: 'var(--radius-lg)',
                color: '#94A3B8'
              }}>
                <ShieldCheck size={36} style={{ color: '#22C55E', marginBottom: 'var(--space-2)' }} />
                <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>No double-voting attempts detected. Ledger system integrity verified.</p>
              </div>
            ) : (
              alerts.map(al => (
                <div
                  key={al.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #EF444433',
                    background: '#EF444411',
                    animation: 'fadeIn 0.3s ease'
                  }}
                >
                  <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: '#F8FAFC', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      Duplicate Vote Detected
                    </p>
                    <p style={{ margin: '2px 0 6px', color: '#CBD5E1', fontSize: 'var(--text-xs)' }}>
                      {al.message}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: '10px', color: '#94A3B8' }}>
                      {al.metadata?.voterId && (
                        <span>Voter ID: <strong style={{ color: '#F1F5F9' }}>{al.metadata.voterId}</strong></span>
                      )}
                      {al.metadata?.position && (
                        <span>Category: <strong style={{ color: '#F1F5F9' }}>{al.metadata.position}</strong></span>
                      )}
                      <span>Time: {new Date(al.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#EF4444', textTransform: 'uppercase', background: '#EF444422', padding: '2px 6px', borderRadius: '4px' }}>
                    Critical
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
