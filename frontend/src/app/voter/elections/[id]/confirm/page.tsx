'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
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
}

interface Election {
  id: string;
  title: string;
}

function VoteConfirmationPageContent({ electionId }: { electionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  // Get all candidate IDs passed in search params
  const candidateIds = searchParams.getAll('candidateId');

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (candidateIds.length === 0) {
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
          // Map searchParam candidateIds to extract base candidate ID and choice (e.g. "cand1:yes" -> base "cand1", choice "yes")
          const selectedMap = new Map<string, { fullId: string; choice?: string }>();
          candidateIds.forEach(fullId => {
            const parts = fullId.split(':');
            const baseId = parts[0];
            const choice = parts[1]; // 'yes' or 'no'
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
    return <p style={{ color: 'var(--text-secondary)' }}>Preparing ballot confirmation details...</p>;
  }

  if (!election || candidates.length === 0) {
    return (
      <div className="empty-state">
        <AlertTriangle size={48} style={{ color: 'var(--color-danger)' }} />
        <h3>Invalid Session</h3>
        <p>No valid candidates selection parameters were registered for this checkout flow.</p>
        <Link href="/voter/elections" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
          Back to Elections
        </Link>
      </div>
    );
  }

  const castBallot = async () => {
    setError('');
    setSubmitting(true);
    try {
      // Cast all votes in parallel with preserved option choice (e.g. candId:yes)
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
      
      // Grab verification ID from the first cast response as representative or store all
      const verificationId = responses[0]?.data?.verificationId || 'verified';

      // Save to local storage voter votes history
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

      // Redirect to success screen
      router.push(`/voter/elections/${electionId}/success?verificationId=${verificationId}`);
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
    <div className="confirm-box animate-page-enter" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Confirm Your Vote choices</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Verify the details of your cryptographic ballot before transmission to the audit chain.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ 
          padding: 'var(--space-3) var(--space-4)', 
          borderRadius: 'var(--radius-md)', 
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--text-sm)',
          background: 'var(--color-danger-bg)',
          color: 'var(--color-danger)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          textAlign: 'left'
        }}>
          {error}
        </div>
      )}

      {/* Selected Summary Card List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {candidates.map(candidate => (
          <div className="glass-card" key={candidate.id} style={{ 
            textAlign: 'left', 
            display: 'flex', 
            gap: 'var(--space-4)', 
            alignItems: 'center', 
            borderColor: 'rgba(37, 99, 235, 0.2)',
            padding: 'var(--space-3)'
          }}>
            <img 
              src={candidate.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'} 
              alt={candidate.name} 
              style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} 
            />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
                {candidate.position}
              </span>
              <h3 style={{ fontSize: 'var(--text-base)', margin: '2px 0', fontWeight: 600 }}>
                {candidate.name}
                {candidate.choice && (
                  <span style={{ 
                    marginLeft: '8px', 
                    fontSize: '12px', 
                    color: candidate.choice === 'yes' ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)',
                    fontWeight: 'bold' 
                  }}>
                    ({candidate.choice === 'yes' ? '✓ Voted Yes' : '✗ Voted No'})
                  </span>
                )}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>{election.title}</p>
            </div>
            <CheckCircle size={18} color="var(--color-success, #22c55e)" style={{ marginRight: 'var(--space-2)' }} />
          </div>
        ))}
      </div>

      {/* Warning Panel Alert */}
      <div className="alert alert-warning" style={{ marginBottom: 'var(--space-8)', textAlign: 'left', display: 'flex', gap: 'var(--space-3)' }}>
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p style={{ fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Warning: Action is Permanent</p>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)' }}>
            Your votes cannot be changed or recalled after submission. The audit ledger does not support modifications once block confirmation completes.
          </p>
        </div>
      </div>

      {/* Submit Items Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
        {(() => {
          const backParams = new URLSearchParams();
          candidateIds.forEach(id => backParams.append('candidateId', id));
          return (
            <Link href={`/voter/elections/${electionId}?${backParams.toString()}`} className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={18} /> Go Back
            </Link>
          );
        })()}
        <button 
          className="btn btn-primary btn-lg" 
          onClick={handleCastBallot} 
          disabled={submitting}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ShieldCheck size={18} /> {submitting ? 'Transmitting ballot...' : 'Cast Ballot Securely'}
        </button>
      </div>


    </div>
  );
}

export default function VoteConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<p style={{ color: 'var(--text-secondary)', padding: 'var(--space-8)', textAlign: 'center' }}>Preparing ballot confirmation details...</p>}>
      <VoteConfirmationPageContent electionId={resolvedParams.id} />
    </Suspense>
  );
}
