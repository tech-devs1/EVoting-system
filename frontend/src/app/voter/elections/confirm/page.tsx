'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { AlertTriangle, ArrowLeft, ShieldCheck, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Candidate {
  id: string;
  name: string;
  position: string;
  photoUrl: string;
  selectedId?: string;
  choice?: string;
  ballotNumber?: string | number;
}

interface Election {
  id: string;
  title: string;
}

function VoteConfirmationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';
  const { user } = useAuth();
  
  // Get all candidate IDs passed in search params
  const candidateIds = searchParams.getAll('candidateId');

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!electionId || candidateIds.length === 0) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const electionRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
        if (electionRes.status === 'success') {
          setElection(electionRes.data);
        }

        const candidatesRes = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`);
        if (candidatesRes.status === 'success') {
          const selectedMap = new Map<string, { fullId: string; choice?: string }>();
          candidateIds.forEach(fullId => {
            const parts = fullId.split(':');
            const baseId = parts[0];
            const choice = parts[1];
            selectedMap.set(baseId, { fullId, choice });
          });

          const filtered = candidatesRes.data
            .filter(c => selectedMap.has(c.id))
            .map(c => {
              const sel = selectedMap.get(c.id);
              return {
                ...c,
                selectedId: sel?.fullId || c.id,
                choice: sel?.choice
              };
            });
          setCandidates(filtered);
        }
      } catch (err) {
        console.error('Error fetching confirmation data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [electionId, searchParams]);

  if (loading) {
    return <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Preparing ballot confirmation details...</p>;
  }

  if (!election || candidates.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center max-w-md mx-auto shadow-sm">
        <AlertTriangle size={48} className="text-red-500 mx-auto mb-3" />
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Invalid Session</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">No valid candidate selection parameters were registered for this checkout flow.</p>
        <Link href="/voter/elections" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors inline-block">
          Back to Elections
        </Link>
      </div>
    );
  }

  const castBallot = async () => {
    setError('');
    setSubmitting(true);
    try {
      const castPromises = candidates.map(cand =>
        apiRequest<{ 
          status: string; 
          data: { verificationId: string } 
        }>('/votes/cast', 'POST', {
          electionId,
          candidateId: cand.selectedId || cand.id
        })
      );

      const responses = await Promise.all(castPromises);
      const verificationId = responses[0]?.data?.verificationId || 'verified';

      if (typeof window !== 'undefined') {
        const storedVotes = localStorage.getItem('COMPSSA_voter_votes') || '[]';
        const parsed = JSON.parse(storedVotes);
        
        responses.forEach((res, i) => {
          if (res.status === 'success') {
            const cand = candidates[i];
            parsed.push({
              id: res.data.verificationId,
              electionId,
              electionName: `${election.title} — ${cand.position}`,
              timestamp: new Date().toISOString()
            });
          }
        });
        
        localStorage.setItem('COMPSSA_voter_votes', JSON.stringify(parsed));
      }

      router.push(`/voter/elections/success?id=${electionId}&verificationId=${verificationId}`);
    } catch (err: any) {
      setError(err.message || 'Transmission failed. Ensure you are eligible and haven\'t already voted in these categories.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCastBallot = () => {
    castBallot();
  };

  return (
    <div className="max-w-xl mx-auto text-center flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">Confirm Your Vote Choices</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Verify the details of your cryptographic ballot before transmission to the audit chain.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 text-xs font-bold text-left">
          {error}
        </div>
      )}

      {/* Selected Summary Card List */}
      <div className="flex flex-col gap-3">
        {candidates.map(candidate => (
          <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-4 text-left shadow-sm" key={candidate.id}>
            <img 
              src={candidate.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'} 
              alt={candidate.name} 
              className="w-14 h-14 object-cover rounded-xl shrink-0" 
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold uppercase tracking-wider block">
                {candidate.position}
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {candidate.ballotNumber ? `No. ${candidate.ballotNumber} - ` : ''}{candidate.name}
                {candidate.choice && (
                  <span className={`ml-2 text-xs font-bold ${
                    candidate.choice === 'yes' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    ({candidate.choice === 'yes' ? '✓ Voted Yes' : '✗ Voted No'})
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{election.title}</p>
            </div>
            <CheckCircle size={20} className="text-emerald-500 shrink-0 mr-1" />
          </div>
        ))}
      </div>

      {/* Warning Panel Alert */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30 text-left flex gap-3">
        <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">Warning: Action is Permanent</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
            Your votes cannot be changed or recalled after submission. The audit ledger does not support modifications once block confirmation completes.
          </p>
        </div>
      </div>

      {/* Submit Actions */}
      <div className="flex gap-3 justify-center">
        {(() => {
          const backParams = new URLSearchParams();
          candidateIds.forEach(id => backParams.append('candidateId', id));
          return (
            <Link 
              href={`/voter/elections/detail?id=${electionId}&${backParams.toString()}`}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={16} /> Go Back
            </Link>
          );
        })()}
        <button 
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-2 disabled:opacity-50" 
          onClick={handleCastBallot} 
          disabled={submitting}
        >
          <ShieldCheck size={16} /> {submitting ? 'Transmitting ballot...' : 'Cast Ballot Securely'}
        </button>
      </div>
    </div>
  );
}

export default function VoteConfirmationPage() {
  return (
    <Suspense fallback={<p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Preparing ballot confirmation details...</p>}>
      <VoteConfirmationPageContent />
    </Suspense>
  );
}
