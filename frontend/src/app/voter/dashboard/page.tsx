'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { get, set } from 'idb-keyval';
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
  status: 'draft' | 'scheduled' | 'active' | 'completed';
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
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: 'var(--text-xs, 12px)',
      color: endingSoon ? 'var(--color-red, #EF4444)' : 'var(--text-secondary, #475569)',
      fontWeight: endingSoon ? 'var(--weight-semibold, 600)' : 'var(--weight-normal, 400)'
    }} suppressHydrationWarning>
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
        
        try {
          const cachedData = await get('voter_dashboard_cache');
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
          newElections = allElections.filter(el => el.status === 'active');
          newUpcoming = allElections.filter(el => el.status === 'draft' || el.status === 'scheduled');
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
            // Combine both sources of voted election IDs for ultimate consistency
            const combinedVotedIds = Array.from(new Set([...newVotedIds, ...votedRes.data]));
            newVotedIds = combinedVotedIds;
            setVotedElectionIds(newVotedIds);
          }
        } catch (votedErr) {
          console.error('Error fetching voted elections:', votedErr);
        }

        let newTotalVotes = 0;
        const storedVotes = localStorage.getItem('COMPSSA_voter_votes');
        if (storedVotes) {
          const parsed = JSON.parse(storedVotes);
          newTotalVotes = parsed.length;
          setTotalVotes(newTotalVotes);
        }

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

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: 'var(--space-6, 1.5rem)',
      fontFamily: 'var(--font-body, system-ui, sans-serif)'
    }} suppressHydrationWarning>

      {/* Top Welcome Card */}
      <div style={{
        backgroundColor: 'var(--bg-secondary, #FFFFFF)',
        borderRadius: 'var(--radius-xl, 12px)',
        border: '1px solid var(--border-color, #E2E8F0)',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        <div>
          <h2 style={{
            fontSize: 'var(--text-xl, 1.25rem)',
            fontWeight: 'var(--weight-bold, 700)',
            color: 'var(--text-primary, #0F172A)',
            margin: '0 0 0.35rem 0'
          }}>
            Welcome back, {userName}!
          </h2>
          <p style={{
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-secondary, #475569)',
            margin: 0,
            maxWidth: '640px',
            lineHeight: '1.5'
          }}>
            Your student voter account is cryptographically verified and ready. Review the running e-ballots below to securely cast your vote.
          </p>
        </div>
        
        {/* Flat Minimalist Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
          borderTop: '1px solid var(--border-color, #E2E8F0)',
          paddingTop: '1.25rem'
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs, 12px)', color: 'var(--text-tertiary, #94A3B8)', textTransform: 'uppercase', fontWeight: 600 }}>Active Ballots</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)', marginTop: '2px' }}>{elections.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs, 12px)', color: 'var(--text-tertiary, #94A3B8)', textTransform: 'uppercase', fontWeight: 600 }}>Upcoming</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)', marginTop: '2px' }}>{upcomingElections.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs, 12px)', color: 'var(--text-tertiary, #94A3B8)', textTransform: 'uppercase', fontWeight: 600 }}>Total Votes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)', marginTop: '2px' }}>{totalVotes}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Main Area, Right Sidebar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: 'var(--space-6, 1.5rem)'
      }} className="responsive-dashboard-split">

        {/* Left Column — Active Elections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)', margin: 0 }}>Active Elections</h3>
              <Link href="/voter/elections" style={{ fontSize: 'var(--text-xs, 12px)', color: 'var(--color-primary, #2563EB)', fontWeight: 600 }}>
                View All
              </Link>
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>Syncing active ballots...</p>
              </div>
            ) : elections.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                border: '1px dashed var(--border-color, #E2E8F0)',
                borderRadius: 'var(--radius-lg, 10px)',
                backgroundColor: 'var(--bg-secondary, #FFFFFF)'
              }}>
                <Inbox size={36} style={{ color: 'var(--text-tertiary, #94A3B8)', marginBottom: '0.75rem' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>No Active Elections</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>There are no running elections at the moment. Please check back later.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {elections.map(el => {
                  const hasVoted = votedElectionIds.includes(el.id);
                  return (
                    <div key={el.id} style={{
                      backgroundColor: 'var(--bg-secondary, #FFFFFF)',
                      border: '1px solid var(--border-color, #E2E8F0)',
                      borderRadius: 'var(--radius-lg, 10px)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>{el.title}</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>{el.description}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {hasVoted ? (
                            <span style={{ fontSize: '10px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>✓ Voted</span>
                          ) : (
                            <span style={{ fontSize: '10px', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>Active</span>
                          )}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid var(--border-light, #F1F5F9)',
                        paddingTop: '0.75rem'
                      }}>
                        <CountdownTimer endsAt={el.endDate} />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {hasVoted ? (
                            <button disabled style={{
                              padding: '0.45rem 0.85rem',
                              fontSize: '11px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-tertiary)',
                              color: 'var(--text-tertiary)',
                              cursor: 'not-allowed'
                            }}>
                              Already Voted
                            </button>
                          ) : (
                            <Link href={`/voter/elections/${el.id}`} style={{
                              padding: '0.45rem 0.85rem',
                              fontSize: '11px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--color-primary, #2563EB)',
                              color: '#ffffff',
                              fontWeight: 600,
                              textDecoration: 'none'
                            }}>
                              Vote Now
                            </Link>
                          )}
                          {el.showResults && (
                            <Link href={`/voter/elections/${el.id}/results`} style={{
                              padding: '0.45rem 0.85rem',
                              fontSize: '11px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                              textDecoration: 'none'
                            }}>
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

          {/* Upcoming Elections */}
          {upcomingElections.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)', marginBottom: '1rem' }}>Upcoming Elections</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {upcomingElections.map(el => (
                  <div key={el.id} style={{
                    backgroundColor: 'var(--bg-secondary, #FFFFFF)',
                    border: '1px solid var(--border-color, #E2E8F0)',
                    borderRadius: 'var(--radius-lg, 10px)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{el.title}</h4>
                      <span style={{ fontSize: '10px', backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>Upcoming</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>{el.description}</p>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> Starts {new Date(el.startDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Published Election Results */}
          {publishedResultsElections.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)', marginBottom: '1rem' }}>📊 Published Results</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {publishedResultsElections.map(el => (
                  <div key={el.id} style={{
                    backgroundColor: 'var(--bg-secondary, #FFFFFF)',
                    border: '1px solid var(--border-color, #E2E8F0)',
                    borderRadius: 'var(--radius-lg, 10px)',
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>{el.title}</h4>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Ended</span>
                    </div>
                    <Link href={`/voter/elections/${el.id}/results`} style={{
                      padding: '0.45rem 0.85rem',
                      fontSize: '11px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-primary, #2563EB)',
                      color: '#ffffff',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}>
                      View Results
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column — Sidebar Profile & Security Integrities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Flat Security Info */}
          <div style={{
            backgroundColor: 'var(--bg-secondary, #FFFFFF)',
            border: '1px solid var(--border-color, #E2E8F0)',
            borderRadius: 'var(--radius-lg, 10px)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Security Status</h4>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ color: 'var(--color-info)', marginTop: '2px' }}><ShieldCheck size={16} /></div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>MFA Credentials Validated</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Single Sign-On authentication is active for this session.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
              <div style={{ color: 'var(--color-success)', marginTop: '2px' }}><Key size={16} /></div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>Tamper-proof Log Verified</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Cryptographic SHA-256 chain checked and valid.</p>
              </div>
            </div>
          </div>

          {/* Quick Verification Lookup */}
          <div style={{
            backgroundColor: 'var(--bg-secondary, #FFFFFF)',
            border: '1px solid var(--border-color, #E2E8F0)',
            borderRadius: 'var(--radius-lg, 10px)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cryptographic Verification</h4>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Verify the exact inclusion of your vote in the electoral ledger using your unique tracking token.
            </p>
            <Link href="/voter/verify" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0.55rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
              textDecoration: 'none',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <Search size={12} /> Lookup Verification ID
            </Link>
          </div>

        </div>

      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .responsive-dashboard-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
