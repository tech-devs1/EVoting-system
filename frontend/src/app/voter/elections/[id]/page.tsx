'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { ArrowLeft, Check, ArrowRight, ShieldCheck } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  manifesto: string;
  photoUrl: string;
  isIndependent?: boolean;
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

  // Preserve selections when returning from Confirm Page via Go Back button
  useEffect(() => {
    if (typeof window !== 'undefined' && candidates.length > 0) {
      const search = new URLSearchParams(window.location.search);
      const paramCandIds = search.getAll('candidateId');
      if (paramCandIds.length > 0) {
        const restored: Record<string, string> = {};
        candidates.forEach(cand => {
          const matched = paramCandIds.find(id => id === cand.id || id.startsWith(`${cand.id}:`));
          if (matched) {
            restored[cand.position] = matched;
          }
        });
        if (Object.keys(restored).length > 0) {
          setSelections(prev => ({ ...restored, ...prev }));
        }
      }
    }
  }, [candidates]);

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

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)', padding: 'var(--space-8)', textAlign: 'center' }}>Synchronizing candidate profiles...</p>;
  }

  if (!election) {
    return (
      <div className="empty-state">
        <h3>Election Not Found</h3>
        <p>No valid active election parameters were passed to this terminal session.</p>
        <Link href="/voter/dashboard" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Group candidates by position (preserve insertion order)
  const positionGroups: Record<string, Candidate[]> = {};
  candidates.forEach(c => {
    if (!positionGroups[c.position]) positionGroups[c.position] = [];
    positionGroups[c.position].push(c);
  });
  const positions = Object.keys(positionGroups);
  const allSelected = positions.every(p => !!selections[p]);

  const handleCardClick = (position: string, candId: string) => {
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

  const selectCandidateFromModal = () => {
    if (activeProfileCandidate) {
      setSelections(prev => ({ ...prev, [activeProfileCandidate.position]: activeProfileCandidate.id }));
      setIsProfileModalOpen(false);
    }
  };

  const handleProceed = () => {
    // Pass all selections as query params
    const params = new URLSearchParams();
    Object.entries(selections).forEach(([, candId]) => params.append('candidateId', candId));
    router.push(`/voter/elections/${electionId}/confirm?${params.toString()}`);
  };

  // Time & Duration enforcement
  const now = Date.now();
  const startTime = election?.startDate ? new Date(election.startDate).getTime() : 0;
  const endTime = election?.endDate ? new Date(election.endDate).getTime() : Infinity;

  const isBeforeStart = startTime > 0 && now < startTime;
  const isAfterEnd = endTime < Infinity && now > endTime;
  const isVotingAllowed = !isBeforeStart && !isAfterEnd && election?.status !== 'completed';

  // OTP CHALLENGE OVERLAY (LOCK ACCESS TO CANDIDATE SELECTION PAGE UNTIL VERIFIED)
  if (isLocked) {
    return (
      <div className="candidate-selection-container animate-page-enter" style={{ maxWidth: '500px', margin: '40px auto' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Link href="/voter/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)' }}>
            <ArrowLeft size={16} /> Return to Dashboard
          </Link>
        </div>

        <div className="glass-card-strong text-center" style={{ padding: 'var(--space-8)' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.1)',
            color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-4) auto'
          }}>
            <ShieldCheck size={32} />
          </div>

          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', marginBottom: 'var(--space-2)' }}>
            Identity Verification Required
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', lineHeight: '1.6' }}>
            To participate in the <strong>{election.title}</strong> election, you must confirm your membership by requesting and entering a secure 6-digit verification code.
          </p>

          {otpError && (
            <div className="alert alert-danger" style={{
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--text-sm)',
              padding: '10px 14px',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)'
            }}>
              {otpError}
            </div>
          )}

          {!otpRequestSent ? (
            <button
              type="button"
              onClick={handleRequestOtp}
              className="btn btn-primary btn-full"
              disabled={requestLoading}
              style={{ padding: '12px' }}
            >
              {requestLoading ? 'Requesting Code...' : 'Request Verification Code'}
            </button>
          ) : (
            <form onSubmit={handleVerifyAccessOtp}>
              {fallbackOtp && (
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-4)',
                  fontSize: 'var(--text-sm)',
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: 'rgb(217, 119, 6)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  textAlign: 'center',
                  fontWeight: 500
                }}>
                  📢 <strong>[Demo Mode Fallback]</strong><br />
                  Use code: <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)', letterSpacing: '2px' }}>{fallbackOtp}</strong>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit Code"
                  className="form-input text-center"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  style={{ fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '4px', height: '52px', border: '2px solid var(--color-primary)' }}
                  required
                  disabled={requestLoading}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => { setOtpRequestSent(false); setOtpCode(''); setOtpCodeError(''); }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={requestLoading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  disabled={requestLoading}
                >
                  {requestLoading ? 'Verifying...' : 'Verify & Unlock'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // RENDER THE FULL ELECTION INTERFACE ONCE ACCESS IS UNLOCKED
  return (
    <div className="candidate-selection-container animate-page-enter">
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <Link href="/voter/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>{election.title}</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '700px' }}>{election.description}</p>
      </div>

      {/* Time Enforcement Banners */}
      {isBeforeStart && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
          ⚠️ <strong>Voting Not Yet Open:</strong> This election is scheduled to start on {new Date(election.startDate!).toLocaleString()}. Voting is currently disabled.
        </div>
      )}
      {isAfterEnd && (
        <div className="alert alert-danger" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)' }}>
          🔒 <strong>Voting Duration Has Ended:</strong> The voting window for this election closed on {new Date(election.endDate!).toLocaleString()}. Further votes cannot be submitted.
        </div>
      )}

      {/* Position sections */}
      {positions.map(position => {
        const group = positionGroups[position];
        const selectedId = selections[position];

        return (
          <div key={position} style={{ marginBottom: 'var(--space-10)' }}>
            {/* Section header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-4)',
              paddingBottom: 'var(--space-3)',
              borderBottom: '2px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: selectedId ? 'var(--color-success, #22c55e)' : 'var(--color-warning, #f59e0b)',
                  flexShrink: 0
                }} />
                <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>
                  {position}
                </h3>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                  background: 'var(--bg-card)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-color)'
                }}>
                  {group.length} candidate{group.length !== 1 ? 's' : ''}
                </span>
                {selectedId && (
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-success, #22c55e)',
                    fontWeight: 'var(--weight-semibold)'
                  }}>
                    ✓ Selected {selectedId.endsWith(':yes') ? '(Yes)' : selectedId.endsWith(':no') ? '(No)' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Candidate cards grid */}
            <div className="candidate-grid">
              {group.map(cand => {
                const isSelected = selectedId === cand.id || selectedId === `${cand.id}:yes` || selectedId === `${cand.id}:no`;
                const isIndie = cand.isIndependent || group.length === 1;

                return (
                  <div
                    className={`card candidate-card ${isSelected ? 'selected' : ''}`}
                    key={cand.id}
                    onClick={() => !isIndie && handleCardClick(position, cand.id)}
                    style={{ cursor: isIndie ? 'default' : 'pointer' }}
                  >
                    {!isIndie && (
                      <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          readOnly
                          style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                        />
                      </div>
                    )}
                    {/* Photo wrapper */}
                    <div className="candidate-photo-wrap">
                      <img
                        src={cand.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'}
                        alt={cand.name}
                        className="candidate-photo"
                      />
                    </div>

                    {/* Content wrapper */}
                    <div className="candidate-content">
                      <div className="candidate-info">
                        <h4 className="candidate-name">
                          {cand.name} {isIndie && <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 'bold' }}>(Independent)</span>}
                        </h4>
                        <span className="candidate-position">{cand.position}</span>
                      </div>

                      {/* Independent Yes / No Choice Buttons */}
                      {isIndie ? (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-3)' }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`btn btn-sm ${selections[position] === `${cand.id}:yes` ? 'btn-success' : 'btn-outline'}`}
                            onClick={() => handleCardClick(position, `${cand.id}:yes`)}
                            style={{ flex: 1, padding: '6px 4px', fontSize: '12px' }}
                          >
                            ✓ Vote Yes
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${selections[position] === `${cand.id}:no` ? 'btn-danger' : 'btn-outline'}`}
                            onClick={() => handleCardClick(position, `${cand.id}:no`)}
                            style={{ flex: 1, padding: '6px 4px', fontSize: '12px', color: selections[position] === `${cand.id}:no` ? '#fff' : 'var(--color-danger)' }}
                          >
                            ✗ Vote No
                          </button>
                        </div>
                      ) : null}

                      {cand.manifesto && cand.manifesto.trim() !== "" && (
                        <div className="candidate-actions" style={{ marginTop: 'var(--space-2)' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm cand-expand-profile-btn"
                            onClick={(e) => openProfileModal(cand, e)}
                            style={{ width: '100%' }}
                          >
                            Read Manifesto
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Progress summary */}
      {positions.length > 1 && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${allSelected ? 'var(--color-success, #22c55e)' : 'var(--border-color)'}`,
          marginBottom: 'var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
            Progress:
          </span>
          {positions.map(p => (
            <span key={p} style={{
              fontSize: 'var(--text-xs)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              background: selections[p] ? 'var(--color-success, #22c55e)' : 'var(--bg-input)',
              color: selections[p] ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${selections[p] ? 'var(--color-success, #22c55e)' : 'var(--border-color)'}`,
              fontWeight: 'var(--weight-medium)'
            }}>
              {selections[p] ? '✓' : '○'} {p}
            </span>
          ))}
        </div>
      )}

      {/* Submit bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-4)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
        <Link href="/voter/dashboard" className="btn btn-secondary">Cancel</Link>
        <button
          className="btn btn-primary"
          disabled={!isVotingAllowed || Object.keys(selections).length === 0}
          onClick={handleProceed}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          title={!isVotingAllowed ? 'Voting is closed or not yet open' : Object.keys(selections).length === 0 ? 'Please select at least one candidate' : ''}
        >
          Review Selection <ArrowRight size={16} />
        </button>
      </div>

      {/* Profile / Manifesto Modal */}
      {isProfileModalOpen && activeProfileCandidate && (
        <div className="modal-overlay active" onClick={() => setIsProfileModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{activeProfileCandidate.name}</h3>
              <button className="modal-close" onClick={() => setIsProfileModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <img
                src={activeProfileCandidate.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'}
                alt={activeProfileCandidate.name}
                style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }}
              />
              <div>
                <span className="candidate-position">{activeProfileCandidate.position}</span>
                {activeProfileCandidate.manifesto ? (
                  <div
                    style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, marginTop: 'var(--space-2)', color: 'var(--text-primary)' }}
                    dangerouslySetInnerHTML={{ __html: activeProfileCandidate.manifesto }}
                  />
                ) : (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                    No manifesto has been uploaded yet.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsProfileModalOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={selectCandidateFromModal}>Select Candidate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
