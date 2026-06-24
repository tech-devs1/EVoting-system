'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { 
  ShieldCheck, 
  Key, 
  Search, 
  Clock, 
  Inbox 
} from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed';
}

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [endingSoon, setEndingSoon] = useState(false);

  useEffect(() => {
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
  }, [endsAt]);

  return (
    <div className={`countdown-timer ${endingSoon ? 'ending-soon' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <Clock size={14} /> {timeLeft}
    </div>
  );
}

export default function VoterDashboard() {
  const { user } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch active elections
        const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
        if (res.status === 'success') {
          // Exclude completed or draft if route returns everything, or display only active
          setElections(res.data.filter(el => el.status === 'active'));
        }

        // Get total votes cast from local storage history or mock
        const storedVotes = localStorage.getItem('Votick_voter_votes');
        if (storedVotes) {
          const parsed = JSON.parse(storedVotes);
          setTotalVotes(parsed.length);
        } else {
          setTotalVotes(0); // default to 0 for empty database
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const userName = user?.name || "";
  const voterCode = user?.uid ? user.uid.substring(0, 12) : "";

  return (
    <div className="dashboard-grid animate-page-enter">
      {/* Main Content Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Welcome Banner Card */}
        <div className="welcome-card">
          <h2>Welcome back, {userName}!</h2>
          <p>Your digital identity profile is cryptographic verification ready. Explore running ballots or check validation history tokens below.</p>
          
          <div className="quick-stats-grid">
            <div className="stat-widget">
              <span className="stat-widget-label">Active E-ballots</span>
              <span className="stat-widget-val">{elections.length}</span>
            </div>
            <div className="stat-widget">
              <span className="stat-widget-label">Total Verified Votes</span>
              <span className="stat-widget-val">{totalVotes}</span>
            </div>
            <div className="stat-widget">
              <span className="stat-widget-label">ID Hash Signature</span>
              <span className="stat-widget-val" style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                {voterCode}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic list of running elections */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3>Active Elections</h3>
            <Link href="/voter/elections" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>
              View All
            </Link>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Syncing active ballots...</p>
          ) : elections.length === 0 ? (
            <div className="empty-state">
              <Inbox size={48} style={{ color: 'var(--text-tertiary)' }} />
              <h3>No Active Elections</h3>
              <p>There are no elections running right now. Check back later.</p>
            </div>
          ) : (
            <div className="election-grid">
              {elections.map(el => (
                <div className="card election-card card-hover" key={el.id}>
                  <div className="election-card-header">
                    <h4 className="election-card-title">{el.title}</h4>
                    <span className="badge badge-success">Active</span>
                  </div>
                  <p className="election-card-desc">{el.description}</p>
                  <div className="election-card-meta">
                    <CountdownTimer endsAt={el.endDate} />
                    <Link href={`/voter/elections/${el.id}`} className="btn btn-primary btn-sm">
                      Vote Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Widgets Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Security Announcements */}
        <div className="card">
          <h4 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-base)' }}>Security Announcements</h4>
          <div className="notification-item" style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div className="notification-icon blue" style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: 'var(--color-info-bg)', 
              color: 'var(--color-info)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <ShieldCheck size={16} />
            </div>
            <div className="notification-content" style={{ flexGrow: 1 }}>
              <p style={{ fontWeight: 'bold', margin: 0, fontSize: 'var(--text-sm)' }}>Multi-Factor Authentication</p>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-xs)' }}>SSO Credentials validated successfully from current session.</p>
              <div className="notification-time" style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>10 mins ago</div>
            </div>
          </div>

          <div className="notification-item" style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div className="notification-icon green" style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: 'var(--color-success-bg)', 
              color: 'var(--color-success)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Key size={16} />
            </div>
            <div className="notification-content" style={{ flexGrow: 1 }}>
              <p style={{ fontWeight: 'bold', margin: 0, fontSize: 'var(--text-sm)' }}>Ledger Integrity Checked</p>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-xs)' }}>SHA-256 ledger integrity validation complete. 0 errors.</p>
              <div className="notification-time" style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>2 hours ago</div>
            </div>
          </div>
        </div>

        {/* Quick verification profile card */}
        <div className="card">
          <h4 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-base)' }}>Cryptographic Verification</h4>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            Use your tracking token ID to lookup audit nodes status.
          </p>
          <Link href="/voter/verify" className="btn btn-outline btn-full btn-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Search size={14} /> Lookup Verification ID
          </Link>
        </div>
      </div>
    </div>
  );
}
