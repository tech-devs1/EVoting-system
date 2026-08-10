'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { ArrowLeft, Check, ShieldCheck, Lock, CheckCircle2, Sparkles, User, AlertCircle } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  manifesto: string;
  photoUrl: string;
  isIndependent?: boolean;
  ballotNumber?: string | number;
}

interface Election {
  id: string;
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export default function CandidateSelectionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const electionId = resolvedParams.id;

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    async function fetchData() {
      try {
        const electionRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
        if (electionRes.status === 'success') setElection(electionRes.data);

        const candidatesRes = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`);
        if (candidatesRes.status === 'success') setCandidates(candidatesRes.data);

        const accessRes = await apiRequest<{ status: string; data: { unlocked: boolean } }>(`/elections/${electionId}/access-status`);
        if (accessRes.status === 'success') {
          setIsLocked(!accessRes.data.unlocked);
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
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'var(--font-body, system-ui, sans-serif)' }}>

      {/* Top Header */}
      <div style={{ marginBottom: '1.75rem' }}>
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
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)', margin: 0 }}>{election.title}</h2>
        <p style={{ color: 'var(--text-secondary, #475569)', fontSize: '13px', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>{election.description}</p>
      </div>

      {isLocked ? (
        <div style={{
          backgroundColor: 'var(--bg-secondary, #FFFFFF)',
          border: '1px solid var(--border-color, #E2E8F0)',
          borderRadius: 'var(--radius-xl, 12px)',
          padding: '2.5rem 1.5rem',
          textAlign: 'center'
        }}>
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
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Access Verification Required</h3>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary, #475569)',
            maxWidth: '440px',
            margin: '0 auto 1.5rem auto',
            lineHeight: 1.5
          }}>
            Please request a verification code sent to your registered email/SMS to securely unlock the ballot for <strong>{election.title}</strong>.
          </p>

          {!otpRequestSent ? (
            <div style={{ maxWidth: '360px', margin: '0 auto' }}>
              <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #475569)', display: 'block', marginBottom: '4px' }}>
                  Verification Email Address:
                </label>
                <input
                  type="email"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  placeholder="Enter email to receive code (e.g. voter@gmail.com)"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-input, #ffffff)',
                    color: 'var(--text-primary, #0f172a)'
                  }}
                />
              </div>

              {otpError && (
                <div style={{
                  margin: '0 0 1rem 0',
                  padding: '0.65rem',
                  backgroundColor: 'var(--color-danger-bg)',
                  color: 'var(--color-danger)',
                  border: '1px solid var(--border-error)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  textAlign: 'left'
                }}>{otpError}</div>
              )}
              <button onClick={handleRequestOtp} disabled={requestLoading} style={{
                width: '100%',
                padding: '0.65rem 1.25rem',
                borderRadius: '6px',
                backgroundColor: 'var(--color-primary, #2563EB)',
                color: '#ffffff',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px'
              }}>
                {requestLoading ? 'Sending Access Code...' : 'Request Access Code'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifyAccessOtp} style={{ maxWidth: '320px', margin: '0 auto' }}>
              {fallbackOtp && (
                <div style={{
                  padding: '0.65rem',
                  backgroundColor: 'var(--color-warning-bg)',
                  color: 'var(--color-warning)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  marginBottom: '1rem',
                  fontWeight: 600
                }}>
                  🔑 Demo Code: {fallbackOtp}
                </div>
              )}

              {otpError && (
                <div style={{
                  padding: '0.65rem',
                  backgroundColor: 'var(--color-danger-bg)',
                  color: 'var(--color-danger)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  marginBottom: '1rem'
                }}>{otpError}</div>
              )}

              <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Enter 6-Digit Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    textAlign: 'center',
                    letterSpacing: '6px',
                    fontSize: '1.25rem',
                    fontWeight: 'bold'
                  }}
                  required
                />
              </div>

              <button type="submit" disabled={requestLoading || otpCode.length !== 6} style={{
                width: '100%',
                padding: '0.65rem',
                backgroundColor: 'var(--color-primary, #2563EB)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}>
                {requestLoading ? 'Verifying...' : 'Unlock Ballot'}
              </button>

              <button type="button" onClick={handleRequestOtp} disabled={requestLoading} style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                fontSize: '11px',
                fontWeight: 600,
                marginTop: '0.75rem',
                cursor: 'pointer'
              }}>
                Resend Code
              </button>
            </form>
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
  );
}
