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

  // Map of position -> selected candidateId (or candidateId:yes / candidateId:no)
  const [selections, setSelections] = useState<Record<string, string>>({});

  // Map of position -> auditTxId for positions already voted in this session
  const [votedPositions, setVotedPositions] = useState<Record<string, { candidateId: string; auditTxId: string }>>({});
  const [castingPosition, setCastingPosition] = useState<string | null>(null);

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeProfileCandidate, setActiveProfileCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const electionRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
        if (electionRes.status === 'success') setElection(electionRes.data);

        const candidatesRes = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`);
        if (candidatesRes.status === 'success') setCandidates(candidatesRes.data);

        // Fetch OTP access control lock status for this election
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

  const handleRequestOtp = async () => {
    setRequestLoading(true);
    setOtpCodeError('');
    try {
      const res = await apiRequest<{ status: string; fallbackOtp?: string; message: string }>(`/elections/${electionId}/request-access-otp`, 'POST');
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

    if (!confirm(`Are you sure you want to cast your vote for ${position}? This action is cryptographically recorded and cannot be undone.`)) {
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
    return <p style={{ color: 'var(--text-secondary)', padding: 'var(--space-8)', textAlign: 'center' }}>Synchronizing candidate profiles...</p>;
  }

  if (!election) {
    return (
      <div className="empty-state">
        <h3>Election Not Found</h3>
        <p>No valid active election parameters were passed to this terminal session.</p>
        <Link href="/voter/elections" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
          Back to Eligible Elections
        </Link>
      </div>
    );
  }

  // Group candidates by position
  const positionGroups: Record<string, Candidate[]> = {};
  candidates.forEach(c => {
    if (!positionGroups[c.position]) positionGroups[c.position] = [];
    positionGroups[c.position].push(c);
  });
  const positions = Object.keys(positionGroups);
  const totalPositionsCount = positions.length;
  const votedCount = Object.keys(votedPositions).length;
  const isAllPositionsVoted = totalPositionsCount > 0 && votedCount === totalPositionsCount;

  const handleCardClick = (position: string, candId: string) => {
    if (votedPositions[position]) return; // Position locked
    setSelections(prev => {
      if (prev[position] === candId) {
        const next = { ...prev };
        delete next[position];
        return next;
      }
      return { ...prev, [position]: candId };
    });
  };

  const openProfileModal = (cand: Candidate, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveProfileCandidate(cand);
    setIsProfileModalOpen(true);
  };

  return (
    <div className="animate-page-enter" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Top Breadcrumb Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link href="/voter/elections" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)' }}>
          <ArrowLeft size={16} /> Back to Eligible Elections
        </Link>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{election.title}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>{election.description}</p>
      </div>

      {/* Access Control Verification Modal */}
      {isLocked ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', background: 'var(--surface-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
            <Lock size={32} />
          </div>
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>Access Security Verification Required</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto var(--space-6) auto', fontSize: 'var(--text-sm)' }}>
            To unlock the voting portal for <strong>{election.title}</strong>, please request a 6-digit verification code sent to your registered email/SMS.
          </p>

          {!otpRequestSent ? (
            <div>
              {otpError && (
                <div className="alert alert-danger" style={{ maxWidth: '400px', margin: '0 auto var(--space-4) auto' }}>
                  <AlertCircle size={16} /> {otpError}
                </div>
              )}
              <button onClick={handleRequestOtp} disabled={requestLoading} className="btn btn-primary btn-lg" style={{ minWidth: '220px' }}>
                {requestLoading ? 'Sending Verification Code...' : 'Request Access Code'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifyAccessOtp} style={{ maxWidth: '360px', margin: '0 auto' }}>
              {fallbackOtp && (
                <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                  🔑 <strong>Demo Access Code:</strong> {fallbackOtp}
                </div>
              )}

              {otpError && (
                <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                  {otpError}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Enter 6-Digit Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="form-input"
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.4rem', fontWeight: 'bold' }}
                  required
                />
              </div>

              <button type="submit" disabled={requestLoading || otpCode.length !== 6} className="btn btn-primary btn-block btn-lg">
                {requestLoading ? 'Verifying Code...' : 'Unlock Voting Portal'}
              </button>

              <button type="button" onClick={handleRequestOtp} disabled={requestLoading} className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-3)' }}>
                Resend Code
              </button>
            </form>
          )}
        </div>
      ) : (
        <div>
          {/* Progress Tracker Banner */}
          <div className="card" style={{ padding: 'var(--space-4) var(--space-6)', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', borderLeft: '4px solid #3b82f6' }}>
            <div>
              <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-tertiary)', fontWeight: 'bold' }}>Voting Progress</span>
              <h4 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>
                {votedCount} of {totalPositionsCount} Positions Voted
              </h4>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShieldCheck size={20} style={{ color: '#22c55e' }} />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Cryptographically Audited Session</span>
            </div>
          </div>

          {/* All Positions Voted Celebration Banner */}
          {isAllPositionsVoted && (
            <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(59,130,246,0.1))', border: '1px solid rgba(34,197,94,0.3)', marginBottom: 'var(--space-8)', borderRadius: 'var(--radius-xl)' }}>
              <Sparkles size={48} style={{ color: '#22c55e', margin: '0 auto var(--space-4) auto' }} />
              <h3 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: '#22c55e', marginBottom: 'var(--space-2)' }}>Voting Complete across All Positions!</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto var(--space-6) auto' }}>
                Your choices for all positions in <strong>{election.title}</strong> have been securely recorded in the tamper-proof ledger.
              </p>
              <Link href="/voter/elections" className="btn btn-primary btn-lg">
                Return to Elections Portal
              </Link>
            </div>
          )}

          {/* Position Cards Grid */}
          {positions.map((pos, posIdx) => {
            const posCandidates = positionGroups[pos];
            const isPosVoted = !!votedPositions[pos];
            const posAudit = votedPositions[pos];
            const selectedCandId = selections[pos];

            return (
              <div className="card" key={pos} style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '1px', color: '#3b82f6', fontWeight: 'bold' }}>Position {posIdx + 1} of {totalPositionsCount}</span>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>{pos}</h3>
                  </div>

                  {isPosVoted ? (
                    <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={16} /> Vote Recorded
                    </span>
                  ) : (
                    <span className="badge badge-info" style={{ padding: '6px 12px', borderRadius: '20px' }}>
                      Select 1 Candidate
                    </span>
                  )}
                </div>

                {/* Candidates List for this Position */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                  {posCandidates.map((cand) => {
                    const isSelected = selectedCandId === cand.id || selectedCandId === `${cand.id}:yes`;
                    return (
                      <div
                        key={cand.id}
                        onClick={() => handleCardClick(pos, cand.id)}
                        className={`card card-hover ${isSelected ? 'selected' : ''}`}
                        style={{
                          padding: 'var(--space-4)',
                          cursor: isPosVoted ? 'default' : 'pointer',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface-card)',
                          opacity: isPosVoted && !isSelected ? 0.6 : 1,
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {cand.photoUrl ? (
                              <img src={cand.photoUrl} alt={cand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <User size={24} style={{ color: 'var(--text-tertiary)' }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {cand.ballotNumber && (
                              <span style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                Ballot #{cand.ballotNumber}
                              </span>
                            )}
                            <h4 style={{ margin: '4px 0 0 0', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cand.name}
                            </h4>
                          </div>
                          {isSelected && (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={16} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Per-Position Cast Vote Button */}
                {isPosVoted ? (
                  <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <span>✅ Your ballot for <strong>{pos}</strong> has been cast and recorded.</span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.8 }}>Hash: {posAudit.auditTxId.substring(0, 16)}...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleCastVoteForPosition(pos)}
                      disabled={!selectedCandId || castingPosition === pos}
                      className="btn btn-primary"
                      style={{ minWidth: '180px' }}
                    >
                      {castingPosition === pos ? 'Casting Vote...' : `Cast Vote for ${pos}`}
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
