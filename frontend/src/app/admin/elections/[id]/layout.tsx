'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Users, 
  Layers, 
  BarChart3, 
  FileText, 
  ShieldAlert, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';

interface Election {
  id: string;
  title: string;
  category?: string;
  status: string;
  startDate: string;
  endDate: string;
}

export default function PerElectionWorkspaceLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = React.use(params);
  const electionId = resolvedParams.id;
  const pathname = usePathname();

  const [election, setElection] = useState<Election | null>(null);

  useEffect(() => {
    if (electionId) {
      apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`)
        .then(res => {
          if (res.status === 'success' && res.data) {
            setElection(res.data);
          }
        })
        .catch(err => console.error('Error loading workspace layout election:', err));
    }
  }, [electionId]);

  const navLinks = [
    { label: 'Overview', path: `/admin/elections/${electionId}/dashboard`, icon: LayoutDashboard },
    { label: 'Positions & Candidates', path: `/admin/elections/${electionId}/candidates`, icon: Layers },
    { label: 'Roster & CSV Upload', path: `/admin/elections/${electionId}/voters`, icon: Users },
    { label: 'Live Results', path: `/admin/elections/${electionId}/results`, icon: BarChart3 },
    { label: '360° Audit Ledger', path: `/admin/elections/${electionId}/audit`, icon: FileText },
    { label: 'Access Security', path: `/admin/elections/${electionId}/fraud`, icon: ShieldAlert },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '85vh', gap: '1.5rem' }}>
      
      {/* Left Workspace Navigation Sidebar */}
      <aside style={{
        width: '260px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: '1.25rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        height: 'fit-content',
        position: 'sticky',
        top: '1.5rem'
      }}>
        {/* Back Link */}
        <Link 
          href="/admin/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#2563eb',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'none',
            padding: '0.4rem 0.6rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(37, 99, 235, 0.08)'
          }}
        >
          <ArrowLeft size={16} /> Back to Election Hub
        </Link>

        {/* Election Title Context */}
        <div style={{ padding: '0.5rem 0.25rem', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#2563eb', letterSpacing: '0.05em' }}>
            {election?.category || 'Workspace'}
          </span>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '2px 0 6px 0', color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {election?.title || 'Election Workspace'}
          </h3>
          {election?.status === 'active' && <span className="badge badge-success" style={{ fontSize: '10px' }}>🟢 LIVE NOW</span>}
          {election?.status === 'scheduled' && <span className="badge badge-info" style={{ fontSize: '10px' }}>⏰ SCHEDULED</span>}
          {election?.status === 'ended' && <span className="badge badge-secondary" style={{ fontSize: '10px' }}>🏁 CLOSED</span>}
          {election?.status === 'draft' && <span className="badge badge-warning" style={{ fontSize: '10px' }}>📝 DRAFT</span>}
        </div>

        {/* Sidebar Nav Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {navLinks.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Workspace Frame */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
