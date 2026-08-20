'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getEffectiveStatus, isEnded, isActive } from '@/lib/electionStatus';
import { ArrowLeft, Check, ShieldCheck, Lock, CheckCircle2, Sparkles, User, AlertCircle, Calendar, Trophy, Info, BarChart2, ThumbsUp, ThumbsDown, ChevronRight, ChevronLeft } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  positionTitle?: string;
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
  totalVoters?: number;
  totalVotesCast?: number;
  showResults?: boolean;
}

function VoterElectionDetailContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

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

  // Step-by-step wizard state
  // Restore voting progress from sessionStorage on mount
  const sessionKey = electionId ? `vote_progress_${electionId}` : '';
  const loadSavedProgress = () => {
    try {
      if (sessionKey && typeof window !== 'undefined') {
        const saved = sessionStorage.getItem(sessionKey);
        if (saved) return JSON.parse(saved);
      }
    } catch {}
    return null;
  };
  const savedProgress = loadSavedProgress();

  const [currentStep, setCurrentStep] = useState(savedProgress?.currentStep ?? 0);

  // Map of position -> { candidateId, choice: 'yes' | 'no' }
  const [selections, setSelections] = useState<Record<string, { candidateId: string; choice: 'yes' | 'no' }>>(savedProgress?.selections ?? {});

  // Map of position -> auditTxId for positions already voted
  const [votedPositions, setVotedPositions] = useState<Record<string, { candidateId: string; auditTxId: string }>>(savedProgress?.votedPositions ?? {});
  const [castingPosition, setCastingPosition] = useState<string | null>(null);
  const [notOnRoster, setNotOnRoster] = useState(false);

  // Persist voting progress to sessionStorage on every change
  useEffect(() => {
    if (!sessionKey) return;
    try {
      const state = JSON.stringify({ currentStep, selections, votedPositions });
      sessionStorage.setItem(sessionKey, state);
    } catch {}
  }, [sessionKey, currentStep, selections, votedPositions]);

  // Clear saved progress when all positions are voted
  useEffect(() => {
    if (!sessionKey || candidates.length === 0) return;
    const uniquePositions = new Set(candidates.map((c: any) => c.positionTitle || c.position));
    const votedCount = Object.keys(votedPositions).length;
    if (votedCount > 0 && votedCount >= uniquePositions.size) {
      try { sessionStorage.removeItem(sessionKey); } catch {}
    }
  }, [sessionKey, votedPositions, candidates]);

  useEffect(() => {
    if (!electionId) {
      setLoading(false);
      return;
    }

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

        // Fetch existing position votes for current voter in this election
        try {
          const userVotesRes = await apiRequest<{ status: string; data: any[] }>(`/votes/user-votes?electionId=${electionId}`);
          if (userVotesRes.status === 'success' && Array.isArray(userVotesRes.data)) {
            const votedMap: Record<string, { candidateId: string; auditTxId: string }> = {};
            userVotesRes.data.forEach((vote: any) => {
              const posKey = vote.positionTitle || vote.positionId;
              if (posKey) {
                votedMap[posKey] = {
                  candidateId: vote.candidateId,
                  auditTxId: vote.verificationId || vote.encryptedHash || 'VERIFIED'
                };
              }
            });
            setVotedPositions(votedMap);
          }
        } catch (_) {}
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
    const sel = selections[position];
    if (!sel) {
      alert(`Please make a selection for ${position} before casting your vote.`);
      return;
    }

    if (!confirm(`Are you sure you want to cast your vote for ${position}? This choice is final and cryptographically logged.`)) {
      return;
    }

    setCastingPosition(position);
    try {
      const res = await apiRequest<{ status: string; message: string; data?: { verificationId: string } }>('/votes/cast', 'POST', {
        electionId,
        candidateId: sel.candidateId,
        choice: sel.choice
      });

      if (res.status === 'success') {
        const auditTxId = res.data?.verificationId || 'VERIFIED_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        setVotedPositions(prev => ({
          ...prev,
          [position]: { candidateId: sel.candidateId, auditTxId }
        }));
        // Auto-advance to next unvoted position after a brief delay
        setTimeout(() => {
          const nextUnvoted = positions.findIndex((p, i) => i > currentStep && !votedPositions[p] && p !== position);
          if (nextUnvoted >= 0) {
            setCurrentStep(nextUnvoted);
          }
        }, 800);
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

  const turnout = (election.totalVoters && election.totalVoters > 0)
    ? Math.min(100, Math.round(((election.totalVotesCast || 0) / election.totalVoters) * 100))
    : 0;

  // Group candidates by position and sort strictly by ballot number ascending
  const positionGroups: Record<string, Candidate[]> = {};
  candidates.forEach(c => {
    const posName = c.positionTitle || c.position;
    if (!positionGroups[posName]) positionGroups[posName] = [];
    positionGroups[posName].push(c);
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

  const handleCandidateSelect = (position: string, candId: string) => {
    if (votedPositions[position]) return;
    setSelections(prev => {
      const current = prev[position];
      if (current && current.candidateId === candId && current.choice === 'yes') {
        const next = { ...prev };
        delete next[position];
        return next;
      }
      return { ...prev, [position]: { candidateId: candId, choice: 'yes' } };
    });
  };

  const handleYesVote = (position: string, candId: string) => {
    if (votedPositions[position]) return;
    setSelections(prev => ({ ...prev, [position]: { candidateId: candId, choice: 'yes' } }));
  };

  const handleNoVote = (position: string, candId: string) => {
    if (votedPositions[position]) return;
    setSelections(prev => ({ ...prev, [position]: { candidateId: candId, choice: 'no' } }));
  };

  // Identify independent (unopposed) positions: single candidate marked as independent
  const isIndependentPosition = (pos: string) => {
    const cands = positionGroups[pos];
    return cands.length === 1 && cands[0].isIndependent;
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
      {/* Top Breadcrumb Navigation */}
      <div>
        <Link
          href="/voter/elections"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-2"
        >
          <ArrowLeft size={14} /> Back to Eligible Elections
        </Link>
      </div>

      {/* --- PHASE 1: ELECTION DETAILS & DESCRIPTIONS VIEW --- */}
      {!proceedToBallot ? (
        <div className="flex flex-col gap-6">

          {/* Election Card Header Image or Fallback */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
            {election.previewImageUrl ? (
              <img
                src={election.previewImageUrl}
                alt={election.title}
                className="w-full h-56 object-cover"
              />
            ) : (
              <div className="w-full h-40 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Sparkles size={48} />
              </div>
            )}

            <div className="p-6">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                  {election.category || 'Executive'}
                </span>
                {(() => {
                  const effStatus = getEffectiveStatus(election);
                  return (
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      effStatus === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {effStatus === 'active' ? '🟢 Active' : '🏁 Ended'}
                    </span>
                  );
                })()}
                {votedCount > 0 && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                    ✓ {votedCount}/{totalPositionsCount} Positions Voted
                  </span>
                )}
              </div>

              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">{election.title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{election.description}</p>
            </div>
          </div>

          {/* Guidelines and Timing Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex items-start gap-3 shadow-sm">
              <Calendar size={20} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">Poll Schedule</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Opens: {new Date(election.startDate).toLocaleString()}<br />
                  Closes: {new Date(election.endDate).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex items-start gap-3 shadow-sm">
              <Info size={20} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">Voting Guidelines</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isAllPositionsVoted
                    ? 'You have completed voting for all positions. Your choices are securely locked.'
                    : 'You will vote one position at a time. Unopposed candidates require a Yes or No vote. Once cast, your choice is final.'}
                </p>
              </div>
            </div>
          </div>

          {/* List of Registered Candidate Standings and Manifestos (View-Only Mode) */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
              <Trophy size={18} className="text-blue-600 dark:text-blue-400" /> Official Candidate Lineup
            </h3>

            {positions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No candidates are registered for this election yet.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {positions.map((pos, posIdx) => (
                  <div key={pos} className={`${posIdx === positions.length - 1 ? '' : 'border-b border-slate-100 dark:border-slate-700/60 pb-5'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        {pos} {isIndependentPosition(pos) && <span className="text-slate-400 normal-case">(Unopposed — Yes/No vote)</span>}
                      </h4>
                      {votedPositions[pos] && (
                        <span className="text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/30">
                          ✓ Vote Locked
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {positionGroups[pos].map((cand) => {
                        const isVotedCand = votedPositions[pos]?.candidateId === cand.id;
                        return (
                          <div key={cand.id} className={`flex items-start gap-3 p-3 rounded-2xl border ${
                            isVotedCand
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500'
                              : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/80'
                          }`}>
                            {cand.photoUrl ? (
                              <img src={cand.photoUrl} alt={cand.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                <User size={20} />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {cand.ballotNumber && (
                                  <span className="text-[9px] font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded">
                                    #{cand.ballotNumber}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{cand.name}</span>
                                {isVotedCand && (
                                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 ml-auto">
                                    (Your Vote)
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
                                {cand.manifesto || 'No manifesto provided.'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action CTA Trigger */}
          <div className="flex flex-col items-center gap-4 mt-2 w-full">
            {!isEnded(election) ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <button
                  onClick={() => setProceedToBallot(true)}
                  className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-colors shadow-lg shadow-blue-500/25 flex items-center gap-2"
                >
                  <ShieldCheck size={18} /> {isAllPositionsVoted ? 'View Your Locked Ballot' : 'Proceed to Cast Vote'}
                </button>
                {election.showResults && (
                  <Link
                    href={`/voter/elections/results?id=${election.id}`}
                    className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-2"
                  >
                    <BarChart2 size={16} /> View Live Results
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 items-center">
                <div className="px-8 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700">
                  Polls Closed
                </div>
                {election.showResults ? (
                  <Link
                    href={`/voter/elections/results?id=${election.id}`}
                    className="px-8 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-2"
                  >
                    <BarChart2 size={16} /> View Results
                  </Link>
                ) : (
                  <p className="text-xs text-slate-400 font-medium">Results are not made public yet.</p>
                )}
              </div>
            )}
          </div>

        </div>
      ) : (
        /* --- PHASE 2: SECURE OTP VERIFICATION & BALLOT INTERACTIVE VIEW --- */
        <div className="flex flex-col gap-6">
          <button
            onClick={() => setProceedToBallot(false)}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline self-start"
          >
            <ArrowLeft size={14} /> Back to Election Details
          </button>

          {isLocked ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 md:p-12 text-center max-w-md mx-auto shadow-sm w-full">
              {notOnRoster ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={22} />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">Access Restricted</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                    {otpError || 'Your account is not listed on the official voter roster for this election.'}
                  </p>
                  <button
                    onClick={() => setProceedToBallot(false)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors"
                  >
                    Return to Details
                  </button>
                </>
              ) : (
                <>
                  {!otpRequestSent ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                        <Lock size={22} />
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">Verification Required</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                        An identity verification code is required to unlock your voting ballot. Please request a 6-digit access code.
                      </p>

                      {user?.email && (
                        <div className="mb-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Code will be sent to: <strong className="text-blue-600 dark:text-blue-400">{user.email}</strong>
                        </div>
                      )}

                      {otpError && (
                        <p className="text-red-500 text-xs font-bold mb-4">{otpError}</p>
                      )}

                      <button
                        onClick={handleRequestOtp}
                        disabled={requestLoading}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
                      >
                        {requestLoading ? 'Requesting...' : 'Request Access Code'}
                      </button>
                    </>
                  ) : (
                    <form onSubmit={handleVerifyAccessOtp} className="flex flex-col gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2">
                        <ShieldCheck size={22} />
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Enter Verification Code</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                        Please check your registered email address for the 6-digit voting access OTP.
                      </p>

                      {otpError && (
                        <p className="text-red-500 text-xs font-bold">{otpError}</p>
                      )}

                      {fallbackOtp && typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold">
                          [DEV MODE] Fallback OTP: {fallbackOtp}
                        </div>
                      )}

                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-600 text-center text-xl tracking-[0.25em] font-extrabold bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setOtpRequestSent(false)}
                          className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={requestLoading}
                          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors disabled:opacity-50"
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
            <div className="flex flex-col gap-6">
              {/* Session Status Bar */}
              <div className="bg-white dark:bg-slate-800 border-l-4 border-l-blue-600 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex justify-between items-center flex-wrap gap-2 shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Voting Progress</span>
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">{votedCount} of {totalPositionsCount} Positions Cast</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={16} /> <span>Audited Secure Session</span>
                </div>
              </div>

              {/* Step indicator dots */}
              {!isAllPositionsVoted && totalPositionsCount > 1 && (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {positions.map((pos, idx) => {
                    const isVoted = !!votedPositions[pos];
                    const isCurrent = idx === currentStep;
                    return (
                      <button
                        key={pos}
                        onClick={() => setCurrentStep(idx)}
                        className={`w-8 h-8 rounded-full text-[10px] font-extrabold transition-all flex items-center justify-center ${
                          isVoted
                            ? 'bg-emerald-500 text-white cursor-pointer'
                            : isCurrent
                              ? 'bg-blue-600 text-white ring-2 ring-blue-300 dark:ring-blue-700 cursor-pointer'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer'
                        }`}
                        title={pos}
                      >
                        {isVoted ? <Check size={14} /> : idx + 1}
                      </button>
                    );
                  })}
                </div>
              )}

              {isAllPositionsVoted && (
                <div className="bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-3xl p-8 text-center shadow-lg shadow-emerald-500/10">
                  <Sparkles size={36} className="text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mb-1">All Ballots Cast Successfully!</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
                    Your choices have been securely locked and sequentialized with cryptographic signatures.
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md mx-auto text-left mb-6">
                    <div className="flex justify-between text-xs font-bold text-slate-900 dark:text-white mb-2">
                      <span>Live Turnout Progress</span>
                      <span>{turnout}% ({election.totalVotesCast || 0} / {election.totalVoters || 0} voters)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${turnout}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Link href="/voter/elections" className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors">
                      Return to Elections List
                    </Link>
                    {election.showResults && (
                      <Link href={`/voter/elections/results?id=${election.id}`} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5">
                        <BarChart2 size={16} /> View Results
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Step-by-step: One Position at a Time */}
              {!isAllPositionsVoted && positions.length > 0 && (() => {
                const pos = positions[currentStep];
                if (!pos) return null;
                const posCandidates = positionGroups[pos];
                const isPosVoted = !!votedPositions[pos];
                const posAudit = votedPositions[pos];
                const sel = selections[pos];
                const isIndependent = isIndependentPosition(pos);
                const soloCand = isIndependent ? posCandidates[0] : null;

                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm flex flex-col gap-5">
                    {/* Position Title & Tag */}
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700/60">
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          Position {currentStep + 1} of {totalPositionsCount}
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{pos}</h3>
                      </div>

                      {isPosVoted ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                          <CheckCircle2 size={14} /> Vote Logged & Locked
                        </span>
                      ) : isIndependent ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                          Unopposed — Yes/No
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Select 1</span>
                      )}
                    </div>

                    {/* INDEPENDENT / UNOPPOSED POSITION: Yes/No Vote UI */}
                    {isIndependent && soloCand ? (
                      <div className="flex flex-col gap-4">
                        {/* Candidate profile card */}
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80">
                          <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {soloCand.photoUrl ? (
                              <img src={soloCand.photoUrl} alt={soloCand.name} className="w-full h-full object-cover" />
                            ) : (
                              <User size={28} className="text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              {soloCand.ballotNumber && (
                                <span className="text-[9px] font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded">
                                  #{soloCand.ballotNumber}
                                </span>
                              )}
                              <span className="text-sm font-bold text-slate-900 dark:text-white">{soloCand.name}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                              {soloCand.manifesto || 'No manifesto provided.'}
                            </p>
                          </div>
                        </div>

                        {/* Yes / No buttons */}
                        {isPosVoted ? (
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex justify-between items-center border border-emerald-200 dark:border-emerald-900/30">
                            <span>Your vote: <strong>{posAudit.candidateId === soloCand.id ? 'Yes' : 'No'}</strong> — locked.</span>
                            <span className="font-mono text-[10px] font-bold">{posAudit.auditTxId.substring(0, 12)}...</span>
                          </div>
                        ) : (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleYesVote(pos, soloCand.id)}
                              disabled={castingPosition === pos}
                              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-sm transition-all ${
                                sel?.choice === 'yes'
                                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-300 dark:ring-emerald-700'
                                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                              }`}
                            >
                              <ThumbsUp size={20} /> Yes
                            </button>
                            <button
                              onClick={() => handleNoVote(pos, soloCand.id)}
                              disabled={castingPosition === pos}
                              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-sm transition-all ${
                                sel?.choice === 'no'
                                  ? 'bg-red-600 text-white shadow-lg shadow-red-500/25 ring-2 ring-red-300 dark:ring-red-700'
                                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-2 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/60'
                              }`}
                            >
                              <ThumbsDown size={20} /> No
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* REGULAR POSITION: Candidate Selection Cards */
                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {posCandidates.map((cand) => {
                            const isVotedCand = isPosVoted && posAudit.candidateId === cand.id;
                            const isSelected = sel?.candidateId === cand.id || isVotedCand;

                            return (
                              <div
                                key={cand.id}
                                onClick={() => handleCandidateSelect(pos, cand.id)}
                                className={`p-4 rounded-2xl border transition-all flex items-center gap-3 relative ${
                                  isPosVoted
                                    ? isVotedCand
                                      ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-500 shadow-sm cursor-default'
                                      : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800 opacity-50 cursor-default'
                                    : isSelected
                                      ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 shadow-sm cursor-pointer'
                                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'
                                }`}
                              >
                                <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                                  {cand.photoUrl ? (
                                    <img src={cand.photoUrl} alt={cand.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <User size={24} className="text-slate-400" />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    {cand.ballotNumber && (
                                      <span className="text-[9px] font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded">
                                        #{cand.ballotNumber}
                                      </span>
                                    )}
                                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{cand.name}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
                                    {cand.manifesto || 'No manifesto provided.'}
                                  </p>
                                </div>

                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                                  isVotedCand
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : isSelected
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                  {isSelected && <Check size={12} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Submit Action Panel */}
                    {isPosVoted ? (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex justify-between items-center border border-emerald-200 dark:border-emerald-900/30">
                        <span>Vote cast and locked.</span>
                        <span className="font-mono text-[10px] font-bold">Receipt: {posAudit.auditTxId.substring(0, 12)}...</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                          disabled={currentStep === 0}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <ChevronLeft size={14} /> Previous
                        </button>
                        <div className="flex items-center gap-3">
                          {currentStep < totalPositionsCount - 1 && (
                            <button
                              onClick={() => {
                                // Auto-advance to next unvoted position
                                for (let i = currentStep + 1; i < positions.length; i++) {
                                  if (!votedPositions[positions[i]]) {
                                    setCurrentStep(i);
                                    return;
                                  }
                                }
                                // All after are voted, wrap to first unvoted
                                for (let i = 0; i < positions.length; i++) {
                                  if (!votedPositions[positions[i]]) {
                                    setCurrentStep(i);
                                    return;
                                  }
                                }
                              }}
                              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5"
                            >
                              Skip <ChevronRight size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleCastVoteForPosition(pos)}
                            disabled={!sel || castingPosition === pos}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 text-white disabled:text-slate-400 text-xs font-bold rounded-xl transition-colors disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
                          >
                            {castingPosition === pos ? 'Casting...' : `Cast Vote`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VoterElectionDetailPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Synchronizing candidate profiles...</div>}>
      <VoterElectionDetailContent />
    </Suspense>
  );
}
