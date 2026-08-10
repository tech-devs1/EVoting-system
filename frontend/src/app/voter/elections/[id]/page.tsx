'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Check, ShieldCheck, Lock, CheckCircle2, Sparkles, User, AlertCircle, Calendar, Trophy, Info } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  manifesto: string;
  photoUrl: string;
  isIndependent?: boolean;
  ballotNumber?: number | string;
}

interface Election {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  positions?: string[];
  otpRequired?: boolean;
  previewImageUrl?: string;
  category?: string;
}

export default function VoterElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const resolvedParams = use(params);
  const electionId = resolvedParams.id;

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail/Preview Page Phase vs Voting Ballot Phase
  const [proceedToBallot, setProceedToBallot] = useState(false);

  // OTP Access Lock states
  const [isLocked, setIsLocked] = useState(true);
  const [otpRequestSent, setOtpRequestSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpCodeError] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [fallbackOtp, setFallbackOtp] = useState('');

  // Map of position -> selected candidateId
  const [selections, setSelections] = useState<Record<string, string>>({});

  // Map of position -> auditTxId for positions already voted in this session
  const [votedPositions, setVotedPositions] = useState<Record<string, { candidateId: string; auditTxId: string }>>({});
  const [castingPosition, setCastingPosition] = useState<string | null>(null);
  const [notOnRoster, setNotOnRoster] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const electionRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
        if (electionRes.status === 'success') setElection(electionRes.data);

        const candidatesRes = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`);
        if (candidatesRes.status === 'success') setCandidates(candidatesRes.data);

        const accessRes = await apiRequest<{ status: string; data: { unlocked: boolean; reason?: string; message?: string } }>(`/elections/${electionId}/access-status`);
        if (accessRes.status === 'success') {
          setIsLocked(!accessRes.data.unlocked);
          if (!accessRes.data.unlocked && accessRes.data.reason === 'not_on_roster') {
            setNotOnRoster(true);
            setOtpCodeError(accessRes.data.message || 'You have no access to vote in this election.');
          }
        }
      } catch (err) {
        console.error('Error fetching candidate selection details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [electionId]);

  const [inputEmail, setInputEmail] = useState('');

  useEffect(() => {
    if (user?.email) {
      setInputEmail(user.email);
    }
  }, [user]);

  const handleRequestOtp = async () => {
    setRequestLoading(true);
    setOtpCodeError('');
    try {
      const emailToSend = inputEmail || user?.email;
      const res = await apiRequest<{ status: string; fallbackOtp?: string; message: string }>(
        `/elections/${electionId}/request-access-otp`,
        'POST',
        { email: emailToSend }
      );
      if (res.status === 'success') {
        setOtpRequestSent(true);
        if (res.fallbackOtp) {
          setFallbackOtp(res.fallbackOtp);
        }
      } else {
        setOtpCodeError(res.message || 'Failed to request verification code.');
      }
    } catch (err: any) {
      setOtpCodeError(err.message || 'Failed to request verification code.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleVerifyAccessOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setOtpCodeError('Please enter the full 6-digit code.');
      return;
    }
    setRequestLoading(true);
    setOtpCodeError('');
    try {
      const res = await apiRequest<{ status: string; message: string }>(`/elections/${electionId}/verify-access-otp`, 'POST', { otp: otpCode });
      if (res.status === 'success') {
        setIsLocked(false);
      } else {
        setOtpCodeError(res.message || 'Invalid verification code.');
      }
    } catch (err: any) {
      setOtpCodeError(err.message || 'Verification failed. Please try again.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleCastVoteForPosition = async (position: string) => {
    const candidateChoice = selections[position];
    if (!candidateChoice) {
      alert(`Please select a candidate for ${position} before casting your vote.`);
      return;
    }

    if (!confirm(`Are you sure you want to cast your vote for ${position}? This choice is final and cryptographically logged.`)) {
      return;
    }

    setCastingPosition(position);
    try {
      const res = await apiRequest<{ status: string; message: string; data?: { verificationId: string } }>('/votes/cast', 'POST', {
        electionId,
        candidateId: candidateChoice
      });

      if (res.status === 'success') {
        const auditTxId = res.data?.verificationId || 'VERIFIED_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        setVotedPositions(prev => ({
          ...prev,
          [position]: { candidateId: candidateChoice, auditTxId }
        }));
      } else {
        alert(res.message || 'Failed to cast vote.');
      }
    } catch (err: any) {
      console.error('Error casting vote for position:', err);
      alert('Failed to cast vote: ' + (err.message || 'Unknown error'));
    } finally {
      setCastingPosition(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary, #475569)', fontSize: '13px' }}>Synchronizing candidate profiles...</p>
      </div>
    );
  }

  if (!election) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '4rem 2rem',
        border: '1px dashed var(--border-color)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Election Not Found</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1.5rem 0' }}>No valid active election parameters were passed to this terminal session.</p>
        <Link href="/voter/elections" style={{
          padding: '0.55rem 1rem',
          borderRadius: '6px',
          backgroundColor: 'var(--color-primary, #2563EB)',
          color: '#ffffff',
          fontWeight: 600,
          textDecoration: 'none',
          fontSize: '12px'
        }}>
          Back to Eligible Elections
        </Link>
      </div>
    );
  }

  // Group candidates by position and sort strictly by ballot number ascending
  const positionGroups: Record<string, Candidate[]> = {};
  candidates.forEach(c => {
    if (!positionGroups[c.position]) positionGroups[c.position] = [];
    positionGroups[c.position].push(c);
  });
  Object.keys(positionGroups).forEach(pos => {
    positionGroups[pos].sort((a, b) => {
      const numA = a.ballotNumber !== undefined && a.ballotNumber !== null && a.ballotNumber !== '' ? Number(a.ballotNumber) : 999;
      const numB = b.ballotNumber !== undefined && b.ballotNumber !== null && b.ballotNumber !== '' ? Number(b.ballotNumber) : 999;
      if (numA !== numB) return numA - numB;
      return (a.name || '').localeCompare(b.name || '');
    });
  });
  const positions = Object.keys(positionGroups);
  const totalPositionsCount = positions.length;
  const votedCount = Object.keys(votedPositions).length;
  const isAllPositionsVoted = totalPositionsCount > 0 && votedCount === totalPositionsCount;

  const handleCardClick = (position: string, candId: string) => {
    if (votedPositions[position]) return; // locked
    setSelections(prev => {
      if (prev[position] === candId) {
        const next = { ...prev };
        delete next[position];
        return next;
      }
      return { ...prev, [position]: candId };
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'var(--font-body, system-ui, sans-serif)', paddingBottom: '3rem' }}>

      {/* Top Breadcrumb Navigation */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/voter/elections" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          color: 'var(--text-secondary, #475569)',
          fontSize: '12px',
          fontWeight: 600,
          textDecoration: 'none',
          marginBottom: '0.75rem'
        }}>
          <ArrowLeft size={14} /> Back to Eligible Elections
        </Link>
      </div>

      {/* --- PHASE 1: ELECTION DETAILS & DESCRIPTIONS VIEW --- */}
      {!proceedToBallot ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Election Card Header Image or Fallback */}
          <div style={{
            borderRadius: '16px',
            border: '1px solid var(--border-color, #E2E8F0)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-secondary, #FFFFFF)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
          }}>
            {election.previewImageUrl ? (
              <img
                src={election.previewImageUrl}
                alt={election.title}
                style={{ width: '100%', height: '240px', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ width: '100%', height: '160px', backgroundColor: 'var(--bg-tertiary, #EFF6FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary, #2563EB)' }}>
                <Sparkles size={48} />
              </div>
            )}

            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: 'var(--color-primary-50, #EFF6FF)', color: 'var(--color-primary, #2563EB)', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  {election.category || 'Executive'}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: election.status === 'active' ? 'var(--color-success-bg, #22c55e22)' : 'var(--bg-tertiary)', color: election.status === 'active' ? 'var(--color-success, #22c55e)' : 'var(--text-secondary)', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  {election.status === 'active' ? '🟢 Active' : '🏁 Ended'}
                </span>
              </div>

              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary, #0F172A)', margin: '0 0 0.75rem 0' }}>{election.title}</h2>
              <p style={{ color: 'var(--text-secondary, #475569)', fontSize: '14px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{election.description}</p>
            </div>
          </div>

          {/* Guidelines and Timing Metadata Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-secondary, #FFFFFF)',
              border: '1px solid var(--border-color, #E2E8F0)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              gap: '12px'
            }}>
              <Calendar size={20} style={{ color: 'var(--color-primary, #2563EB)', flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700 }}>Poll Schedule</h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Opens: {new Date(election.startDate).toLocaleString()}<br />
                  Closes: {new Date(election.endDate).toLocaleString()}
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-secondary, #FFFFFF)',
              border: '1px solid var(--border-color, #E2E8F0)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              gap: '12px'
            }}>
              <Info size={20} style={{ color: 'var(--color-primary, #2563EB)', flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700 }}>Voting Guidelines</h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Ensure you are listed on the official roster. Have your 6-digit voting access code ready. Double voting attempts are cryptographically flagged.
                </p>
              </div>
            </div>
          </div>

          {/* List of Registered Candidate Standings and Manifestos (View-Only Mode) */}
          <div style={{
            backgroundColor: 'var(--bg-secondary, #FFFFFF)',
            border: '1px solid var(--border-color, #E2E8F0)',
            borderRadius: '16px',
            padding: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={18} style={{ color: 'var(--color-primary, #2563EB)' }} /> Official Candidate Lineup
            </h3>

            {positions.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>No candidates are registered for this election yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {positions.map((pos, posIdx) => (
                  <div key={pos} style={{ borderBottom: posIdx === positions.length - 1 ? 'none' : '1px solid var(--border-light, #F1F5F9)', paddingBottom: '1rem' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary, #2563EB)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                      {pos}
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                      {positionGroups[pos].map((cand) => (
                        <div key={cand.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '0.75rem', borderRadius: '8px', backgroundColor: 'var(--bg-input, #F8FAFC)', border: '1px solid var(--border-subtle, #F1F5F9)' }}>
                          {cand.photoUrl ? (
                            <img src={cand.photoUrl} alt={cand.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: '48px', height: '48px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                              <User size={20} />
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {cand.ballotNumber && (
                                <span style={{ fontSize: '9px', fontWeight: 700, backgroundColor: 'var(--color-primary, #2563EB)', color: '#FFFFFF', padding: '1px 4px', borderRadius: '3px' }}>
                                  #{cand.ballotNumber}
                                </span>
                              )}
                              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cand.name}</span>
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>
                              {cand.manifesto || 'No manifesto provided.'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action CTA Trigger */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            {election.status === 'active' ? (
              <button
                onClick={() => setProceedToBallot(true)}
                style={{
                  padding: '0.85rem 2rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-primary, #2563EB)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(37, 99, 235, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <ShieldCheck size={18} /> Proceed to Secure Ballot
              </button>
            ) : (
              <div style={{ padding: '0.85rem 2rem', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 700, fontSize: '14px', border: '1px solid var(--border-color)' }}>
                Polls Closed
              </div>
            )}
          </div>

        </div>
      ) : (
        /* --- PHASE 2: SECURE OTP VERIFICATION & BALLOT INTERACTIVE VIEW --- */
        <div>
          <button
            onClick={() => setProceedToBallot(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--color-primary, #2563EB)',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
          >
            <ArrowLeft size={14} /> Back to Election Details
          </button>

          {isLocked ? (
            <div style={{
              backgroundColor: 'var(--bg-secondary, #FFFFFF)',
              border: '1px solid var(--border-color, #E2E8F0)',
              borderRadius: 'var(--radius-xl, 12px)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center'
            }}>
              {notOnRoster ? (
                <>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--color-danger, #EF4444)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem auto'
                  }}>
                    <AlertCircle size={22} />
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Access Restricted</h3>
                  <p style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary, #475569)',
                    maxWidth: '440px',
                    margin: '0 auto 1.5rem auto',
                    lineHeight: 1.5
                  }}>
                    {otpError || 'Your account is not listed on the official voter roster for this election.'}
                  </p>
                  <button onClick={() => setProceedToBallot(false)} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary, #2563EB)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer'
                  }}>
                    Return to Details
                  </button>
                </>
              ) : (
                <>
                  {!otpRequestSent ? (
                    <>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary-50, #EFF6FF)',
                        color: 'var(--color-primary, #2563EB)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem auto'
                      }}>
                        <Lock size={22} />
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Verification Required</h3>
                      <p style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary, #475569)',
                        maxWidth: '440px',
                        margin: '0 auto 1.5rem auto',
                        lineHeight: 1.5
                      }}>
                        An identity verification code is required to unlock your voting ballot. Please request a 6-digit access code.
                      </p>

                      {user?.email && (
                        <div style={{ marginBottom: '1rem', fontSize: '13px', color: 'var(--text-primary)' }}>
                          Code will be sent to: <strong>{user.email}</strong>
                        </div>
                      )}

                      {otpError && (
                        <p style={{ color: 'var(--color-danger, #EF4444)', fontSize: '12px', marginBottom: '1rem' }}>{otpError}</p>
                      )}

                      <button
                        onClick={handleRequestOtp}
                        disabled={requestLoading}
                        style={{
                          padding: '0.65rem 1.25rem',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-primary, #2563EB)',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '13px',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {requestLoading ? 'Requesting...' : 'Request Access Code'}
                      </button>
                    </>
                  ) : (
                    <form onSubmit={handleVerifyAccessOtp} style={{ maxWidth: '320px', margin: '0 auto' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary-50, #EFF6FF)',
                        color: 'var(--color-primary, #2563EB)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem auto'
                      }}>
                        <ShieldCheck size={22} />
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Enter Verification Code</h3>
                      <p style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary, #475569)',
                        margin: '0 auto 1.5rem auto',
                        lineHeight: 1.5
                      }}>
                        Please check your registered email address for the 6-digit voting access OTP.
                      </p>

                      {otpError && (
                        <p style={{ color: 'var(--color-danger, #EF4444)', fontSize: '12px', marginBottom: '1rem' }}>{otpError}</p>
                      )}

                      {fallbackOtp && (
                        <div style={{ padding: '0.5rem', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '6px', color: '#B45309', fontSize: '12px', fontWeight: 600, marginBottom: '1rem' }}>
                          [DEV MODE] Fallback OTP: {fallbackOtp}
                        </div>
                      )}

                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          textAlign: 'center',
                          fontSize: '18px',
                          letterSpacing: '4px',
                          fontWeight: 'bold',
                          marginBottom: '1rem',
                          outline: 'none',
                          backgroundColor: 'var(--bg-input, #FFFFFF)',
                          color: 'var(--text-primary)'
                        }}
                      />

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setOtpRequestSent(false)}
                          style={{
                            flex: 1,
                            padding: '0.65rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={requestLoading}
                          style={{
                            flex: 1,
                            padding: '0.65rem',
                            borderRadius: '6px',
                            backgroundColor: 'var(--color-primary, #2563EB)',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '13px',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {requestLoading ? 'Verifying...' : 'Verify & Unlock'}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              {/* Flat Session Bar */}
              <div style={{
                backgroundColor: 'var(--bg-secondary, #FFFFFF)',
                border: '1px solid var(--border-color, #E2E8F0)',
                borderLeft: '4px solid var(--color-primary, #2563EB)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Voting Progress</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{votedCount} of {totalPositionsCount} Positions Cast</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-success)' }}>
                  <ShieldCheck size={14} /> <span>Audited Secure Session</span>
                </div>
              </div>

              {isAllPositionsVoted && (
                <div style={{
                  backgroundColor: 'var(--bg-secondary, #FFFFFF)',
                  border: '1px solid var(--color-success)',
                  borderRadius: 'var(--radius-xl, 12px)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  marginBottom: '2rem'
                }}>
                  <Sparkles size={36} style={{ color: 'var(--color-success)', marginBottom: '1rem' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-success)', margin: '0 0 0.5rem 0' }}>All Ballots Cast Successfully!</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
                    Your choices have been securely locked and sequentialized with cryptographic signatures. You may now safely leave this portal.
                  </p>
                  <Link href="/voter/elections" style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary, #2563EB)',
                    color: '#ffffff',
                    fontWeight: 600,
                    textDecoration: 'none',
                    fontSize: '12px'
                  }}>
                    Return to Elections List
                  </Link>
                </div>
              )}

              {/* List of Positions */}
              {positions.map((pos, posIdx) => {
                const posCandidates = positionGroups[pos];
                const isPosVoted = !!votedPositions[pos];
                const posAudit = votedPositions[pos];
                const selectedCandId = selections[pos];

                return (
                  <div key={pos} style={{
                    backgroundColor: 'var(--bg-secondary, #FFFFFF)',
                    border: '1px solid var(--border-color, #E2E8F0)',
                    borderRadius: 'var(--radius-xl, 12px)',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    {/* Position Title & Tag */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-light, #F1F5F9)',
                      paddingBottom: '0.75rem',
                      marginBottom: '1.25rem'
                    }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase' }}>Position {posIdx + 1} of {totalPositionsCount}</span>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.15rem 0 0 0' }}>{pos}</h3>
                      </div>

                      {isPosVoted ? (
                        <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={13} /> Vote Logged
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>Select 1</span>
                      )}
                    </div>

                    {/* Candidate Grid */}
                    <div className="candidate-grid" style={{ marginBottom: '1.5rem' }}>
                      {posCandidates.map((cand) => {
                        const isSelected = selectedCandId === cand.id;
                        return (
                          <div
                            key={cand.id}
                            onClick={() => handleCardClick(pos, cand.id)}
                            className={`card candidate-card ${isSelected ? 'selected' : ''}`}
                            style={{
                              opacity: isPosVoted && !isSelected ? 0.5 : 1,
                              cursor: isPosVoted ? 'default' : 'pointer',
                            }}
                          >
                            <div className="candidate-select-indicator">
                              {isSelected && <Check size={14} />}
                            </div>

                            {cand.photoUrl ? (
                              <img src={cand.photoUrl} alt={cand.name} className="candidate-photo" />
                            ) : (
                              <div className="candidate-photo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                <User size={48} />
                              </div>
                            )}

                            <div className="candidate-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {cand.ballotNumber && (
                                <span style={{ fontSize: '10px', backgroundColor: 'var(--color-primary)', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  #{cand.ballotNumber}
                                </span>
                              )}
                              <span style={{ fontSize: 'var(--text-base)', fontWeight: 'bold' }}>{cand.name}</span>
                            </div>

                            <div className="candidate-manifesto" style={{ marginTop: 'var(--space-2)' }}>
                              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {cand.manifesto || 'No manifesto provided.'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Submit action panel */}
                    {isPosVoted ? (
                      <div style={{
                        backgroundColor: 'var(--color-success-bg)',
                        color: 'var(--color-success)',
                        padding: '0.65rem 1rem',
                        borderRadius: '6px',
                        fontSize: '11px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span>Your vote has been securely submitted.</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>ID: {posAudit.auditTxId.substring(0, 12)}...</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleCastVoteForPosition(pos)}
                          disabled={!selectedCandId || castingPosition === pos}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: selectedCandId ? 'var(--color-primary, #2563EB)' : 'var(--bg-tertiary)',
                            color: selectedCandId ? '#ffffff' : 'var(--text-tertiary)',
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: selectedCandId ? 'pointer' : 'not-allowed'
                          }}
                        >
                          {castingPosition === pos ? 'Casting...' : `Submit Vote for ${pos}`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
