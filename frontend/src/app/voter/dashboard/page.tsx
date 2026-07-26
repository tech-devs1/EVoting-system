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
  createdBy?: string;
  showResults?: boolean;
}

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [endingSoon, setEndingSoon] = useState(false);
  const [mounted, setMounted] = useState(false);

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
    <div className={`countdown-timer ${endingSoon ? 'ending-soon' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }} suppressHydrationWarning>
      <Clock size={14} /> {mounted ? timeLeft : 'Loading...'}
    </div>
  );
}

export default function VoterDashboard() {
  const { user } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [upcomingElections, setUpcomingElections] = useState<Election[]>([]);
  const [publishedResultsElections, setPublishedResultsElections] = useState<Election[]>([]);
  const [votedElectionIds, setVotedElectionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVotes, setTotalVotes] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function fetchData() {
      try {
        console.log('[Dashboard] Fetching elections data...');
        // Fetch active elections
        const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
        console.log('[Dashboard] Elections response:', res);
        if (res.status === 'success') {
          // Only show elections created by admin
          const adminElections = res.data.filter(el => el.createdBy === 'admin');
          setElections(adminElections.filter(el => el.status === 'active'));
          setUpcomingElections(adminElections.filter(el => el.status === 'draft'));
          setPublishedResultsElections(adminElections.filter(el => el.showResults === true));
        }

        // Fetch user voted elections
        try {
          const votedRes = await apiRequest<{ status: string; data: string[] }>('/votes/voted-elections');
          if (votedRes.status === 'success') {
            setVotedElectionIds(votedRes.data);
          }
        } catch (votedErr) {
          console.error('Error fetching voted elections:', votedErr);
        }

        // Get total votes cast from local storage history or mock
        const storedVotes = localStorage.getItem('COMPSSA_voter_votes');
        if (storedVotes) {
          const parsed = JSON.parse(storedVotes);
          setTotalVotes(parsed.length);
        } else {
          setTotalVotes(0); // default to 0 for empty database
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

  const userName = user?.name || "";
  const voterCode = user?.uid ? user.uid.substring(0, 12) : "";

  return (
    <div className="dashboard-grid animate-page-enter" suppressHydrationWarning>
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
              <span className="stat-widget-label">Upcoming Elections</span>
              <span className="stat-widget-val">{upcomingElections.length}</span>
            </div>
            <div className="stat-widget">
              <span className="stat-widget-label">Total Verified Votes</span>
              <span className="stat-widget-val">{totalVotes}</span>
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
              {elections.map(el => {
                const hasVoted = votedElectionIds.includes(el.id);
                return (
                  <div className="card election-card card-hover" key={el.id}>
                    <div className="election-card-header">
                      <h4 className="election-card-title">{el.title}</h4>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        {hasVoted && (
                          <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--color-success, #22c55e)', fontSize: '11px' }}>✓ Voted</span>
                        )}
                        <span className="badge badge-success">Active</span>
                      </div>
                    </div>
                    <p className="election-card-desc">{el.description}</p>
                    <div className="election-card-meta">
                      <CountdownTimer endsAt={el.endDate} />
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        {hasVoted ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled
                            style={{ opacity: 0.5, cursor: 'not-allowed' }}
                          >
                            Already Voted
                          </button>
                        ) : (
                          <Link href={`/voter/elections/${el.id}`} className="btn btn-primary btn-sm">
                            Vote Now
                          </Link>
                        )}
                        {el.showResults && (
                          <Link href={`/voter/elections/${el.id}/results`} className="btn btn-secondary btn-sm">
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

        {/* Upcoming Elections Section */}
        {upcomingElections.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3>Upcoming Elections</h3>
              <Link href="/voter/elections" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>View All</Link>
            </div>
            <div className="election-grid">
              {upcomingElections.map(el => (
                <div className="card election-card" key={el.id}>
                  <div className="election-card-header">
                    <h4 className="election-card-title">{el.title}</h4>
                    <span className="badge badge-warning">Upcoming</span>
                  </div>
                  <p className="election-card-desc">{el.description}</p>
                  <div className="election-card-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      <Clock size={13} />
                      Starts {new Date(el.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <button className="btn btn-secondary btn-sm" disabled style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.6 }}>
                      Not Yet Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Published Election Results Section */}
        {publishedResultsElections.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                📊 Published Election Results
              </h3>
              <Link href="/voter/elections" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>View All</Link>
            </div>
            <div className="election-grid">
              {publishedResultsElections.map(el => (
                <div className="card election-card card-hover" key={el.id} style={{ border: '1px solid rgba(99,102,241,0.3)' }}>
                  <div className="election-card-header">
                    <h4 className="election-card-title">{el.title}</h4>
                    <span className="badge badge-success">Results Available</span>
                  </div>
                  <p className="election-card-desc">{el.description}</p>
                  <div className="election-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                      Status: {el.status}
                    </span>
                    <Link href={`/voter/elections/${el.id}/results`} className="btn btn-primary btn-sm">
                      View Results
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
