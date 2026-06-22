'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  photoUrl: string;
}

interface Election {
  id: string;
  title: string;
}

export default function VoteConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  
  const electionId = resolvedParams.id;
  const candidateId = searchParams.get('candidateId');

  const [election, setElection] = useState<Election | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!candidateId) {
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
          const found = candidatesRes.data.find(c => c.id === candidateId);
          if (found) setCandidate(found);
        }
      } catch (err) {
        console.error('Error fetching confirmation data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [electionId, candidateId]);

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Preparing ballot confirmation details...</p>;
  }

  if (!election || !candidate) {
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

  const handleCastBallot = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ 
        status: string; 
        data: { verificationId: string } 
      }>('/votes/cast', 'POST', {
        electionId,
        candidateId
      });

      if (res.status === 'success') {
        const verificationId = res.data.verificationId;
        
        // Save to local storage voter votes history
        const storedVotes = localStorage.getItem('votetrust_voter_votes') || '[]';
        const parsed = JSON.parse(storedVotes);
        parsed.push({
          id: verificationId,
          electionId,
          electionName: election.title,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('votetrust_voter_votes', JSON.stringify(parsed));

        // Redirect to success screen
        router.push(`/voter/elections/${electionId}/success?verificationId=${verificationId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Transmission failed. Ensure you are eligible and haven\'t already voted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="confirm-box animate-page-enter" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Confirm Your Vote Choice</h2>
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

      {/* Selected Summary Card */}
      <div className="glass-card" style={{ 
        marginBottom: 'var(--space-6)', 
        textAlign: 'left', 
        display: 'flex', 
        gap: 'var(--space-4)', 
        alignItems: 'center', 
        borderColor: 'rgba(37, 99, 235, 0.2)' 
      }}>
        <img 
          src={candidate.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'} 
          alt={candidate.name} 
          style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} 
        />
        <div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
            {candidate.position} Choice
          </span>
          <h3 style={{ fontSize: 'var(--text-xl)', margin: 'var(--space-1) 0' }}>{candidate.name}</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>{election.title}</p>
        </div>
      </div>

      {/* Warning Panel Alert */}
      <div className="alert alert-warning" style={{ marginBottom: 'var(--space-8)', textAlign: 'left', display: 'flex', gap: 'var(--space-3)' }}>
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p style={{ fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Warning: Action is Permanent</p>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)' }}>
            Your vote cannot be changed or recalled after submission. The audit ledger does not support modifications once block confirmation completes.
          </p>
        </div>
      </div>

      {/* Submit Items Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
        <Link href={`/voter/elections/${electionId}?candidateId=${candidateId}`} className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={18} /> Go Back
        </Link>
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
